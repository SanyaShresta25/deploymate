from datetime import datetime
import hmac
import json
import os
import sqlite3
from urllib import error, request as urlrequest

from flask import Flask, g, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_local_env(env_path):
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_local_env(os.path.join(BASE_DIR, ".env"))
DB_PATH = os.environ.get("DEPLOYMATE_DB_PATH", os.path.join(BASE_DIR, "deploymate.db"))


def get_cors_origins():
    raw_origins = os.environ.get("DEPLOYMATE_ALLOWED_ORIGINS", "*")
    if raw_origins.strip() == "*":
        return "*"

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or "*"


CORS(app, resources={r"/*": {"origins": get_cors_origins()}})


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS services (
                name TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                last_deployed TEXT
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS deploy_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_name TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (service_name) REFERENCES services(name)
            )
            """
        )

        for service_name in ["frontend", "backend", "database"]:
            cursor.execute(
                """
                INSERT OR IGNORE INTO services (name, status, last_deployed)
                VALUES (?, ?, ?)
                """,
                (service_name, "running", None),
            )

        conn.commit()


def get_auth_settings():
    return {
        "username": os.environ.get("DEPLOYMATE_USERNAME", "admin"),
        "password": os.environ.get("DEPLOYMATE_PASSWORD", "admin123"),
        "token": os.environ.get("DEPLOYMATE_API_TOKEN", "dev-token-change-me"),
    }


def is_authorized():
    token = get_auth_settings()["token"]
    auth_header = request.headers.get("Authorization", "")
    expected_header = f"Bearer {token}"
    return hmac.compare_digest(auth_header, expected_header)


def require_auth():
    if not is_authorized():
        return jsonify({"error": "Unauthorized"}), 401
    return None


def get_github_settings():
    return {
        "token": os.environ.get("DEPLOYMATE_GH_TOKEN", ""),
        "repo": os.environ.get("DEPLOYMATE_GH_REPO", ""),
        "workflow": os.environ.get("DEPLOYMATE_GH_WORKFLOW", "deploy.yml"),
        "ref": os.environ.get("DEPLOYMATE_GH_REF", "main"),
    }


def trigger_github_workflow(service, requested_by):
    settings = get_github_settings()
    missing = [key for key in ["token", "repo"] if not settings[key]]
    if missing:
        return False, f"Missing GitHub deploy configuration: {', '.join(missing)}"

    url = (
        f"https://api.github.com/repos/{settings['repo']}/actions/workflows/"
        f"{settings['workflow']}/dispatches"
    )
    payload = {
        "ref": settings["ref"],
        "inputs": {
            "service": service,
            "requested_by": requested_by,
            "requested_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        },
    }

    req = urlrequest.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {settings['token']}",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "DeployMate",
        },
    )

    try:
        with urlrequest.urlopen(req, timeout=10) as response:
            if response.getcode() == 204:
                return True, "Workflow dispatch accepted by GitHub Actions."
            return False, f"Unexpected GitHub response status: {response.getcode()}"
    except error.HTTPError as http_err:
        details = http_err.read().decode("utf-8", errors="replace")
        return False, f"GitHub API error ({http_err.code}): {details}"
    except error.URLError as url_err:
        return False, f"Failed to reach GitHub API: {url_err.reason}"


@app.route("/")
def home():
    return {"message": "DeployMate API is running"}


@app.route("/health")
def health():
    return {"status": "ok"}


@app.route("/services")
def get_services():
    db = get_db()
    rows = db.execute(
        "SELECT name, status, last_deployed FROM services ORDER BY name ASC"
    ).fetchall()

    payload = {
        row["name"]: {
            "status": row["status"],
            "last_deployed": row["last_deployed"],
        }
        for row in rows
    }
    return jsonify(payload)


@app.route("/auth/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "")
    password = payload.get("password", "")
    settings = get_auth_settings()

    username_ok = hmac.compare_digest(username, settings["username"])
    password_ok = hmac.compare_digest(password, settings["password"])

    if username_ok and password_ok:
        return jsonify({
            "token": settings["token"],
            "username": settings["username"],
        })

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/deploy/<service>", methods=["POST"])
def deploy(service):
    unauthorized = require_auth()
    if unauthorized:
        return unauthorized

    db = get_db()
    service_row = db.execute("SELECT name FROM services WHERE name = ?", (service,)).fetchone()
    if not service_row:
        return {"error": "service not found"}, 404

    requested_by = request.headers.get("X-Deploymate-User", "dashboard-user")
    success, trigger_message = trigger_github_workflow(service, requested_by)

    now = datetime.utcnow().isoformat(sep=" ", timespec="seconds")
    log_prefix = "DEPLOY REQUESTED" if success else "DEPLOY FAILED"
    log_message = f"[{log_prefix}] {service}: {trigger_message}"

    if success:
        db.execute(
            "UPDATE services SET status = ?, last_deployed = ? WHERE name = ?",
            ("deploying", now, service),
        )

    db.execute(
        """
        INSERT INTO deploy_logs (service_name, message, created_at)
        VALUES (?, ?, ?)
        """,
        (service, log_message, now),
    )
    db.commit()

    if not success:
        return {"error": trigger_message}, 502

    return {"message": f"{service} deployment requested"}


@app.route("/logs/<service>")
def get_logs(service):
    db = get_db()
    service_row = db.execute("SELECT name FROM services WHERE name = ?", (service,)).fetchone()
    if not service_row:
        return jsonify([])

    rows = db.execute(
        """
        SELECT message
        FROM deploy_logs
        WHERE service_name = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 100
        """,
        (service,),
    ).fetchall()
    return jsonify([row["message"] for row in rows])


init_db()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
