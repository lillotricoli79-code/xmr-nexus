
// Endpoint originale
const ENDPOINT = "http://0.0.0.0:8081/stats?access-token=123456";

async function fetchStats() {
  try {
    const res = await fetch(ENDPOINT);
    const data = await res.json();

    document.getElementById("hashrate").textContent = data.hashrate + " H/s";
    document.getElementById("workers").textContent = data.workers;
    document.getElementById("accepted").textContent = data.accepted;
    document.getElementById("rejected").textContent = data.rejected;
    document.getElementById("pool").textContent = data.pool || "N/A";
    document.getElementById("uptime").textContent = new Date().toLocaleTimeString();

    document.getElementById("statusBadge").className = "badge badge-ok";
    document.getElementById("statusBadge").textContent = "Online";
  } catch (err) {
    document.getElementById("statusBadge").className = "badge badge-warn";
    document.getElementById("statusBadge").textContent = "Demo";
    document.getElementById("statusMsg").textContent = "Endpoint non raggiungibile";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchStats();
  setInterval(fetchStats, 5000);
});
