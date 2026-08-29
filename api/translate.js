module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.SARVAM_API_KEY;
  if (!key) return res.status(501).json({ error: "missing_key" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const text = (body.text || "").slice(0, 2000);
  const target = body.target || "hi-IN";
  const ALLOWED = {
    "as-IN": 1, "bn-IN": 1, "brx-IN": 1, "doi-IN": 1, "gu-IN": 1, "hi-IN": 1,
    "kn-IN": 1, "ks-IN": 1, "kok-IN": 1, "mai-IN": 1, "ml-IN": 1, "mni-IN": 1,
    "mr-IN": 1, "ne-IN": 1, "od-IN": 1, "pa-IN": 1, "sa-IN": 1, "sat-IN": 1,
    "sd-IN": 1, "ta-IN": 1, "te-IN": 1, "ur-IN": 1
  };
  if (!text) return res.status(400).json({ error: "no_text" });
  if (!ALLOWED[target]) return res.status(400).json({ error: "bad_target" });
  const r = await fetch("https://api.sarvam.ai/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": key
    },
    body: JSON.stringify({
      input: text,
      source_language_code: "en-IN",
      target_language_code: target,
      model: "sarvam-translate:v1",
      mode: "formal"
    })
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: json.message || json.error || "sarvam_failed" });
  return res.status(200).json({ text: json.translated_text || "", source: json.source_language_code || "en-IN" });
};
