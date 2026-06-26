const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Database (SQLite locally, PostgreSQL on Render) ────────────────────────────
const usePostgres = !!process.env.DATABASE_URL;
let db, pool;

if (usePostgres) {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  pool.query(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id          BIGSERIAL PRIMARY KEY,
      name        TEXT    NOT NULL,
      email       TEXT,
      score       INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      emoji       TEXT    NOT NULL,
      time        TEXT    NOT NULL,
      duration_ms INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
    .then(() => pool.query("ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS duration_ms INTEGER"))
    .then(() => pool.query("ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS email TEXT"))
    .then(() => console.log("PostgreSQL ready"))
    .catch(err => console.error("PostgreSQL init failed:", err.message));
} else {
  const Database = require("better-sqlite3");
  db = new Database("leaderboard.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT,
      score       INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      emoji       TEXT    NOT NULL,
      time        TEXT    NOT NULL,
      duration_ms INTEGER
    )
  `);
  const cols = db.prepare("PRAGMA table_info(leaderboard)").all().map(c => c.name);
  if (!cols.includes("duration_ms")) db.exec("ALTER TABLE leaderboard ADD COLUMN duration_ms INTEGER");
  if (!cols.includes("email"))       db.exec("ALTER TABLE leaderboard ADD COLUMN email TEXT");
  console.log("SQLite ready");
}

// ── Leaderboard helpers ────────────────────────────────────────────────────────
async function getLeaderboard() {
  if (usePostgres) {
    const { rows } = await pool.query(
      "SELECT id, name, email, score, title, emoji, time, duration_ms FROM leaderboard ORDER BY score DESC, duration_ms ASC NULLS LAST, id ASC"
    );
    return rows;
  }
  return db.prepare(
    "SELECT id, name, email, score, title, emoji, time, duration_ms FROM leaderboard ORDER BY score DESC, duration_ms IS NULL, duration_ms ASC, id ASC"
  ).all();
}

async function insertEntry(name, email, score, title, emoji, time, durationMs) {
  if (usePostgres) {
    await pool.query(
      "INSERT INTO leaderboard (name, email, score, title, emoji, time, duration_ms) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [name, email, score, title, emoji, time, durationMs]
    );
  } else {
    db.prepare("INSERT INTO leaderboard (name, email, score, title, emoji, time, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)").run(name, email, score, title, emoji, time, durationMs);
  }
}

async function clearLeaderboard() {
  if (usePostgres) {
    await pool.query("DELETE FROM leaderboard");
  } else {
    db.prepare("DELETE FROM leaderboard").run();
  }
}

async function deleteEntry(id) {
  if (usePostgres) {
    await pool.query("DELETE FROM leaderboard WHERE id = $1", [id]);
  } else {
    db.prepare("DELETE FROM leaderboard WHERE id = ?").run(id);
  }
}

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return res.status(500).json({ error: "ADMIN_TOKEN not configured on server" });
  if (req.headers["x-admin-token"] !== expected) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Leaderboard routes ─────────────────────────────────────────────────────────
app.get("/api/leaderboard", async (_req, res) => {
  try {
    res.json({ leaderboard: await getLeaderboard() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/leaderboard", async (req, res) => {
  const { name, email, score, title, emoji, time, durationMs } = req.body;
  if (!name || score == null || !title || !emoji || !time)
    return res.status(400).json({ error: "Missing required fields" });
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim()))
    return res.status(400).json({ error: "Invalid email" });
  const duration = Number.isFinite(durationMs) ? Math.round(durationMs) : null;
  try {
    await insertEntry(name, email.trim().toLowerCase(), score, title, emoji, time, duration);
    res.json({ leaderboard: await getLeaderboard() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save entry" });
  }
});

app.delete("/api/leaderboard", requireAdmin, async (_req, res) => {
  try {
    await clearLeaderboard();
    res.json({ leaderboard: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear leaderboard" });
  }
});

app.delete("/api/leaderboard/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await deleteEntry(id);
    res.json({ leaderboard: await getLeaderboard() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

// ── AI Proxies ────────────────────────────────────────────────────────────────
app.post("/api/claude", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error("Anthropic proxy error:", err);
    res.status(500).json({ error: "Failed to reach Anthropic API" });
  }
});

app.post("/api/image", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("[/api/image] OPENAI_API_KEY present:", !!apiKey, apiKey ? `(length ${apiKey.length}, ends …${apiKey.slice(-4)})` : "");
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not set" });
  const { prompt, model = "gpt-image-1", size = "1536x1024", quality = "medium" } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) return res.status(400).json({ error: "Missing prompt" });
  console.log("[/api/image] prompt:", prompt.slice(0, 80) + (prompt.length > 80 ? "…" : ""));
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, size, quality, n: 1, output_format: "webp", output_compression: 80 }),
    });
    const data = await response.json();
    console.log("[/api/image] OpenAI status:", response.status, response.ok ? "ok" : JSON.stringify(data).slice(0, 200));
    if (!response.ok) return res.status(response.status).json(data);
    // gpt-image-1 returns b64_json; normalize to a data URL so the client just reads .url.
    if (Array.isArray(data?.data)) {
      data.data = data.data.map(item =>
        item.url ? item
        : item.b64_json ? { ...item, url: `data:image/webp;base64,${item.b64_json}` }
        : item
      );
    }
    res.json(data);
  } catch (err) {
    console.error("OpenAI image error:", err);
    res.status(500).json({ error: "Failed to reach OpenAI" });
  }
});

// ── Question pool ─────────────────────────────────────────────────────────────
// Pre-generated scenarios (each with a baked-in image) live in memory and are
// served instantly to players. When the pool drops to REFILL_THRESHOLD we kick
// off a background refill back up to TARGET_POOL_SIZE. The very first players
// before the pool is warmed up fall through to on-demand generation.
const TARGET_POOL_SIZE = 40;
const REFILL_THRESHOLD = 8;
const BATCH_SIZE       = 10;
let questionPool = [];
let refilling    = false;

function questionsPrompt(count) {
  return `Generate ${count} funny scenario questions for a comedy game called "Know Your Humour Quotient". Players SPEAK or TYPE their own funny answer. To help them when they're stuck, each scenario also offers a few inspiration keywords — short, evocative words or short phrases the player can riff on or weave into their answer.

Return ONLY a valid JSON array. No markdown, no explanation, just the array. Use this exact shape:
[
  {
    "scenario": "A relatable/absurd 1-2 sentence situation that invites a funny response (end with a prompt like 'What do you say?' / 'What do you do?')",
    "keywords": ["4-5 short, vivid words or 2-word phrases tied to this scenario; concrete nouns/verbs/objects that spark a joke; not full sentences"]
  }
]

Mix scenarios: office disasters, awkward social moments, absurd everyday situations, tech gone wrong, food emergencies, public transport chaos. Indian-office-culture friendly where possible. Return only the JSON array of ${count} objects.`;
}

function imagePromptFor(scenario) {
  const scene = scenario.replace(/\s*what (do|would|will) you (say|do)\??\s*$/i, "").trim();
  return [
    `Illustrate the exact comedic moment described: "${scene}".`,
    "Style: hand-drawn editorial cartoon meets Pixar concept art — exaggerated facial expressions, theatrical body language, comic-strip timing. Catch the character mid-reaction (cringing, panicking, frozen wide-eyed, mortified). Bold ink lines, painterly colors, dramatic lighting that heightens the absurdity.",
    "Make the joke READ AT A GLANCE. Focus on the funniest beat of the moment, not the setup. Show the SPECIFIC objects, people, and setting named in the scene — do not generalize. Indian / South Asian office or urban context where the scene implies it.",
    "Hard constraints: no readable text, no captions, no logos, no watermarks, no signage with words. Landscape composition that fills the frame edge to edge.",
  ].join(" ");
}

async function claudeGenerateScenarios(count) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You generate questions for a comedy game called "Know Your Humour Quotient". Return ONLY a valid JSON array. No markdown, no explanation, just the array.`,
      messages: [{ role: "user", content: questionsPrompt(count) }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Claude ${response.status}: ${JSON.stringify(data).slice(0, 200)}`);
  const raw = data.content?.find(b => b.type === "text")?.text?.trim() || "[]";
  let arr;
  try { arr = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { return []; }
  return (Array.isArray(arr) ? arr : []).filter(q =>
    q && typeof q.scenario === "string" && q.scenario.trim() &&
    Array.isArray(q.keywords) && q.keywords.length >= 1
  );
}

async function openaiGenerateImage(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1536x1024", quality: "medium", n: 1, output_format: "webp", output_compression: 80 }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.warn("[pool] image failed:", JSON.stringify(data).slice(0, 200));
      return null;
    }
    const item = data?.data?.[0];
    if (item?.url) return item.url;
    if (item?.b64_json) return `data:image/webp;base64,${item.b64_json}`;
    return null;
  } catch (err) {
    console.warn("[pool] image error:", err.message);
    return null;
  }
}

async function buildQuestionsWithImages(scenarios) {
  const images = await Promise.all(scenarios.map(s => openaiGenerateImage(imagePromptFor(s.scenario))));
  return scenarios.map((s, i) => ({ ...s, image: images[i] }));
}

async function refillPool() {
  if (refilling) return;
  refilling = true;
  try {
    while (questionPool.length < TARGET_POOL_SIZE) {
      const need = Math.min(BATCH_SIZE, TARGET_POOL_SIZE - questionPool.length);
      console.log(`[pool] refilling — current ${questionPool.length}, fetching ${need}…`);
      let scenarios;
      try {
        scenarios = await claudeGenerateScenarios(need);
      } catch (err) {
        console.error("[pool] Claude fetch failed:", err.message);
        break;
      }
      if (!scenarios.length) {
        console.warn("[pool] Claude returned no scenarios, stopping refill");
        break;
      }
      const enriched = await buildQuestionsWithImages(scenarios);
      questionPool.push(...enriched);
      console.log(`[pool] now ${questionPool.length}/${TARGET_POOL_SIZE}`);
    }
  } finally {
    refilling = false;
  }
}

app.post("/api/questions", async (req, res) => {
  const n = Math.max(1, Math.min(20, parseInt(req.body?.n, 10) || 4));

  // Pull from the pool first (Node is single-threaded so this splice is atomic).
  const questions = questionPool.splice(0, Math.min(n, questionPool.length));

  // If the pool was short, fill the gap on-demand for this player so the game starts now.
  const missing = n - questions.length;
  if (missing > 0) {
    console.log(`[/api/questions] pool short by ${missing}, generating on-demand`);
    try {
      const scenarios = await claudeGenerateScenarios(missing);
      const enriched = await buildQuestionsWithImages(scenarios);
      questions.push(...enriched);
    } catch (err) {
      console.error("[/api/questions] on-demand generation failed:", err.message);
    }
  }

  // Trigger a background refill if the pool has dropped below threshold.
  if (questionPool.length < REFILL_THRESHOLD && !refilling) {
    console.log(`[pool] below threshold (${questionPool.length} < ${REFILL_THRESHOLD}), kicking off refill`);
    refillPool(); // fire-and-forget
  }

  res.json({ questions, poolSize: questionPool.length });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const anth = process.env.ANTHROPIC_API_KEY;
  const oai  = process.env.OPENAI_API_KEY;
  console.log("ANTHROPIC_API_KEY:", anth ? `loaded (length ${anth.length}, ends …${anth.slice(-4)})` : "MISSING");
  console.log("OPENAI_API_KEY:",    oai  ? `loaded (length ${oai.length}, ends …${oai.slice(-4)})`  : "MISSING");
  // Warm the question pool so the first player gets an instant start.
  refillPool();
});
