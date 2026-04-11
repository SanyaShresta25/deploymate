import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const REFRESH_MS = 10000;

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
        <h2>{name}</h2>
        <span className={`status status-${service.status}`}>{service.status}</span>
      </div>

      <p className="meta">Last deployed: {service.last_deployed ? new Date(service.last_deployed).toLocaleString() : "Never"}</p>

      <div className="row">
        <button onClick={() => onDeploy(name)} disabled={deployLoading}>
          {deployLoading ? "Deploying" : "Deploy"}
        </button>
        <button className="button-light" onClick={() => onToggleLogs(name)}>
          {logsOpen ? "Hide logs" : "Show logs"}
        </button>
      </div>

      {logsOpen && (
        <div className="logs">
          {logsLoading ? (
            <p>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p>No logs yet.</p>
          ) : (
            <ul>
              {logs.map((entry, index) => (
                <li key={`${name}-${index}`}>
                  <strong>{new Date(entry.timestamp).toLocaleTimeString()}:</strong> {entry.message}
                </li>
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
  const [summary, setSummary] = useState({ total: 0, running: 0, degraded: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deployingMap, setDeployingMap] = useState({});
  const [openLogs, setOpenLogs] = useState({});
  const [logsMap, setLogsMap] = useState({});
  const [logsLoadingMap, setLogsLoadingMap] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const serviceNames = useMemo(() => Object.keys(services), [services]);

  const fetchServices = async () => {
    try {
      setError("");
      const [servicesRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/services`),
        axios.get(`${API_BASE_URL}/summary`),
      ]);
      setServices(servicesRes.data);
      setSummary(summaryRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Could not reach backend. Make sure backend is running on port 5000.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async (service) => {
    try {
      setLogsLoadingMap((prev) => ({ ...prev, [service]: true }));
      const res = await axios.get(`${API_BASE_URL}/logs/${service}?limit=20`);
      setLogsMap((prev) => ({ ...prev, [service]: res.data }));
    } catch (err) {
      setLogsMap((prev) => ({
        ...prev,
        [service]: [
          {
            timestamp: new Date().toISOString(),
            message: "Could not load logs",
          },
        ],
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
      setError(`Deploy failed for ${service}.`);
    } finally {
      setDeployingMap((prev) => ({ ...prev, [service]: false }));
    }
  };

  const toggleLogs = async (service) => {
    const nextOpen = !openLogs[service];
    setOpenLogs((prev) => ({ ...prev, [service]: nextOpen }));
    if (nextOpen && !logsMap[service]) {
      await fetchLogs(service);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    const interval = setInterval(fetchServices, REFRESH_MS);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>DeployMate</h1>
          <p className="meta">Simple service control panel</p>
        </div>
        <div className="topbar-actions">
          <button className="button-light" onClick={fetchServices}>Refresh</button>
          <label className="switch">
            <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh((v) => !v)} />
            Auto refresh
          </label>
        </div>
      </header>

      <section className="summary">
        <span>Total: {summary.total}</span>
        <span>Running: {summary.running}</span>
        <span>Degraded/Stopped: {summary.degraded}</span>
        <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Not updated yet"}</span>
      </section>

      {isLoading && <p>Loading services...</p>}
      {error && <p className="error">{error}</p>}

      <section className="grid">
        {serviceNames.map((serviceName) => (
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

      {!isLoading && serviceNames.length === 0 && <p>No services configured.</p>}
    </main>
  );
}

export default App;
