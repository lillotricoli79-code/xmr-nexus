export default function handler(req, res) {
  // CORS per la tua GitHub Pages
  res.setHeader("Access-Control-Allow-Origin", "https://lillotricoli79-code.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-api-key, x-access-token");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Mock coerente con la tua dash
  const fakeStats = {
    hashrate: 3200,
    accepted: 85,
    rejected: 4,
    uptime: "48:12:05",
    workers: [
      { name: "worker1", hashrate: 1800, accepted: 50, rejected: 2, lastUpdate: new Date().toLocaleTimeString() },
      { name: "worker2", hashrate: 1400, accepted: 35, rejected: 2, lastUpdate: new Date().toLocaleTimeString() },
    ],
  };

  res.status(200).json(fakeStats);
}
