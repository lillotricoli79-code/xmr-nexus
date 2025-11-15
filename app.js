
const { useState, useEffect } = React;

// Legge i dati reali dall'API del proxy
async function apiPoll() {
  try {
    const res = await fetch("https://lillot.duckdns.org/stats");
    if (!res.ok) throw new Error("API non raggiungibile");
    return await res.json();
  } catch (err) {
    console.error("Errore API:", err);
    return { hashrate: 0, shares: 0, uptime: 0 };
  }
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
  const [devFee, setDevFee] = useState(1);
  const [ref, setRef] = useState({ code: "", percent: 5 });
  const [running, setRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [metrics, setMetrics] = useState([]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", "dark"); }, []);

  useEffect(() => {
    let interval;
    if (running) {
      interval = setInterval(async () => {
        const data = await apiPoll();
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
    React.createElement("div", { className: "container" },
      React.createElement("h1", null, "XMR Nexus — Dashboard"),

      React.createElement("section", { className: "card" },
        React.createElement("h2", null, "Dev Fee"),
        React.createElement("div", { className: "row" },
          React.createElement("strong", null, devFee + "%"),
          React.createElement("button", { onClick: () => setDevFee(d => (d + 1) % 100) }, "+1")
        )
      ),

      React.createElement("section", { className: "card" },
        React.createElement("h2", null, "Referral"),
        React.createElement("input", {
          placeholder: "Codice referral",
          value: ref.code,
          onChange: e => setRef({ ...ref, code: e.target.value })
        }),
        React.createElement("input", {
          type: "number",
          value: ref.percent,
          onChange: e => setRef({ ...ref, percent: Number(e.target.value) })
        })
      ),

      React.createElement("section", { className: "card" },
        React.createElement("h2", null, "Sessione"),
        React.createElement("div", { className: "row" },
          React.createElement("button", { onClick: startSession }, "Avvia 1h"),
          React.createElement("button", { onClick: () => setRunning(r => !r) }, running ? "Stop" : "Start Poll"),
          React.createElement("button", { onClick: () => exportCSV(metrics) }, "Export CSV")
        ),
        timer > 0 && React.createElement("div", null,
          "Restante: " + Math.floor(timer / 60) + "m " + (timer % 60) + "s"
        )
      ),

      React.createElement("section", { className: "card small" },
        React.createElement("h3", null, "Ultimi dati"),
        React.createElement("pre", null, JSON.stringify(metrics.slice(-5), null, 2))
      ),

      React.createElement("footer", { className: "footer" }, "XMR Nexus — Tema Scuro Monero")
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
