import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchLeaderboard } from "./api";
import "./styles/Leaderboard.scss";

const MAX_SCORE = 6 * 25;
const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_CLASS = ["gold", "silver", "bronze"];

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function LeaderboardDisplay() {
  const [entries, setEntries]         = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function refresh() {
    try {
      const data = await fetchLeaderboard();
      setEntries(data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {}
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 600000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="lb-page min-vh-100 py-5 px-3">
      <div className="container" style={{ maxWidth: 900 }}>
        <header className="text-center mb-3">
          <h1 className="lb-title m-0">🏆 Comedy Rankings</h1>
          <p className="sn text-muted mt-2 mb-0">Know Your Humour Quotient · Ranked by Score</p>
        </header>

        <div className="d-flex justify-content-center align-items-center gap-2 mb-4 small text-muted">
          <span className="lb-live-dot" />
          Live{lastUpdated ? ` · updated ${lastUpdated}` : ""} · refreshes every 10 min
        </div>

        <div className="text-center mb-4">
          <Link to="/" className="btn btn-link">Back to Home</Link>
        </div>

        {entries.length === 0 ? (
          <p className="text-center text-muted py-5 fs-4">No players yet — be the first!</p>
        ) : (
          <ul className="lb-board list-unstyled mb-0">
            {entries.map((e, i) => (
              <li key={e.id} className={`lb-row d-flex align-items-center gap-3 px-4 py-3${MEDAL_CLASS[i] ? " " + MEDAL_CLASS[i] : ""}`}>
                <div className="flex-shrink-0 text-center" style={{ width: 52, fontSize: "clamp(24px, 3vw, 40px)" }}>
                  {i < 3
                    ? MEDALS[i]
                    : <span className="sn text-muted fw-semibold fs-6">#{i + 1}</span>}
                </div>
                <div className="flex-grow-1 min-w-0">
                  <div className="dp lb-name">{e.name}</div>
                  {e.email && (
                    <div className="sn text-muted text-truncate" style={{ fontSize: 12 }}>{e.email}</div>
                  )}
                  <div className="sn small text-muted mt-1">
                    {e.emoji} {e.title} · ⏱ {formatDuration(e.duration_ms)}
                  </div>
                </div>
                <div className="text-end flex-shrink-0">
                  <div className="dp lb-score">{e.score}</div>
                  <div className="sn text-muted" style={{ fontSize: 11 }}>/ {MAX_SCORE}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
