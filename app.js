
// Rilevamento endpoint automatico (senza demo)
const CANDIDATES = [
  // Preferisci stesso dominio + /stats (reverse proxy)
  `${window.location.origin}/stats`,
  // Fallback sul tuo DuckDNS
  `https://lillot.duckdns.org/stats`,
];

// Prova gli endpoint in sequenza e ritorna il primo che risponde
async function resolveEndpoint() {
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
      if (res.ok) {
        // Facoltativo: validazione rapida del JSON
        const j = await res.json().catch(() => null);
        if (j && ("hashrate" in j || "shares" in j || "uptime" in j)) {
          return url;
        }
      }
    } catch (_) {
      // Continua con il prossimo
    }
  }
  return null;
}

// Poll API
async function pollStats(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error("API non raggiungibile: " + res.status);
  const json = await res.json();
  return {
    hashrate: Number(json.hashrate ?? 0),
    shares: Number(json.shares ?? 0),
    uptime: Number(json.uptime ?? 0),
    workers: json.workers ?? [],
  };
}

// Export CSV
function exportCSV(rows) {
  if (!rows.length) return alert("Nessun dato da esportare");
  const headers = Object.keys(rows[0]).join(",");
  const body = rows.map(r => Object.values(r).join(",")).join("\n");
  const blob = new Blob([headers + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xmr_session.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Uptime formatter
function fmtUptime(sec) {
  const s = Math.max(0, Number(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}h ${m}m ${r}s`;
}

// App (React via CDN, senza JSX)
function App() {
  const { useState, useEffect } = React;

  const [endpoint, setEndpoint] = useState(null);
  const [status, setStatus] = useState("resolving"); // resolving | live | error | idle
  const [running, setRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [devFee, setDevFee] = useState(1);
  const [ref, setRef] = useState({ code: "", percent: 5 });

  const [last, setLast] = useState(null);
  const [metrics, setMetrics] = useState([]);

  // Tema scuro
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  // Risolvi endpoint all'avvio
  useEffect(() => {
    let mounted = true;
    (async () => {
      setStatus("resolving");
      const url = await resolveEndpoint();
      if (!mounted) return;
      if (url) {
        setEndpoint(url);
        setStatus("idle");
      } else {
        setEndpoint(null);
        setStatus("error");
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Polling
  useEffect(() => {
    let id;
    if (running && endpoint) {
      setStatus("live");
      id = setInterval(async () => {
        try {
          const data = await pollStats(endpoint);
          const tick = {
            t: new Date().toISOString(),
            hashrate: data.hashrate,
            shares: data.shares,
            uptime: data.uptime,
          };
          setLast(data);
          setMetrics(prev => [...prev.slice(-119), tick]);
          // Se ricevi sempre 0, segnala ma resta in live per non fermare la sessione
          if (data.hashrate === 0 && data.shares === 0 && data.uptime === 0) {
            setStatus("error");
          } else {
            setStatus("live");
          }
        } catch (err) {
          console.error("Polling error:", err);
          setStatus("error");
        }
      }, 3000);
    }
    return () => id && clearInterval(id);
  }, [running, endpoint]);

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

  // Avvia sessione
  function startSession() {
    const ok = confirm("Avvia una sessione di 1 ora? Assicurati sia il tuo dispositivo.");
    if (!ok) return;
    setMetrics([]);
    setTimer(3600);
    setRunning(true);
  }

  // UI
  return React.createElement("div", { className: "container" },

    // Titolo
    React.createElement("h1", null, "XMR Nexus — Dashboard"),

    // Stato + Endpoint auto (senza demo)
    React.createElement("section", { className: "card" },
      React.createElement("h2", null, "Stato"),
      React.createElement("div", { className: "row" },
        React.createElement("span", { className: "badge " + (
          status === "live" ? "ok" :
          status === "error" ? "err" :
          status === "resolving" ? "idle" : "idle"
        )},
          status === "live" ? "Live" :
          status === "error" ? "Errore API" :
          status === "resolving" ? "Rilevamento endpoint…" :
          "Inattivo"
        ),
        React.createElement("span", null, "Endpoint: " + (endpoint || "—")),
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

    // Sessione
    React.createElement("section", { className: "card" },
      React.createElement("h2", null, "Sessione"),
      React.createElement("div", { className: "row" },
        React.createElement("button", { onClick: startSession, disabled: status === "resolving" }, "Avvia 1h"),
        React.createElement("button", { onClick: () => setRunning(r => !r), disabled: !endpoint || status === "resolving" },
          running ? "Stop" : "Start Poll"
        ),
        React.createElement("button", { onClick: () => exportCSV(metrics) }, "Export CSV")
      ),
      timer > 0 && React.createElement("div", { className: "timer" },
        "Restante: " + Math.floor(timer / 60) + "m " + (timer % 60) + "s"
      )
    ),

    // Ultimi dati
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
