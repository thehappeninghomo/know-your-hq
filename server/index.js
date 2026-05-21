const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

// ── Shared leaderboard — one array for all users on this server ───────────────
let leaderboard = [];

app.get("/api/leaderboard", (_req, res) => res.json({ leaderboard }));

app.post("/api/leaderboard", (req, res) => {
  const { name, score, title, emoji, time } = req.body;
  if (!name || score == null || !title || !emoji || !time)
    return res.status(400).json({ error: "Missing required fields" });
  leaderboard = [...leaderboard, { id: Date.now(), name, score, title, emoji, time }]
    .sort((a, b) => b.score - a.score);
  res.json({ leaderboard });
});

app.delete("/api/leaderboard", (_req, res) => {
  leaderboard = [];
  res.json({ leaderboard: [] });
});

// ── Proxy to Anthropic API ────────────────────────────────────────────────────
app.post("/api/claude", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in environment." });
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
    res.status(500).json({ error: "Failed to reach Anthropic API." });
  }
});

// ── Proxy to Google Gemini API ────────────────────────────────────────────────
app.post("/api/gemini", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set in environment." });
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
    res.status(500).json({ error: "Failed to reach Gemini API." });
  }
});

// ── Proxy to OpenAI API ───────────────────────────────────────────────────────
app.post("/api/openai", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not set in environment." });
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
    res.status(500).json({ error: "Failed to reach OpenAI API." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Leaderboard display: http://localhost:${PORT}/leaderboard`);
});
