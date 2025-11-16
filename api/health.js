export default function handler(req, res) {
  // CORS per la tua GitHub Pages
  res.setHeader("Access-Control-Allow-Origin", "https://lillotricoli79-code.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-api-key, x-access-token");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  res.status(200).json({ ok: true, time: Date.now() });
}
