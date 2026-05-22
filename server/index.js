const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT    NOT NULL,
    score      INTEGER NOT NULL,
    title      TEXT    NOT NULL,
    emoji      TEXT    NOT NULL,
    time       TEXT    NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() => console.log("DB ready"))
  .catch(err => console.error("DB init failed:", err.message));

// ── Leaderboard ───────────────────────────────────────────────────────────────
app.get("/api/leaderboard", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, score, title, emoji, time FROM leaderboard ORDER BY score DESC"
    );
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

app.post("/api/leaderboard", async (req, res) => {
  const { name, score, title, emoji, time } = req.body;
  if (!name || score == null || !title || !emoji || !time)
    return res.status(400).json({ error: "Missing required fields" });
  try {
    await pool.query(
      "INSERT INTO leaderboard (name, score, title, emoji, time) VALUES ($1, $2, $3, $4, $5)",
      [name, score, title, emoji, time]
    );
    const { rows } = await pool.query(
      "SELECT id, name, score, title, emoji, time FROM leaderboard ORDER BY score DESC"
    );
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save entry" });
  }
});

app.delete("/api/leaderboard", async (_req, res) => {
  try {
    await pool.query("DELETE FROM leaderboard");
    res.json({ leaderboard: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear leaderboard" });
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

app.post("/api/gemini", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });
  const { model = "gemini-2.0-flash", ...body } = req.body;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error("Gemini proxy error:", err);
    res.status(500).json({ error: "Failed to reach Gemini API" });
  }
});

app.post("/api/openai", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not set" });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    console.error("OpenAI proxy error:", err);
    res.status(500).json({ error: "Failed to reach OpenAI API" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
