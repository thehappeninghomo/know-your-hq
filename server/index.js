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
      id         BIGSERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      score      INTEGER NOT NULL,
      title      TEXT    NOT NULL,
      emoji      TEXT    NOT NULL,
      time       TEXT    NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).then(() => console.log("PostgreSQL ready"))
    .catch(err => console.error("PostgreSQL init failed:", err.message));
} else {
  const Database = require("better-sqlite3");
  db = new Database("leaderboard.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      score      INTEGER NOT NULL,
      title      TEXT    NOT NULL,
      emoji      TEXT    NOT NULL,
      time       TEXT    NOT NULL
    )
  `);
  console.log("SQLite ready");
}

// ── Leaderboard helpers ────────────────────────────────────────────────────────
async function getLeaderboard() {
  if (usePostgres) {
    const { rows } = await pool.query(
      "SELECT id, name, score, title, emoji, time FROM leaderboard ORDER BY score DESC"
    );
    return rows;
  }
  return db.prepare("SELECT id, name, score, title, emoji, time FROM leaderboard ORDER BY score DESC").all();
}

async function insertEntry(name, score, title, emoji, time) {
  if (usePostgres) {
    await pool.query(
      "INSERT INTO leaderboard (name, score, title, emoji, time) VALUES ($1, $2, $3, $4, $5)",
      [name, score, title, emoji, time]
    );
  } else {
    db.prepare("INSERT INTO leaderboard (name, score, title, emoji, time) VALUES (?, ?, ?, ?, ?)").run(name, score, title, emoji, time);
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

app.post("/api/leaderboard", async (req, res) => {
  const { name, score, title, emoji, time } = req.body;
  if (!name || score == null || !title || !emoji || !time)
    return res.status(400).json({ error: "Missing required fields" });
  try {
    await insertEntry(name, score, title, emoji, time);
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
