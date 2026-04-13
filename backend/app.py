from datetime import datetime
import hmac
import os
import sqlite3

from flask import Flask, g, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DEPLOYMATE_DB_PATH", os.path.join(BASE_DIR, "deploymate.db"))


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

    now = datetime.utcnow().isoformat(sep=" ")
    db.execute(
        "UPDATE services SET status = ?, last_deployed = ? WHERE name = ?",
        ("running", now, service),
    )
    db.execute(
        """
        INSERT INTO deploy_logs (service_name, message, created_at)
        VALUES (?, ?, ?)
        """,
        (service, f"{service} deployed at {now}", now),
    )
    db.commit()

    return {"message": f"{service} deployed"}


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
