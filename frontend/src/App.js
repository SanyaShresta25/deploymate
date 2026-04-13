import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const RAW_API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "https://deploymate-backend.onrender.com";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
const TOKEN_STORAGE_KEY = "deploymateAuthToken";
const USER_STORAGE_KEY = "deploymateUser";

function ServiceCard({
  name,
  service,
  onDeploy,
  deployLoading,
  onToggleLogs,
  logsOpen,
  logs,
  logsLoading,
  canDeploy,
}) {
  return (
    <article className={`service-card service-card-${service.status || "unknown"}`}>
      <div className="service-header">
        <div>
          <p className="service-label">Service</p>
          <h3>{name}</h3>
        </div>
        <span className={`status-badge status-${service.status}`}>{service.status}</span>
      </div>

      <p className="meta-row">
        <strong>Last deployed:</strong> {service.last_deployed || "Never"}
      </p>

      <div className="actions">
        <button onClick={() => onDeploy(name)} disabled={deployLoading || !canDeploy}>
          {!canDeploy ? "Login to Deploy" : deployLoading ? "Deploying..." : "Deploy"}
        </button>
        <button className="secondary" onClick={() => onToggleLogs(name)}>
          {logsOpen ? "Hide Logs" : "View Logs"}
        </button>
      </div>

      {logsOpen && (
        <div className="logs-panel">
          <h4>Recent Logs</h4>
          {logsLoading ? (
            <p>Loading logs...</p>
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

  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [authUser, setAuthUser] = useState(() => localStorage.getItem(USER_STORAGE_KEY) || "");

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

  const handleUnauthorized = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setAuthToken("");
    setAuthUser("");
    setError("Your session is invalid or expired. Please log in again.");
  };

  const deploy = async (service) => {
    if (!authToken) {
      setError("Please log in before deploying services.");
      return;
    }

    try {
      setDeployingMap((prev) => ({ ...prev, [service]: true }));
      await axios.post(`${API_BASE_URL}/deploy/${service}`, null, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Deploymate-User": authUser || "dashboard-user",
        },
      });
      await fetchServices();
      if (openLogs[service]) {
        await fetchLogs(service);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized();
      } else {
        setError(err.response?.data?.error || `Failed to deploy ${service}.`);
      }
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

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!usernameInput || !passwordInput) {
      setError("Enter both username and password to continue.");
      return;
    }

    try {
      setError("");
      setLoginLoading(true);
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: usernameInput,
        password: passwordInput,
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, res.data.token);
      localStorage.setItem(USER_STORAGE_KEY, res.data.username);
      setAuthToken(res.data.token);
      setAuthUser(res.data.username);
      setUsernameInput("");
      setPasswordInput("");
    } catch (err) {
      setError("Login failed. Please check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setAuthToken("");
    setAuthUser("");
    setError("");
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const serviceNames = Object.keys(services);
  const runningCount = serviceNames.filter((serviceName) => services[serviceName]?.status === "running").length;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Ops Control Center</p>
          <h1>DeployMate Dashboard</h1>
          <p className="hero-subtitle">
            Monitor service health, roll out deployments, and inspect logs from one place.
          </p>
        </div>

        {authToken ? (
          <div className="auth-panel auth-panel-active">
            <p className="auth-status">Signed in as <strong>{authUser || "admin"}</strong></p>
            <button className="secondary" onClick={handleLogout}>Logout</button>
            <button className="refresh-btn" onClick={fetchServices} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh Services"}
            </button>
          </div>
        ) : (
          <form className="auth-panel" onSubmit={handleLogin}>
            <p className="auth-title">Admin Login</p>
            <input
              type="text"
              placeholder="Username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              autoComplete="username"
            />
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Login"}
            </button>
          </form>
        )}
      </section>

      <section className="stats-grid">
        <article className="stat-tile">
          <p>Total Services</p>
          <strong>{serviceNames.length}</strong>
        </article>
        <article className="stat-tile">
          <p>Running</p>
          <strong>{runningCount}</strong>
        </article>
      </section>

      {isLoading && <p className="state-message">Loading services...</p>}
      {error && <p className="error-banner">{error}</p>}
      {!authToken && <p className="state-message">Deploy actions are locked until you log in.</p>}
      {!isLoading && !error && serviceNames.length === 0 && (
        <p className="state-message">No services configured yet.</p>
      )}

      <section className="service-grid">
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
            canDeploy={Boolean(authToken)}
          />
        ))}
      </section>
    </main>
  );
}

export default App;
