import { useState, useEffect } from "react";

const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const MAX_SCORE = 6 * 25;
const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardDisplay() {
  const [entries, setEntries] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function refresh() {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      const data = await res.json();
      setEntries(data.leaderboard || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {}
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#0b0914", color: "#f0e6d0",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "48px 24px", fontFamily: "Georgia, serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600&display=swap');
        .dp  { font-family: 'Playfair Display', Georgia, serif; }
        .sn  { font-family: 'DM Sans', sans-serif; }
        .row {
          display: flex; align-items: center; gap: 18px;
          background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.06);
          border-radius: 18px; padding: 18px 24px; margin-bottom: 12px;
          transition: border-color .3s;
          animation: fadeIn .4s ease forwards;
        }
        .row.gold { border-color: rgba(245,158,11,.45); background: rgba(245,158,11,.04); }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.5} }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        .spotlight {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 70% 35% at 50% 0%, rgba(245,158,11,.08) 0%, transparent 65%),
            radial-gradient(ellipse 35% 45% at 90% 90%, rgba(167,139,250,.05) 0%, transparent 60%);
        }
      `}</style>

      <div className="spotlight" />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 680 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h1 className="dp" style={{
            fontSize: "clamp(40px, 7vw, 80px)", margin: 0, lineHeight: 1.05,
            background: "linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            🏆 Comedy Rankings
          </h1>
          <p className="sn" style={{ color: "#4a4060", fontSize: 15, marginTop: 10 }}>
            Know Your Humour Quotient · Ranked by Score
          </p>
        </div>

        {/* Live indicator */}
        <div className="sn" style={{ textAlign: "center", marginBottom: 36, fontSize: 12, color: "#3a3050" }}>
          <span className="pulse" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#22c55e", marginRight: 6, verticalAlign: "middle" }} />
          Live{lastUpdated ? ` · updated ${lastUpdated}` : ""} · refreshes every 10s
        </div>

        {/* Board */}
        {entries.length === 0 ? (
          <p className="sn" style={{ textAlign: "center", color: "#2a2040", fontSize: 20, padding: "80px 0" }}>
            No players yet — be the first!
          </p>
        ) : (
          entries.map((e, i) => (
            <div key={e.id} className={`row ${i === 0 ? "gold" : ""}`}>
              {/* Medal / rank */}
              <div style={{ fontSize: "clamp(24px, 3vw, 40px)", width: 52, textAlign: "center", flexShrink: 0 }}>
                {i < 3
                  ? MEDALS[i]
                  : <span className="sn" style={{ fontSize: 16, color: "#3a3050", fontWeight: 600 }}>#{i + 1}</span>}
              </div>

              {/* Name + title */}
              <div style={{ flex: 1 }}>
                <div className="dp" style={{ fontSize: "clamp(20px, 2.8vw, 32px)", color: i === 0 ? "#f59e0b" : "#f0e6d0" }}>
                  {e.name}
                </div>
                <div className="sn" style={{ fontSize: 13, color: "#3a3050", marginTop: 3 }}>
                  {e.emoji} {e.title} · {e.time}
                </div>
              </div>

              {/* Score */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="dp" style={{ fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1, color: i === 0 ? "#f59e0b" : "#c0b0d0" }}>
                  {e.score}
                </div>
                <div className="sn" style={{ fontSize: 11, color: "#3a3050" }}>/ {MAX_SCORE}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
