import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://deploymate-w9wt.onrender.com/";

function ServiceCard({
  name,
  service,
  onDeploy,
  deployLoading,
  onToggleLogs,
  logsOpen,
  logs,
  logsLoading,
}) {
  return (
    <article className="service-card">
      <div className="service-header">
        <h3>{name}</h3>
        <span className={`status-badge status-${service.status}`}>{service.status}</span>
      </div>

      <p className="meta-row">
        <strong>Last deployed:</strong> {service.last_deployed || "Never"}
      </p>

      <div className="actions">
        <button onClick={() => onDeploy(name)} disabled={deployLoading}>
          {deployLoading ? "Deploying..." : "Deploy"}
        </button>
        <button className="secondary" onClick={() => onToggleLogs(name)}>
          {logsOpen ? "Hide Logs" : "View Logs"}
        </button>
      </div>

      {logsOpen && (
        <div className="logs-panel">
          <h4>Logs</h4>
          {logsLoading ? (
            <p>Loading logs…</p>
          ) : logs.length === 0 ? (
            <p>No logs yet.</p>
          ) : (
            <ul>
              {logs.map((entry, index) => (
                <li key={`${name}-log-${index}`}>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function App() {
  const [services, setServices] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deployingMap, setDeployingMap] = useState({});
  const [openLogs, setOpenLogs] = useState({});
  const [logsMap, setLogsMap] = useState({});
  const [logsLoadingMap, setLogsLoadingMap] = useState({});

  const fetchServices = async () => {
    try {
      setError("");
      const res = await axios.get(`${API_BASE_URL}/services`);
      setServices(res.data);
    } catch (err) {
      setError("Failed to load services. Please check API connectivity.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async (service) => {
    try {
      setLogsLoadingMap((prev) => ({ ...prev, [service]: true }));
      const res = await axios.get(`${API_BASE_URL}/logs/${service}`);
      setLogsMap((prev) => ({ ...prev, [service]: res.data }));
    } catch (err) {
      setLogsMap((prev) => ({
        ...prev,
        [service]: ["Failed to load logs."],
      }));
    } finally {
      setLogsLoadingMap((prev) => ({ ...prev, [service]: false }));
    }
  };

  const deploy = async (service) => {
    try {
      setDeployingMap((prev) => ({ ...prev, [service]: true }));
      await axios.post(`${API_BASE_URL}/deploy/${service}`);
      await fetchServices();
      if (openLogs[service]) {
        await fetchLogs(service);
      }
    } catch (err) {
      setError(`Failed to deploy ${service}.`);
    } finally {
      setDeployingMap((prev) => ({ ...prev, [service]: false }));
    }
  };

  const toggleLogs = async (service) => {
    const willOpen = !openLogs[service];
    setOpenLogs((prev) => ({ ...prev, [service]: willOpen }));

    if (willOpen && !logsMap[service]) {
      await fetchLogs(service);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <main className="app-shell">
      <h1>DeployMate Dashboard</h1>

      {isLoading && <p>Loading services…</p>}
      {error && <p className="error-banner">{error}</p>}

      <section className="service-grid">
        {Object.keys(services).map((serviceName) => (
          <ServiceCard
            key={serviceName}
            name={serviceName}
            service={services[serviceName]}
            onDeploy={deploy}
            deployLoading={Boolean(deployingMap[serviceName])}
            onToggleLogs={toggleLogs}
            logsOpen={Boolean(openLogs[serviceName])}
            logs={logsMap[serviceName] || []}
            logsLoading={Boolean(logsLoadingMap[serviceName])}
          />
        ))}
      </section>
    </main>
  );
}

export default App;
