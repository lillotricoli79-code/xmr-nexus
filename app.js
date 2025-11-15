


import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// Simula i dati dell'API
async function fakeApiPoll() {
  return {
    hashrate: Math.round(400 + (Math.random() - 0.5) * 120),
    shares: Math.floor(Math.random() * 200),
    uptime: Math.floor(Math.random() * 7200),
  };
}

// Esporta i dati in CSV
function exportCSV(data) {
  if (!data.length) return alert("Nessun dato da esportare");
  const csv = Object.keys(data[0]).join(",") + "\n" +
              data.map(row => Object.values(row).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xmr_session.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [devFee, setDevFee] = useState(20);
  const [ref, setRef] = useState({ code: "", percent: 5 });
  const [running, setRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [metrics, setMetrics] = useState([]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", "dark"); }, []);

  useEffect(() => {
    let interval;
    if (running) {
      interval = setInterval(async () => {
        const data = await fakeApiPoll();
        setMetrics(prev => [...prev.slice(-119), { t: new Date().toISOString(), ...data }]);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setTimer(t => (t > 0 ? t - 1 : 0)), 1000);
    if (timer === 0) setRunning(false);
    return () => clearInterval(id);
  }, [timer]);

  const startSession = () => {
    if (!confirm("Eseguire 1 ora? Assicurati sia il tuo dispositivo.")) return;
    setMetrics([]);
    setTimer(3600);
    setRunning(true);
  };

  return (
    <div className="container">
      <h1>XMR Nexus — Dashboard</h1>

      <section className="card">
        <h2>Dev Fee</h2>
        <div className="row">
          <strong>{devFee}%</strong>
          <button onClick={() => setDevFee(d => (d + 1) % 100)}>+1</button>
        </div>
      </section>

      <section className="card">
        <h2>Referral</h2>
        <input
          placeholder="Codice referral"
          value={ref.code}
          onChange={e => setRef({ ...ref, code: e.target.value })}
        />
        <input
          type="number"
          value={ref.percent}
          onChange={e => setRef({ ...ref, percent: Number(e.target.value) })}
        />
      </section>

      <section className="card">
        <h2>Sessione</h2>
        <div className="row">
          <button onClick={startSession}>Avvia 1h</button>
          <button onClick={() => setRunning(r => !r)}>{running ? "Stop" : "Start Poll"}</button>
          <button onClick={() => exportCSV(metrics)}>Export CSV</button>
        </div>
        {timer > 0 && (
          <div>
            Restante: {Math.floor(timer / 60)}m {timer % 60}s
          </div>
        )}
      </section>

      <section className="card small">
        <h3>Ultimi dati</h3>
        <pre>{JSON.stringify(metrics.slice(-5), null, 2)}</pre>
      </section>

      <footer className="footer">XMR Nexus — Tema Scuro Monero</footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
