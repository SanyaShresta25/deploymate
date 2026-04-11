from flask import Flask, jsonify, request
from datetime import datetime
from flask_cors import CORS
import os

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

@app.route("/deploy/<service>", methods=["POST"])
def deploy(service):
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