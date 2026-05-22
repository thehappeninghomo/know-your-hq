import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLeaderboard, saveScore, callClaude, callGemini, callOpenAI } from "./api";
import "./styles/App.css";

// ── Option types ──────────────────────────────────────────────────────────────
const OPTION_TYPES = {
  FUNNY:    { points: 25, color: "#D22D1E", label: "😂 Genuinely Funny",    key: "funny"     },
  SAFE:     { points: 10, color: "#4A7AE0", label: "😐 Safe & Boring",      key: "safe"      },
  SARCASTIC:{ points: 18, color: "#963AB1", label: "😏 Sarcastic",          key: "sarcastic" },
  UNHINGED: { points: 15, color: "#C4356A", label: "🤪 Completely Unhinged", key: "unhinged"  },
};

const QUESTIONS_PROMPT = `Generate 6 funny scenario questions for a comedy game called "Know Your Humour Quotient". Each has 4 answer options.

Return ONLY a valid JSON array. No markdown, no explanation, just the array. Use this exact shape:
[
  {
    "scenario": "The funny scenario question (1-2 sentences, relatable, office/social situations)",
    "options": [
      { "type": "FUNNY",     "text": "The clever, genuinely funny answer that shows wit (max 20 words)" },
      { "type": "SAFE",      "text": "The boring, predictable, overly professional answer (max 20 words)" },
      { "type": "SARCASTIC", "text": "The dry, sarcastic answer dripping with irony (max 20 words)" },
      { "type": "UNHINGED",  "text": "The completely unhinged, chaotic, nonsensical answer (max 20 words)" }
    ],
    "reaction": {
      "FUNNY":     "Short funny reaction when they pick this answer (max 12 words)",
      "SAFE":      "Gently roast their boring choice (max 12 words)",
      "SARCASTIC": "Appreciate the sarcasm (max 12 words)",
      "UNHINGED":  "React to the chaos (max 12 words)"
    }
  }
]

Mix scenarios: office disasters, awkward social moments, absurd everyday situations, tech gone wrong, food emergencies, public transport chaos. Indian-office-culture friendly where possible.
Shuffle option order randomly. Return only the JSON array.`;

function parseQuestions(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return FALLBACK_QUESTIONS;
  }
}

async function generateQuestions(provider = "claude") {
  if (provider === "gemini") {
    const data = await callGemini({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: QUESTIONS_PROMPT }] }],
      generationConfig: { temperature: 1.0 },
    });
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
    return parseQuestions(raw);
  }

  if (provider === "openai") {
    const data = await callOpenAI({
      model: "gpt-4o",
      temperature: 1.0,
      messages: [
        { role: "system", content: `You generate questions for a comedy game called "Know Your Humour Quotient". Return ONLY a valid JSON array. No markdown, no explanation, just the array.` },
        { role: "user", content: QUESTIONS_PROMPT },
      ],
    });
    const raw = data.choices?.[0]?.message?.content?.trim() || "[]";
    return parseQuestions(raw);
  }

  const data = await callClaude({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    system: `You generate questions for a comedy game called "Know Your Humour Quotient". Return ONLY a valid JSON array. No markdown, no explanation, just the array.`,
    messages: [{ role: "user", content: QUESTIONS_PROMPT }],
  });
  const raw = data.content?.find(b => b.type === "text")?.text?.trim() || "[]";
  return parseQuestions(raw);
}

// ── Fallback questions ────────────────────────────────────────────────────────
const FALLBACK_QUESTIONS = [
  {
    scenario: "You accidentally liked your ex's 3-year-old Instagram photo at 2am. They've seen it. What do you do?",
    options: [
      { type: "FUNNY",     text: "Like 47 more photos immediately. Commit to the bit." },
      { type: "SAFE",      text: "Quickly unlike it and pretend nothing happened." },
      { type: "SARCASTIC", text: "Send them a LinkedIn connection request to balance it out." },
      { type: "UNHINGED",  text: "Delete Instagram, move cities, adopt a new identity." },
    ],
    reaction: { FUNNY: "Chaotic but respect — you own your mistakes!", SAFE: "Classic ostrich energy. They definitely saw it.", SARCASTIC: "The professional pivot no one asked for. Chef's kiss.", UNHINGED: "Extreme? Yes. Effective? Also yes." }
  },
  {
    scenario: "Your boss asks 'Any ideas?' and you accidentally say your lunch order out loud.",
    options: [
      { type: "SARCASTIC", text: "Maintain eye contact. Slowly nod. 'Yes. Those are my ideas.'" },
      { type: "FUNNY",     text: "Pivot: 'The dal makhani strategy — rich, slow-cooked, long-term thinking.'" },
      { type: "SAFE",      text: "Apologise and say you were thinking about something else." },
      { type: "UNHINGED",  text: "Stand up, leave, come back with actual dal makhani for everyone." },
    ],
    reaction: { SARCASTIC: "Legendary power move. The silence must have been deafening.", FUNNY: "You turned lunch into business strategy. Promoted.", SAFE: "Missed a golden opportunity there, chief.", UNHINGED: "You solved morale AND lunch. Visionary." }
  },
  {
    scenario: "A pigeon walks into your video call and sits directly in front of your camera.",
    options: [
      { type: "UNHINGED",  text: "Introduce the pigeon as your co-founder. Give it screen time." },
      { type: "FUNNY",     text: "That's Dave from product. He doesn't talk much but has great instincts." },
      { type: "SAFE",      text: "Shoo it away and apologise for the disruption." },
      { type: "SARCASTIC", text: "At least Dave shows up on time, unlike the rest of the team." },
    ],
    reaction: { UNHINGED: "Investors love a founder story.", FUNNY: "Dave now has a better reputation than half your team.", SAFE: "Dave wanted to be seen. You denied him that.", SARCASTIC: "Dave's attendance record is impeccable, to be fair." }
  },
  {
    scenario: "You send a meme to your work WhatsApp group by mistake. The CEO reacts with 👀.",
    options: [
      { type: "FUNNY",     text: "Reply: 'Glad we're aligned on company culture, sir.'" },
      { type: "SAFE",      text: "Send a formal apology and say it was meant for another group." },
      { type: "SARCASTIC", text: "React back with 👀 and see who blinks first." },
      { type: "UNHINGED",  text: "Double down. Send five more memes. Make it a vibe." },
    ],
    reaction: { FUNNY: "Reframed a disaster as culture-building. Impressive.", SAFE: "The safe choice. Also the boring one.", SARCASTIC: "A staring contest with the CEO. The audacity.", UNHINGED: "You either get fired or become VP of Culture. No in-between." }
  },
  {
    scenario: "Your phone rings loudly in a silent cinema during the most emotional scene.",
    options: [
      { type: "SAFE",      text: "Immediately silence it and sink into your seat in shame." },
      { type: "SARCASTIC", text: "Whisper: 'Can't talk, someone's dying onscreen too.'" },
      { type: "UNHINGED",  text: "Answer it. Put it on speaker. It's your mom. Let her talk." },
      { type: "FUNNY",     text: "Let it ring once more dramatically, then whisper 'It was the killer.'" },
    ],
    reaction: { SAFE: "The crowd forgave you. Barely.", SARCASTIC: "Context-aware. Rude but context-aware.", UNHINGED: "Your mom is now part of the cinematic experience.", FUNNY: "You improved the film. The director owes you royalties." }
  },
  {
    scenario: "You walk into the wrong meeting room mid-presentation. 15 strangers stare at you.",
    options: [
      { type: "FUNNY",     text: "Grab a marker and write a number on the whiteboard. 'As I was saying.'" },
      { type: "SAFE",      text: "Apologise quietly and back out of the room." },
      { type: "UNHINGED",  text: "Sit down. Take notes. Stay for the whole thing. Network after." },
      { type: "SARCASTIC", text: "Say 'Great, I see you've all reviewed my pre-read.' Sit down." },
    ],
    reaction: { FUNNY: "You claimed authority over a room that wasn't yours. Legend.", SAFE: "Technically correct. Spiritually defeated.", UNHINGED: "You attended a meeting AND made new friends. Efficient.", SARCASTIC: "The pre-read bluff. A classic power move." }
  },
];

// ── HQ title ──────────────────────────────────────────────────────────────────
function getHQTitle(score, maxScore) {
  const pct = score / maxScore;
  if (pct >= 0.88) return { title: "COMEDY LEGEND",      sub: "You could headline a show.",       emoji: "🌟", color: "#D22D1E" };
  if (pct >= 0.72) return { title: "CERTIFIED FUNNY",    sub: "The room genuinely loves you.",     emoji: "😂", color: "#C4356A" };
  if (pct >= 0.55) return { title: "WIT WITH POTENTIAL", sub: "Good instincts, needs polish.",     emoji: "😄", color: "#963AB1" };
  if (pct >= 0.38) return { title: "ACCIDENTAL COMIC",   sub: "Funny without meaning to be.",      emoji: "🙃", color: "#963AB1" };
  if (pct >= 0.20) return { title: "HUMOUR PADAWAN",     sub: "The force is… still loading.",      emoji: "🙂", color: "#4A7AE0" };
  return              { title: "CHRONICALLY SERIOUS",    sub: "Have you tried laughing once?",      emoji: "😑", color: "#4A4455" };
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  const pieces = useRef(Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ["#D22D1E","#963AB1","#20469B","#C4356A","#4A7AE0","#fff","#A82418","#7B2D9A"][i % 8],
    delay: Math.random() * 1.4,
    size: 7 + Math.random() * 7,
    dur: 1.6 + Math.random() * 1.2,
  })));
  if (!active) return null;
  return (
    <div className="confetti-wrap">
      {pieces.current.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.x}%`,
          width: p.size,
          height: p.size,
          background: p.color,
          animation: `confettiFall ${p.dur}s ease ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Timer ring ────────────────────────────────────────────────────────────────
function TimerRing({ value, max = 30 }) {
  const r = 26, circ = 2 * Math.PI * r;
  const color = value > 15 ? "#D22D1E" : value > 8 ? "#963AB1" : "#C4356A";
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="#1A181B" strokeWidth={5} />
      <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - value / max)}
        strokeLinecap="round" transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }} />
      <text x={32} y={37} textAnchor="middle" fill={color}
        style={{ fontFamily: "serif", fontSize: 18, fontWeight: 700 }}>{value}</text>
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const icons = { error: "✗", warning: "⚡", info: "✦" };
  return (
    <div className={`toast ${toast.type}`}>
      <span className="toast-icon">{icons[toast.type] || "✦"}</span>
      <p className="toast-msg">{toast.message}</p>
      <button className="toast-close" onClick={onDismiss}>×</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const navigate = useNavigate();
  const [screen, setScreen]           = useState("home");
  const [name, setName]               = useState("");
  const [provider, setProvider]       = useState("claude");
  const [questions, setQuestions]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [toast, setToast]             = useState(null);
  const [qIdx, setQIdx]               = useState(0);
  const [chosen, setChosen]           = useState(null);
  const [scores, setScores]           = useState([]);
  const [totalScore, setTotalScore]   = useState(0);
  const [timeLeft, setTimeLeft]       = useState(30);
  const [timerOn, setTimerOn]         = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [animKey, setAnimKey]         = useState(0);
  const finalScoreRef                 = useRef(0);
  const timerRef                      = useRef(null);

  const MAX_SCORE = 6 * 25;

  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard).catch(() => {});
  }, []);

  useEffect(() => {
    if (!timerOn) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          const q = questions[qIdx];
          if (q) {
            const safe = q.options.find(o => o.type === "SAFE") || q.options[0];
            handlePick(safe);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerOn, qIdx]); // eslint-disable-line

  function stopTimer()  { setTimerOn(false); clearInterval(timerRef.current); }
  function startTimer() { setTimeLeft(30); setTimerOn(true); }

  async function startGame() {
    if (!name.trim()) return;
    setLoading(true);
    setScreen("loading");
    let qs;
    try {
      qs = await generateQuestions(provider);
    } catch {
      qs = FALLBACK_QUESTIONS;
      const label = provider === "claude" ? "Claude" : provider === "gemini" ? "Gemini" : "OpenAI";
      setToast({ type: "warning", message: `${label} unavailable — using built-in questions` });
    }
    setLoading(false);
    setQuestions(qs);
    setQIdx(0); setScores([]); setTotalScore(0); setChosen(null);
    finalScoreRef.current = 0;
    setScreen("game");
    setAnimKey(k => k + 1);
    startTimer();
  }

  function handlePick(option) {
    stopTimer();
    if (chosen) return;
    setChosen(option);
  }

  async function handleNext() {
    const pts = chosen ? OPTION_TYPES[chosen.type].points : 0;
    const newTotal = totalScore + pts;
    setScores(prev => [...prev, { type: chosen?.type || "SAFE", pts }]);
    setTotalScore(newTotal);

    if (qIdx + 1 >= questions.length) {
      finalScoreRef.current = newTotal;
      const hq = getHQTitle(newTotal, MAX_SCORE);
      if (newTotal >= MAX_SCORE * 0.55) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
      const entry = {
        name: name.trim(), score: newTotal,
        title: hq.title, emoji: hq.emoji,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      try {
        const updated = await saveScore(entry);
        setLeaderboard(updated);
      } catch {
        setLeaderboard(lb => [...lb, { ...entry, id: Date.now() }].sort((a, b) => b.score - a.score).slice(0, 10));
      }
      setScreen("result");
      return;
    }

    setQIdx(i => i + 1);
    setChosen(null);
    setAnimKey(k => k + 1);
    startTimer();
  }

  const q = questions[qIdx];
  const displayFinalScore = finalScoreRef.current > 0
    ? finalScoreRef.current
    : scores.reduce((s, r) => s + r.pts, 0) + (chosen ? OPTION_TYPES[chosen.type]?.points || 0 : 0);
  const hqInfo = getHQTitle(displayFinalScore, MAX_SCORE);
  const myRank = leaderboard.findIndex(e => e.name === name.trim() && e.score === displayFinalScore) + 1;
  const allScores = scores.concat(chosen ? [{ type: chosen.type }] : []);
  const styleCount = allScores.reduce((a, s) => { a[s.type] = (a[s.type] || 0) + 1; return a; }, {});
  const dominantStyle = Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "FUNNY";

  return (
    <div className="app-wrap">
      <div className="spotlight" />
      <Confetti active={showConfetti} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ── HOME ─────────────────────────────────────────────────────────────── */}
      {screen === "home" && (
        <div className="card slide-up">
          <div className="home-header">
            <div style={{ fontSize: 52, marginBottom: 10 }}>🎭</div>
            <h1 className="dp curtain home-title">Know Your<br />Humour Quotient</h1>
            <p className="sn home-sub">
              6 wild scenarios. 4 options each — funny, boring, sarcastic, unhinged.<br />
              <strong>Can you spot the funny answer? 😏</strong>
            </p>
          </div>

          <div className="type-grid">
            {Object.entries(OPTION_TYPES).map(([key, val]) => (
              <div key={key} className={`type-card ${val.key}`}>
                <div style={{ fontSize: 20 }}>{val.label.split(" ")[0]}</div>
                <div>
                  <div className={`sn type-label ${val.key}`}>{val.label.slice(3)}</div>
                  <div className="sn type-pts">+{val.points} pts (revealed after pick)</div>
                </div>
              </div>
            ))}
          </div>

          <div className="field-wrap">
            <label className="sn field-label">AI MODEL</label>
            <div className="provider-row">
              {[{ id: "claude", label: "Claude" }, { id: "gemini", label: "Gemini" }, { id: "openai", label: "OpenAI" }].map(({ id, label }) => (
                <button key={id} className={`provider-btn ${provider === id ? "active" : ""}`} onClick={() => setProvider(id)}>
                  ✦ {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-wrap">
            <label className="sn field-label">YOUR STAGE NAME</label>
            <input className="name-input" placeholder="Enter your name…" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && name.trim() && !loading && startGame()}
              maxLength={20} autoFocus />
          </div>

          <button className="btn-main" onClick={startGame} disabled={!name.trim() || loading}>
            {loading ? "Loading…" : "Take The Stage ▶"}
          </button>
          <button className="btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("/leaderboard")}>
            🏆 Leaderboard{leaderboard.length > 0 ? ` (${leaderboard.length} players)` : ""}
          </button>
        </div>
      )}

      {/* ── LOADING ──────────────────────────────────────────────────────────── */}
      {screen === "loading" && (
        <div className="card loading-card">
          <div className="loading-emoji">🤖</div>
          <h2 className="dp loading-title">Cooking up chaos…</h2>
          <p className="sn loading-sub">Generating fresh scenarios just for you</p>
          <div className="think-dots"><span /><span /><span /></div>
        </div>
      )}

      {/* ── GAME ─────────────────────────────────────────────────────────────── */}
      {screen === "game" && q && (
        <div className="card slide-up" key={animKey}>
          <div className="game-header">
            <div>
              <div className="sn game-counter-label">QUESTION</div>
              <div className="dp game-counter-value">
                {qIdx + 1} <span className="game-counter-total">/ {questions.length}</span>
              </div>
            </div>
            <TimerRing value={timeLeft} max={30} />
            <div>
              <div className="sn game-score-label">SCORE</div>
              <div className="dp game-score-value">{totalScore}</div>
            </div>
          </div>

          <div className="progress-row">
            {questions.map((_, i) => (
              <div key={i} className={`progress-dot${i < qIdx ? " done" : i === qIdx ? " current" : ""}`}
                style={{ flex: i === qIdx ? 2.5 : 1 }} />
            ))}
          </div>

          <div className="scenario-box">
            <div className="sn scenario-eyebrow">THE SCENARIO</div>
            <p className="dp scenario-text">"{q.scenario}"</p>
          </div>

          <div className={`options-list${chosen ? " has-chosen" : ""}`}>
            {q.options.map((opt, i) => {
              const st = OPTION_TYPES[opt.type];
              const isChosen  = chosen?.type === opt.type;
              const revealed  = !!chosen;
              return (
                <button key={i}
                  className={`opt-btn${revealed ? ` ${st.key}` : ""}${isChosen ? " chosen" : ""}${revealed && !isChosen ? " dimmed" : ""}`}
                  style={isChosen ? { boxShadow: `0 0 20px ${st.color}30` } : {}}
                  onClick={() => handlePick(opt)}
                  disabled={!!chosen}
                >
                  {revealed && (
                    <span className={`opt-type-badge ${st.key}`}>{st.label}</span>
                  )}
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {chosen && (
            <div className={`reaction-box pop ${OPTION_TYPES[chosen.type].key}`}>
              <div>
                <div className={`sn reaction-verdict ${OPTION_TYPES[chosen.type].key}`}>
                  {chosen.type === "FUNNY" ? "COMEDY GOLD" : chosen.type === "SAFE" ? "PLAYS IT SAFE" : chosen.type === "SARCASTIC" ? "SNARKY GENIUS" : "CERTIFIED CHAOS"}
                </div>
                <p className="dp reaction-text">"{q.reaction?.[chosen.type] || "Interesting choice."}"</p>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div className={`dp reaction-pts-value`} style={{ color: OPTION_TYPES[chosen.type].color }}>
                  +{OPTION_TYPES[chosen.type].points}
                </div>
                <div className="sn reaction-pts-label">pts</div>
              </div>
            </div>
          )}

          {chosen && (
            <button className="btn-main" onClick={handleNext}>
              {qIdx + 1 >= questions.length ? "See My HQ Score →" : "Next Question →"}
            </button>
          )}

          <div className="sn game-player-name">{name}</div>
        </div>
      )}

      {/* ── RESULT ───────────────────────────────────────────────────────────── */}
      {screen === "result" && (
        <div className="card slide-up result-card">
          <div className="sn result-who">{name.toUpperCase()} · YOUR RESULTS</div>
          <div className="result-emoji">{hqInfo.emoji}</div>
          <h2 className="dp curtain result-title">{hqInfo.title}</h2>
          <p className="sn result-sub">{hqInfo.sub}</p>

          <div className="score-box">
            <div className="sn score-box-label">HUMOUR QUOTIENT</div>
            <div className="dp score-big">{displayFinalScore}</div>
            <div className="sn score-out-of">out of {MAX_SCORE}</div>
            <div className="score-bar-wrap">
              <div className="score-bar-fill" style={{
                width: `${(displayFinalScore / MAX_SCORE) * 100}%`,
                background: `linear-gradient(90deg, ${hqInfo.color}, #963AB1)`,
                boxShadow: `0 0 12px ${hqInfo.color}60`,
              }} />
            </div>
          </div>

          {dominantStyle && OPTION_TYPES[dominantStyle] && (
            <div className="dna-wrap">
              <div className="sn dna-label">YOUR HUMOUR DNA</div>
              <span className={`dna-badge ${OPTION_TYPES[dominantStyle].key}`}>
                {OPTION_TYPES[dominantStyle].label}
              </span>
            </div>
          )}

          <div className="rounds-wrap">
            <div className="sn rounds-label">ROUND BY ROUND</div>
            {scores.map((s, i) => {
              const st = OPTION_TYPES[s.type];
              return (
                <div key={i} className="round-row">
                  <div className="sn round-num">Q{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <span className={`round-badge ${st.key}`}>{st.label}</span>
                  </div>
                  <div className={`dp round-pts ${st.key}`}>+{s.pts}</div>
                </div>
              );
            })}
          </div>

          {myRank > 0 && (
            <div className={`rank-badge${myRank <= 3 ? " top3" : ""}`}>
              <span className="sn rank-badge-text">
                {myRank === 1 ? "🥇 Top of the leaderboard!" : myRank === 2 ? "🥈 So close to #1!" : myRank === 3 ? "🥉 Top 3!" : `#${myRank} on leaderboard`}
              </span>
              <span className="dp rank-badge-num">#{myRank}</span>
            </div>
          )}

          <div className="result-actions">
            <button className="btn-main" style={{ flex: 1 }} onClick={() => setScreen("home")}>Play Again ↺</button>
            <button className="btn-ghost" onClick={() => navigate("/leaderboard")}>🏆 Board</button>
          </div>
        </div>
      )}
    </div>
  );
}
