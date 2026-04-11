import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [services, setServices] = useState({});

  const fetchServices = async () => {
    const res = await axios.get("http://localhost:5000/services");
    setServices(res.data);
  };

  const deploy = async (service) => {
    await axios.post(`http://localhost:5000/deploy/${service}`);
    fetchServices();
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <div>
      <h1>DeployMate Dashboard</h1>
      {Object.keys(services).map((s) => (
        <div key={s}>
          <h3>{s}</h3>
          <p>Status: {services[s].status}</p>
          <button onClick={() => deploy(s)}>Deploy</button>
        </div>
      ))}
    </div>
  );
}

export default App;