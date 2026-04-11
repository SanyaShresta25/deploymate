from datetime import datetime, timezone
from threading import Lock

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


class ServiceStore:
    def __init__(self):
        self._lock = Lock()
        self.services = {
            "frontend": {"status": "running", "last_deployed": None},
            "backend": {"status": "running", "last_deployed": None},
            "database": {"status": "running", "last_deployed": None},
        }
        self.logs = {
            "frontend": [],
            "backend": [],
            "database": [],
        }

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _add_log(self, service: str, message: str, level: str = "info") -> None:
        entry = {
            "timestamp": self._now_iso(),
            "level": level,
            "message": message,
        }
        self.logs[service].append(entry)

    def list_services(self):
        with self._lock:
            return dict(self.services)

    def summary(self):
        with self._lock:
            total = len(self.services)
            running = sum(1 for svc in self.services.values() if svc["status"] == "running")
            degraded = sum(1 for svc in self.services.values() if svc["status"] != "running")
            return {
                "total": total,
                "running": running,
                "degraded": degraded,
            }

    def has_service(self, service: str) -> bool:
        return service in self.services

    def deploy(self, service: str):
        with self._lock:
            if service not in self.services:
                return False

            self.services[service]["status"] = "running"
            self.services[service]["last_deployed"] = self._now_iso()
            self._add_log(service, f"{service} deployed successfully")
            return True

    def update_status(self, service: str, status: str):
        valid_statuses = {"running", "stopped", "degraded"}
        if status not in valid_statuses:
            return "invalid"

        with self._lock:
            if service not in self.services:
                return "missing"

            self.services[service]["status"] = status
            self._add_log(service, f"status changed to {status}", "warn" if status != "running" else "info")
            return "ok"

    def get_logs(self, service: str, limit: int):
        with self._lock:
            if service not in self.logs:
                return None
            return self.logs[service][-limit:]


store = ServiceStore()


def error_response(message: str, status_code: int):
    return jsonify({"error": message}), status_code


@app.route("/")
def home():
    return jsonify({"message": "DeployMate API is running"})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()})


@app.route("/services")
def get_services():
    return jsonify(store.list_services())


@app.route("/summary")
def get_summary():
    return jsonify(store.summary())


@app.route("/services/<service>")
def get_service(service):
    services = store.list_services()
    if service not in services:
        return error_response("service not found", 404)
    return jsonify({"name": service, **services[service]})


@app.route("/deploy/<service>", methods=["POST"])
def deploy(service):
    if not store.deploy(service):
        return error_response("service not found", 404)
    return jsonify({"message": f"{service} deployed"})


@app.route("/services/<service>/status", methods=["POST"])
def set_status(service):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")

    if not isinstance(status, str):
        return error_response("status is required", 400)

    update_result = store.update_status(service, status)
    if update_result == "invalid":
        return error_response("invalid status. allowed: running, stopped, degraded", 400)
    if update_result == "missing":
        return error_response("service not found", 404)

    return jsonify({"message": f"{service} status set to {status}"})


@app.route("/logs/<service>")
def get_logs(service):
    raw_limit = request.args.get("limit", "50")
    if not raw_limit.isdigit():
        return error_response("limit must be a positive integer", 400)

    limit = max(1, min(int(raw_limit), 200))
    logs = store.get_logs(service, limit)
    if logs is None:
        return error_response("service not found", 404)

    return jsonify(logs)


if __name__ == "__main__":
    app.run(debug=True)
