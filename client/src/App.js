import { useState, useEffect, useRef } from "react";

// ── API base — reads from env, falls back to same-origin proxy ────────────────
const API_BASE = process.env.REACT_APP_API_URL || "";

async function fetchLeaderboard() {
  const res = await fetch(`${API_BASE}/api/leaderboard`);
  const data = await res.json();
  return data.leaderboard || [];
}

// ── Claude API helper — calls OUR backend, not Anthropic directly ─────────────
async function callClaude(body) {
  const res = await fetch(`${API_BASE}/api/claude`, {
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

// ── OpenAI API helper — calls OUR backend, not OpenAI directly ───────────────
async function callOpenAI(body) {
  const res = await fetch(`${API_BASE}/api/openai`, {
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

// ── Gemini API helper — calls OUR backend, not Google directly ────────────────
async function callGemini(body) {
  const res = await fetch(`${API_BASE}/api/gemini`, {
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

// ── Option types ──────────────────────────────────────────────────────────────
const OPTION_TYPES = {
  FUNNY:    { points: 25, color: "#f59e0b", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.3)",  label: "😂 Genuinely Funny"   },
  SAFE:     { points: 10, color: "#60a5fa", bg: "rgba(96,165,250,.08)", border: "rgba(96,165,250,.25)", label: "😐 Safe & Boring"      },
  SARCASTIC:{ points: 18, color: "#a78bfa", bg: "rgba(167,139,250,.1)", border: "rgba(167,139,250,.3)", label: "😏 Sarcastic"          },
  UNHINGED: { points: 15, color: "#f472b6", bg: "rgba(244,114,182,.1)", border: "rgba(244,114,182,.3)", label: "🤪 Completely Unhinged" },
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

// ── Generate questions via backend proxy ──────────────────────────────────────
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
        {
          role: "system",
          content: `You generate questions for a comedy game called "Know Your Humour Quotient".
Return ONLY a valid JSON array. No markdown, no explanation, just the array.`,
        },
        { role: "user", content: QUESTIONS_PROMPT },
      ],
    });
    const raw = data.choices?.[0]?.message?.content?.trim() || "[]";
    return parseQuestions(raw);
  }

  const data = await callClaude({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    system: `You generate questions for a comedy game called "Know Your Humour Quotient".
Return ONLY a valid JSON array. No markdown, no explanation, just the array.`,
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

// ── HQ Title ──────────────────────────────────────────────────────────────────
function getHQTitle(score, maxScore) {
  const pct = score / maxScore;
  if (pct >= 0.88) return { title: "COMEDY LEGEND",      sub: "You could headline a show.",       emoji: "🌟", color: "#f59e0b" };
  if (pct >= 0.72) return { title: "CERTIFIED FUNNY",    sub: "The room genuinely loves you.",     emoji: "😂", color: "#fb923c" };
  if (pct >= 0.55) return { title: "WIT WITH POTENTIAL", sub: "Good instincts, needs polish.",     emoji: "😄", color: "#f472b6" };
  if (pct >= 0.38) return { title: "ACCIDENTAL COMIC",   sub: "Funny without meaning to be.",      emoji: "🙃", color: "#a78bfa" };
  if (pct >= 0.20) return { title: "HUMOUR PADAWAN",     sub: "The force is… still loading.",      emoji: "🙂", color: "#60a5fa" };
  return              { title: "CHRONICALLY SERIOUS",    sub: "Have you tried laughing once?",      emoji: "😑", color: "#94a3b8" };
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  const pieces = useRef(Array.from({ length: 70 }, (_, i) => ({
    id: i, x: Math.random() * 100,
    color: ["#f59e0b","#fbbf24","#ef4444","#ec4899","#8b5cf6","#06b6d4","#4ade80","#fff"][i % 8],
    delay: Math.random() * 1.4, size: 7 + Math.random() * 7, dur: 1.6 + Math.random() * 1.2,
  })));
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999, overflow: "hidden" }}>
      {pieces.current.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: -20, left: `${p.x}%`,
          width: p.size, height: p.size, background: p.color, borderRadius: 2,
          animation: `confettiFall ${p.dur}s ease ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Timer ring ────────────────────────────────────────────────────────────────
function TimerRing({ value, max = 30 }) {
  const r = 26, circ = 2 * Math.PI * r;
  const color = value > 15 ? "#f59e0b" : value > 8 ? "#fb923c" : "#ef4444";
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="#1e1a30" strokeWidth={5} />
      <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - value / max)}
        strokeLinecap="round" transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }} />
      <text x={32} y={37} textAnchor="middle" fill={color}
        style={{ fontFamily: "serif", fontSize: 18, fontWeight: 700 }}>{value}</text>
    </svg>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const palette = {
    error:   { bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.35)",   icon: "✗", color: "#f87171" },
    warning: { bg: "rgba(245,158,11,.10)",  border: "rgba(245,158,11,.30)",  icon: "⚡", color: "#fbbf24" },
    info:    { bg: "rgba(96,165,250,.10)",  border: "rgba(96,165,250,.30)",  icon: "✦", color: "#93c5fd" },
  };
  const c = palette[toast.type] || palette.info;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 20, zIndex: 1000,
      width: 280,
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12,
      padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start",
      boxShadow: `0 8px 32px rgba(0,0,0,.7)`,
      animation: "toastIn .3s cubic-bezier(.2,1,.4,1) forwards",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1, color: c.color }}>{c.icon}</span>
      <p className="sn" style={{ color: c.color, fontSize: 13, margin: 0, lineHeight: 1.55, flex: 1 }}>
        {toast.message}
      </p>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: c.color, cursor: "pointer", fontSize: 18, padding: "0 2px", flexShrink: 0, opacity: 0.5, lineHeight: 1 }}>×</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
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

  // ── Load leaderboard on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard).catch(() => {});
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────────
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

  function stopTimer() { setTimerOn(false); clearInterval(timerRef.current); }
  function startTimer() { setTimeLeft(30); setTimerOn(true); }

  // ── Start game ────────────────────────────────────────────────────────────────
  async function startGame() {
    if (!name.trim()) return;
    setLoading(true);
    setScreen("loading");
    let qs;
    try {
      qs = await generateQuestions(provider);
    } catch (err) {
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

  // ── Pick option ───────────────────────────────────────────────────────────────
  function handlePick(option) {
    stopTimer();
    if (chosen) return;
    setChosen(option);
  }

  // ── Next question ─────────────────────────────────────────────────────────────
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
        const res = await fetch(`${API_BASE}/api/leaderboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
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
    <div style={{
      minHeight: "100vh", background: "#0b0914",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "20px 16px", position: "relative", overflow: "hidden",
      fontFamily: "Georgia, serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600&display=swap');
        .dp { font-family: 'Playfair Display', Georgia, serif; }
        .sn { font-family: 'DM Sans', sans-serif; }
        .spotlight { position:fixed;inset:0;pointer-events:none;z-index:0;
          background:radial-gradient(ellipse 80% 40% at 50% 0%,rgba(245,158,11,.07) 0%,transparent 65%),
                     radial-gradient(ellipse 40% 50% at 90% 90%,rgba(167,139,250,.05) 0%,transparent 60%); }
        .card { background:rgba(15,12,24,.97);border:1px solid rgba(245,158,11,.12);
          border-radius:24px;padding:32px 28px;width:100%;max-width:560px;
          position:relative;z-index:1;box-shadow:0 0 80px rgba(0,0,0,.9); }
        .opt-btn { width:100%;text-align:left;border-radius:16px;padding:16px 20px;
          cursor:pointer;border:1.5px solid;transition:all .18s;
          font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.5;
          position:relative;overflow:hidden;background:transparent; }
        .opt-btn:hover:not(:disabled) { transform:translateX(4px) scale(1.01); }
        .opt-btn:disabled { cursor:default;transform:none !important; }
        .opt-chosen { transform:translateX(6px) !important; }
        .name-input { width:100%;box-sizing:border-box;background:rgba(255,255,255,.03);
          border:1.5px solid rgba(255,255,255,.08);border-radius:14px;color:#f0e6d0;
          font-family:'DM Sans',sans-serif;padding:14px 18px;font-size:18px;outline:none;
          transition:border-color .2s,box-shadow .2s; }
        .name-input:focus { border-color:#f59e0b;box-shadow:0 0 20px rgba(245,158,11,.15); }
        .name-input::placeholder { color:#2a2540; }
        .btn-main { width:100%;padding:15px;background:linear-gradient(135deg,#f59e0b,#d97706);
          color:#0b0914;border:none;border-radius:14px;
          font-family:'Playfair Display',serif;font-size:19px;font-weight:700;
          cursor:pointer;letter-spacing:.03em;box-shadow:0 4px 24px rgba(245,158,11,.4);
          transition:all .15s; }
        .btn-main:hover { transform:translateY(-2px);box-shadow:0 8px 32px rgba(245,158,11,.5); }
        .btn-main:disabled { opacity:.3;cursor:not-allowed;transform:none; }
        .btn-ghost { padding:11px 24px;background:transparent;
          border:1.5px solid rgba(255,255,255,.08);border-radius:10px;color:#5a5270;
          font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;transition:all .15s; }
        .btn-ghost:hover { border-color:rgba(245,158,11,.4);color:#f59e0b; }
        .slide-up { animation:slideUp .4s cubic-bezier(.2,1,.4,1) forwards; }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none} }
        .pop { animation:pop .35s cubic-bezier(.34,1.56,.64,1) forwards; }
        @keyframes pop { from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)} }
        .lb-row { display:flex;align-items:center;gap:12px;padding:11px 14px;
          border-radius:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);
          margin-bottom:8px;transition:border-color .15s; }
        .lb-row.me { border-color:#f59e0b !important;background:rgba(245,158,11,.04) !important; }
        .lb-row.top { border-color:rgba(245,158,11,.35) !important; }
        .curtain { font-family:'Playfair Display',serif;
          background:linear-gradient(135deg,#f59e0b,#fbbf24,#f59e0b);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .progress-dot { height:6px;border-radius:3px;transition:all .3s; }
        .score-bar-wrap { height:8px;border-radius:4px;background:#1e1a2e;overflow:hidden;margin:8px 0; }
        .score-bar-fill { height:100%;border-radius:4px;transition:width .8s cubic-bezier(.2,1,.4,1); }
        .think-dots span { display:inline-block;width:9px;height:9px;background:#f59e0b;
          border-radius:50%;margin:0 3px;animation:db 1.2s infinite; }
        .think-dots span:nth-child(2){animation-delay:.2s}
        .think-dots span:nth-child(3){animation-delay:.4s}
        @keyframes db{0%,80%,100%{transform:scale(.7);opacity:.4}40%{transform:scale(1.2);opacity:1}}
        @keyframes toastIn { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
        @keyframes confettiFall {
          0%{transform:translateY(0) rotate(0) scaleX(1);opacity:1}
          50%{transform:translateY(50vh) rotate(360deg) scaleX(-1);opacity:.9}
          100%{transform:translateY(105vh) rotate(720deg);opacity:0}
        }
      `}</style>

      <div className="spotlight" />
      <Confetti active={showConfetti} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ── HOME ─────────────────────────────────────────────────────────────── */}
      {screen === "home" && (
        <div className="card slide-up">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>🎭</div>
            <h1 className="dp curtain" style={{ fontSize: 48, margin: 0, lineHeight: 1.05 }}>
              Know Your<br />Humour Quotient
            </h1>
            <p className="sn" style={{ color: "#4a4060", fontSize: 14, marginTop: 12, lineHeight: 1.7 }}>
              6 wild scenarios. 4 options each — funny, boring, sarcastic, unhinged.<br />
              <strong style={{ color: "#f59e0b", fontWeight: 500 }}>Can you spot the funny answer? 😏</strong>
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 28 }}>
            {Object.entries(OPTION_TYPES).map(([key, val]) => (
              <div key={key} style={{ background: val.bg, border: `1px solid ${val.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 20 }}>{val.label.split(" ")[0]}</div>
                <div>
                  <div className="sn" style={{ fontSize: 12, fontWeight: 600, color: val.color }}>{val.label.slice(3)}</div>
                  <div className="sn" style={{ fontSize: 11, color: "#3a3050" }}>+{val.points} pts (revealed after pick)</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="sn" style={{ fontSize: 11, color: "#3a3050", letterSpacing: ".1em", display: "block", marginBottom: 8 }}>AI MODEL</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "claude", label: "Claude", icon: "✦" }, { id: "gemini", label: "Gemini", icon: "✦" }, { id: "openai", label: "OpenAI", icon: "✦" }].map(({ id, label, icon }) => (
                <button key={id} onClick={() => setProvider(id)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${provider === id ? "#f59e0b" : "rgba(255,255,255,.08)"}`,
                  background: provider === id ? "rgba(245,158,11,.1)" : "transparent",
                  color: provider === id ? "#f59e0b" : "#3a3050",
                  transition: "all .15s",
                }}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="sn" style={{ fontSize: 11, color: "#3a3050", letterSpacing: ".1em", display: "block", marginBottom: 8 }}>YOUR STAGE NAME</label>
            <input className="name-input" placeholder="Enter your name…" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && name.trim() && !loading && startGame()}
              maxLength={20} autoFocus />
          </div>

          <button className="btn-main" onClick={startGame} disabled={!name.trim() || loading}>
            {loading ? "Loading…" : "Take The Stage ▶"}
          </button>

          {leaderboard.length > 0 && (
            <button className="btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => setScreen("leaderboard")}>
              🏆 Leaderboard ({leaderboard.length} players)
            </button>
          )}
        </div>
      )}

      {/* ── LOADING ──────────────────────────────────────────────────────────── */}
      {screen === "loading" && (
        <div className="card" style={{ textAlign: "center", padding: "60px 32px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <h2 className="dp" style={{ fontSize: 28, color: "#f0e6d0", margin: "0 0 12px" }}>Cooking up chaos…</h2>
          <p className="sn" style={{ color: "#4a4060", marginBottom: 28 }}>Generating fresh scenarios just for you</p>
          <div className="think-dots"><span /><span /><span /></div>
        </div>
      )}

      {/* ── GAME ─────────────────────────────────────────────────────────────── */}
      {screen === "game" && q && (
        <div className="card" key={animKey} style={{ animation: "slideUp .4s cubic-bezier(.2,1,.4,1) forwards" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div className="sn" style={{ fontSize: 10, color: "#3a3050", letterSpacing: ".12em" }}>QUESTION</div>
              <div className="dp" style={{ fontSize: 26, color: "#f0e6d0" }}>
                {qIdx + 1} <span style={{ color: "#2a2040", fontSize: 16 }}>/ {questions.length}</span>
              </div>
            </div>
            <TimerRing value={timeLeft} max={30} />
            <div style={{ textAlign: "right" }}>
              <div className="sn" style={{ fontSize: 10, color: "#3a3050", letterSpacing: ".12em" }}>SCORE</div>
              <div className="dp" style={{ fontSize: 26, color: "#f59e0b" }}>{totalScore}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {questions.map((_, i) => (
              <div key={i} className="progress-dot" style={{
                flex: i === qIdx ? 2.5 : 1,
                background: i < qIdx ? "#f59e0b" : i === qIdx ? "rgba(245,158,11,.5)" : "#1e1a2e",
              }} />
            ))}
          </div>

          <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.14)", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
            <div className="sn" style={{ fontSize: 10, color: "#f59e0b", letterSpacing: ".15em", marginBottom: 8 }}>THE SCENARIO</div>
            <p className="dp" style={{ fontSize: 18, color: "#f0e6d0", margin: 0, lineHeight: 1.55, fontStyle: "italic" }}>
              "{q.scenario}"
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: chosen ? 16 : 0 }}>
            {q.options.map((opt, i) => {
              const style = OPTION_TYPES[opt.type];
              const isChosen = chosen?.type === opt.type;
              const revealed = !!chosen;
              return (
                <button key={i}
                  className={`opt-btn ${isChosen ? "opt-chosen" : ""}`}
                  style={{
                    background: revealed ? (isChosen ? style.bg : "rgba(255,255,255,.01)") : "rgba(255,255,255,.03)",
                    borderColor: revealed ? (isChosen ? style.color : "rgba(255,255,255,.06)") : "rgba(255,255,255,.1)",
                    color: revealed ? (isChosen ? style.color : "#3a3050") : "#d0c8e0",
                    boxShadow: isChosen ? `0 0 20px ${style.color}30` : "none",
                    opacity: revealed && !isChosen ? 0.4 : 1,
                  }}
                  onClick={() => handlePick(opt)}
                  disabled={!!chosen}
                >
                  {revealed && (
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", padding: "2px 8px", borderRadius: 4, marginBottom: 6, display: "inline-block", background: isChosen ? `${style.color}25` : "rgba(255,255,255,.04)", color: isChosen ? style.color : "#3a3050" }}>
                      {style.label}
                    </div>
                  )}
                  <div>{opt.text}</div>
                </button>
              );
            })}
          </div>

          {chosen && (
            <div className="pop" style={{ background: OPTION_TYPES[chosen.type].bg, border: `1.5px solid ${OPTION_TYPES[chosen.type].border}`, borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div>
                <div className="sn" style={{ fontSize: 10, color: OPTION_TYPES[chosen.type].color, letterSpacing: ".1em", marginBottom: 4 }}>
                  {chosen.type === "FUNNY" ? "COMEDY GOLD" : chosen.type === "SAFE" ? "PLAYS IT SAFE" : chosen.type === "SARCASTIC" ? "SNARKY GENIUS" : "CERTIFIED CHAOS"}
                </div>
                <p className="dp" style={{ fontSize: 15, color: "#f0e6d0", margin: 0, fontStyle: "italic", lineHeight: 1.4 }}>
                  "{q.reaction?.[chosen.type] || "Interesting choice."}"
                </p>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div className="dp" style={{ fontSize: 32, color: OPTION_TYPES[chosen.type].color, lineHeight: 1 }}>+{OPTION_TYPES[chosen.type].points}</div>
                <div className="sn" style={{ fontSize: 10, color: "#3a3050" }}>pts</div>
              </div>
            </div>
          )}

          {chosen && (
            <button className="btn-main" onClick={handleNext}>
              {qIdx + 1 >= questions.length ? "See My HQ Score →" : "Next Question →"}
            </button>
          )}

          <div className="sn" style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#2a2040" }}>{name}</div>
        </div>
      )}

      {/* ── RESULT ───────────────────────────────────────────────────────────── */}
      {screen === "result" && (
        <div className="card slide-up" style={{ textAlign: "center" }}>
          <div className="sn" style={{ fontSize: 11, letterSpacing: ".25em", color: "#3a3050", marginBottom: 10 }}>{name.toUpperCase()} · YOUR RESULTS</div>
          <div style={{ fontSize: 56, marginBottom: 4 }}>{hqInfo.emoji}</div>
          <h2 className="dp curtain" style={{ fontSize: 40, margin: "0 0 6px", lineHeight: 1.1 }}>{hqInfo.title}</h2>
          <p className="sn" style={{ color: "#4a4060", fontSize: 14, marginBottom: 20 }}>{hqInfo.sub}</p>

          <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.18)", borderRadius: 18, padding: "22px", marginBottom: 20 }}>
            <div className="sn" style={{ fontSize: 10, color: "#f59e0b", letterSpacing: ".2em", marginBottom: 6 }}>HUMOUR QUOTIENT</div>
            <div className="dp" style={{ fontSize: 72, color: "#f0e6d0", lineHeight: 1 }}>{displayFinalScore}</div>
            <div className="sn" style={{ fontSize: 13, color: "#3a3050", marginBottom: 10 }}>out of {MAX_SCORE}</div>
            <div className="score-bar-wrap">
              <div className="score-bar-fill" style={{ width: `${(displayFinalScore / MAX_SCORE) * 100}%`, background: `linear-gradient(90deg, ${hqInfo.color}, ${hqInfo.color}cc)`, boxShadow: `0 0 12px ${hqInfo.color}60` }} />
            </div>
          </div>

          {dominantStyle && OPTION_TYPES[dominantStyle] && (
            <div style={{ marginBottom: 20 }}>
              <div className="sn" style={{ fontSize: 11, color: "#3a3050", letterSpacing: ".1em", marginBottom: 8 }}>YOUR HUMOUR DNA</div>
              <span style={{ display: "inline-block", padding: "8px 20px", background: OPTION_TYPES[dominantStyle].bg, border: `1px solid ${OPTION_TYPES[dominantStyle].border}`, borderRadius: 99, color: OPTION_TYPES[dominantStyle].color, fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600 }}>
                {OPTION_TYPES[dominantStyle].label}
              </span>
            </div>
          )}

          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <div className="sn" style={{ fontSize: 10, color: "#3a3050", letterSpacing: ".1em", marginBottom: 10 }}>ROUND BY ROUND</div>
            {scores.map((s, i) => {
              const st = OPTION_TYPES[s.type];
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
                  <div className="sn" style={{ fontSize: 11, color: "#2a2040", width: 20 }}>Q{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{st.label}</span>
                  </div>
                  <div className="dp" style={{ fontSize: 18, color: st.color }}>+{s.pts}</div>
                </div>
              );
            })}
          </div>

          {myRank > 0 && (
            <div style={{ background: myRank === 1 ? "rgba(245,158,11,.07)" : "rgba(255,255,255,.02)", border: `1px solid ${myRank <= 3 ? "rgba(245,158,11,.3)" : "rgba(255,255,255,.05)"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="sn" style={{ fontSize: 14, color: "#c0b0d0" }}>
                {myRank === 1 ? "🥇 Top of the leaderboard!" : myRank === 2 ? "🥈 So close to #1!" : myRank === 3 ? "🥉 Top 3!" : `#${myRank} on leaderboard`}
              </span>
              <span className="dp" style={{ fontSize: 24, color: "#f59e0b" }}>#{myRank}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-main" style={{ flex: 1 }} onClick={() => setScreen("home")}>Play Again ↺</button>
            <button className="btn-ghost" onClick={() => setScreen("leaderboard")}>🏆 Board</button>
          </div>
        </div>
      )}

      {/* ── LEADERBOARD ──────────────────────────────────────────────────────── */}
      {screen === "leaderboard" && (
        <div className="card slide-up" style={{ maxWidth: 560 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2 className="dp curtain" style={{ fontSize: 44, margin: 0 }}>🏆 Comedy Rankings</h2>
            <p className="sn" style={{ color: "#4a4060", marginTop: 8, fontSize: 14 }}>Ranked by Humour Quotient score</p>
          </div>
          {leaderboard.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#2a2040" }} className="sn">No comedians yet. Be the first!</div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              {leaderboard.map((e, i) => {
                const isMe = e.name === name && e.score === displayFinalScore;
                return (
                  <div key={e.id} className={`lb-row ${isMe ? "me" : ""} ${i === 0 ? "top" : ""}`}>
                    <div style={{ fontSize: 20, width: 30, textAlign: "center", flexShrink: 0 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="sn" style={{ fontSize: 13, color: "#2a2040" }}>#{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="sn" style={{ fontSize: 15, fontWeight: 600, color: isMe ? "#f59e0b" : "#e0d0f0" }}>
                        {e.name} {isMe && <span style={{ fontSize: 10, color: "#f59e0b60" }}>← you</span>}
                      </div>
                      <div className="sn" style={{ fontSize: 11, color: "#2a2040", marginTop: 2 }}>{e.emoji} {e.title} · {e.time}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="dp" style={{ fontSize: 26, color: i === 0 ? "#f59e0b" : "#c0b0d0" }}>{e.score}</div>
                      <div className="sn" style={{ fontSize: 10, color: "#2a2040" }}>/ {MAX_SCORE}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-main" style={{ flex: 1 }} onClick={() => setScreen("home")}>Play ▶</button>
            {displayFinalScore > 0 && <button className="btn-ghost" onClick={() => setScreen("result")}>← My Result</button>}
          </div>
        </div>
      )}
    </div>
  );
}
