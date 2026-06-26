export const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message ?? (typeof err.error === "string" ? err.error : null) ?? `Server error ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

export const callClaude = (body) => post("/api/claude", body);
export const generateImage = (body) => post("/api/image", body);
export const fetchQuestions = (n) => post("/api/questions", { n });

export async function fetchLeaderboard() {
  const res = await fetch(`${API_BASE}/api/leaderboard`);
  const data = await res.json();
  return data.leaderboard || [];
}

export async function saveScore(entry) {
  const data = await post("/api/leaderboard", entry);
  return data.leaderboard || [];
}
