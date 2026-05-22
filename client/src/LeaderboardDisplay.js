import { useState, useEffect } from "react";
import { fetchLeaderboard } from "./api";
import "./styles/Leaderboard.css";

const MAX_SCORE = 6 * 25;
const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardDisplay() {
  const [entries, setEntries]       = useState([]);
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
    <div className="lb-page">
      <div className="lb-spotlight" />

      <div className="lb-inner">
        <div className="lb-header">
          <h1 className="lb-title">🏆 Comedy Rankings</h1>
          <p className="sn lb-sub">Know Your Humour Quotient · Ranked by Score</p>
        </div>

        <div className="lb-live">
          <span className="lb-live-dot" />
          Live{lastUpdated ? ` · updated ${lastUpdated}` : ""} · refreshes every 10 min
        </div>

        {entries.length === 0 ? (
          <p className="lb-empty">No players yet — be the first!</p>
        ) : (
          entries.map((e, i) => (
            <div key={e.id} className={`lb-board-row${i === 0 ? " gold" : ""}`}>
              <div className="lb-medal">
                {i < 3
                  ? MEDALS[i]
                  : <span className="sn lb-rank-num">#{i + 1}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div className="dp lb-name">{e.name}</div>
                <div className="sn lb-title-line">{e.emoji} {e.title} · {e.time}</div>
              </div>
              <div>
                <div className="dp lb-score">{e.score}</div>
                <div className="sn lb-out-of">/ {MAX_SCORE}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
