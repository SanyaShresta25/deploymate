from flask import Flask, jsonify, request
from datetime import datetime
from flask_cors import CORS
import os
import hmac

app = Flask(__name__)
CORS(app)

# ===============================
# DATA (mock for now)
# ===============================
services = {
    "frontend": {"status": "running", "last_deployed": None},
    "backend": {"status": "running", "last_deployed": None},
    "database": {"status": "running", "last_deployed": None},
}

logs = {
    "frontend": [],
    "backend": [],
    "database": []
}


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

# ===============================
# ROUTES
# ===============================

@app.route("/")
def home():
    return {"message": "DeployMate API is running"}

@app.route("/health")
def health():
    return {"status": "ok"}

@app.route("/services")
def get_services():
    return jsonify(services)


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

    if service in services:
        services[service]["status"] = "running"
        services[service]["last_deployed"] = str(datetime.now())
        logs[service].append(f"{service} deployed at {datetime.now()}")
        return {"message": f"{service} deployed"}
    return {"error": "service not found"}, 404

@app.route("/logs/<service>")
def get_logs(service):
    return jsonify(logs.get(service, []))

# ===============================
# RUN APP (IMPORTANT FIX HERE)
# ===============================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render gives PORT
    app.run(host="0.0.0.0", port=port)
