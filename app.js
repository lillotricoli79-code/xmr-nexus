
// Utilità: polling API proxy
async function apiPoll() {
  try {
    const res = await fetch("https://lillot.duckdns.org/stats", {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("API non raggiungibile: " + res.status);
    const json = await res.json();
    // Normalizzazione minima: aspettati almeno hashrate, shares, uptime
    const safe = {
      hashrate: Number(json.hashrate ?? 0),
      shares: Number(json.shares ?? 0),
      uptime: Number(json.uptime ?? 0),
      workers: json.workers ?? [],
    };
    return safe;
  } catch (err) {
    console.error("Errore API:", err);
    return { hashrate: 0, shares: 0, uptime: 0, workers: [] };
  }
}

// Export CSV
function exportCSV(rows) {
  if (!rows.length) {
    alert("Nessun dato da esportare");
    return;
  }
  const headers = Object.keys(rows[0]).join(",");
  const body = rows.map(r => Object.values(r).join(",")).join("\n");
  const csv = headers + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xmr_session.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// App (React via CDN, senza JSX)
function App() {
  const { useState, useEffect } = React;

  const [devFee, setDevFee] = useState(1);
  const [ref, setRef] = useState({ code: "", percent: 5 });
  const [running, setRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [metrics, setMetrics] = useState([]);
  const [last, setLast] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | polling | error

  // Tema scuro Monero
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  // Polling
  useEffect(() => {
    let intervalId;
    if (running) {
      setStatus("polling");
      intervalId = setInterval(async () => {
        const data = await apiPoll();
        const tick = {
          t: new Date().toISOString(),
          hashrate: data.hashrate,
          shares: data.shares,
          uptime: data.uptime,
        };
        setLast(data);
        setMetrics(prev => [...prev.slice(-119), tick]);
        if (data.hashrate === 0 && data.shares === 0 && data.uptime === 0) {
          setStatus("error");
        } else {
          setStatus("polling");
        }
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [running]);

  // Timer sessione
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => {
      setTimer(t => {
        const next = t > 0 ? t - 1 : 0;
        if (next === 0) setRunning(false);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Avvio sessione
  function startSession() {
    const ok = confirm("Avvia una sessione di 1 ora? Assicurati sia il tuo dispositivo.");
    if (!ok) return;
    setMetrics([]);
    setTimer(3600);
    setRunning(true);
  }

  // UI helpers
  function fmtUptime(sec) {
    const s = Math.max(0, Number(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return `${h}h ${m}m ${r}s`;
  }

  // Render (no JSX)
  return React.createElement("div", { className: "container" },

    // Titolo
    React.createElement("h1", null, "XMR Nexus — Dashboard"),

    // Stato API
    React.createElement("section", { className: "card" },
      React.createElement("h2", null, "Stato"),
      React.createElement("div", { className: "row" },
        React.createElement("span", { className: "badge " + (status === "polling" ? "ok" : status === "error" ? "err" : "idle") },
          status === "polling" ? "Live" : status === "error" ? "Errore API" : "Inattivo"
        ),
        last ? React.createElement("span", null, "Uptime: " + fmtUptime(last.uptime)) : React.createElement("span", null, "Uptime: —"),
        last ? React.createElement("span", null, "Hashrate: " + last.hashrate + " H/s") : React.createElement("span", null, "Hashrate: —"),
        last ? React.createElement("span", null, "Shares: " + last.shares) : React.createElement("span", null, "Shares: —")
      )
    ),

    // Dev Fee
    React.createElement("section", { className: "card" },
      React.createElement("h2", null, "Dev Fee"),
      React.createElement("div", { className: "row" },
        React.createElement("strong", null, devFee + "%"),
        React.createElement("button", { onClick: () => setDevFee(d => Math.min(100, d + 1)) }, "+1"),
        React.createElement("button", { onClick: () => setDevFee(d => Math.max(0, d - 1)) }, "-1"),
        React.createElement("button", { onClick: () => setDevFee(1) }, "Reset 1%")
      )
    ),

    // Referral
    React.createElement("section", { className: "card" },
      React.createElement("h2", null, "Referral"),
      React.createElement("div", { className: "row" },
        React.createElement("input", {
          placeholder: "Codice referral",
          value: ref.code,
          onChange: e => setRef({ ...ref, code: e.target.value })
        }),
        React.createElement("input", {
          type: "number",
          min: 0, max: 100,
          value: ref.percent,
          onChange: e => setRef({ ...ref, percent: Number(e.target.value) })
        })
      )
    ),

    // Sessione controlli
    React.createElement("section", { className: "card" },
      React.createElement("h2", null, "Sessione"),
      React.createElement("div", { className: "row" },
        React.createElement("button", { onClick: startSession }, "Avvia 1h"),
        React.createElement("button", { onClick: () => setRunning(r => !r) }, running ? "Stop" : "Start Poll"),
        React.createElement("button", { onClick: () => exportCSV(metrics) }, "Export CSV")
      ),
      timer > 0 && React.createElement("div", { className: "timer" },
        "Restante: " + Math.floor(timer / 60) + "m " + (timer % 60) + "s"
      )
    ),

    // Ultimi dati JSON
    React.createElement("section", { className: "card small" },
      React.createElement("h3", null, "Ultimi dati"),
      React.createElement("pre", null, JSON.stringify(metrics.slice(-5), null, 2))
    ),

    // Footer
    React.createElement("footer", { className: "footer" }, "XMR Nexus — Tema Scuro Monero")
  );
}

// Mount
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
