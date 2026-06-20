import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLeaderboard, saveScore, callClaude } from "./api";
import "./styles/App.scss";
 
// ── Brand colors (mirror the CSS tokens in styles/global.scss) ──────────────
const COLORS = {
  red:        "#D22D1E",
  redDark:    "#A82418",
  purple:     "#963AB1",
  purpleDark: "#7B2D9A",
  pink:       "#C4356A",
  blue:       "#4A7AE0",
  blueDark:   "#20469B",
  gold:       "#F0B429",
  gray:       "#8099AA",
  slate:      "#4A4455",
  teal:       "#14B8A6",
  coral:      "#F97316",
  slateMid:   "#F9A8D4",
  white:      "#ffffff",
};
 
const BRAIN_WORDS = [
  { text: "Wit",       color: "red",    top:  4, left: 22, delay:  0    },
  { text: "Irony",     color: "purple", top:  8, left: 60, delay: -0.2  },
  { text: "Deadpan",   color: "pink",   top: 14, left: 14, delay: -0.4  },
  { text: "Pun",       color: "gold",   top: 16, left: 78, delay: -0.6  },
  { text: "Absurd",    color: "pink",   top: 22, left: 36, delay: -0.8  },
  { text: "Funny",     color: "red",    top: 24, left: 84, delay: -1.0  },
  { text: "Laugh",     color: "blue",   top: 30, left:  8, delay: -1.2  },
  { text: "Banter",    color: "gold",   top: 32, left: 64, delay: -1.4  },
  { text: "Twist",     color: "purple", top: 38, left: 86, delay: -1.6  },
  { text: "Punchline", color: "gold",   top: 40, left: 12, delay: -1.8  },
  { text: "Smile",     color: "pink",   top: 46, left: 90, delay: -2.0  },
  { text: "Satire",    color: "blue",   top: 50, left:  6, delay: -2.2  },
  { text: "Improv",    color: "purple", top: 54, left: 92, delay: -2.4  },
  { text: "Hilarious", color: "red",    top: 60, left: 10, delay: -2.6  },
  { text: "Gag",       color: "gold",   top: 62, left: 84, delay: -2.8  },
  { text: "Sarcasm",   color: "blue",   top: 68, left: 16, delay: -3.0  },
  { text: "Goofy",     color: "pink",   top: 70, left: 70, delay: -3.2  },
  { text: "Parody",    color: "purple", top: 76, left: 30, delay: -3.4  },
  { text: "Giggle",    color: "red",    top: 78, left: 86, delay: -3.6  },
  { text: "Chaos",     color: "pink",   top: 82, left: 10, delay: -3.8  },
  { text: "Quirky",    color: "purple", top: 84, left: 56, delay: -4.0  },
  { text: "Comedy",    color: "blue",   top: 88, left: 80, delay: -4.2  },
  { text: "Humour",    color: "red",    top: 92, left: 26, delay: -4.4  },
  { text: "Dry",       color: "gold",   top: 94, left: 64, delay: -4.6  },
  { text: "Joke",      color: "purple", top: 96, left: 88, delay: -4.8  },
  { text: "Meme",      color: "gold",   top:  2, left: 88, delay: -1.5  },
  { text: "Witty",     color: "pink",   top:  2, left: 40, delay: -2.5  },
  { text: "Chuckle",   color: "gold",   top: 98, left: 18, delay: -3.5  },
];
 
// Comedic styles. `points` is awarded when a player PICKS a preset option of that
// type; each preset's score sits inside its tag's range so presets and spoken
// answers share the same scale (see scoreToStyle below).
// 19-25 FUNNY · 13-18 SARCASTIC · 7-12 UNHINGED · 0-6 SAFE
const OPTION_TYPES = {
  FUNNY:    { points: 25, color: COLORS.gold,     label: "😂 Genuinely Funny",    key: "funny",     desc: "Clever & witty"   },
  SARCASTIC:{ points: 18, color: COLORS.teal,     label: "😏 Sarcastic",          key: "sarcastic", desc: "Dry & ironic"     },
  UNHINGED: { points: 12, color: COLORS.coral,    label: "🤪 Completely Unhinged", key: "unhinged",  desc: "Chaotic energy"   },
  SAFE:     { points: 6,  color: COLORS.slateMid, label: "😐 Safe & Boring",      key: "safe",      desc: "Played it safe"   },
};
 
const MAX_PER_Q = 25; // highest score Claude can award a spoken answer (also FUNNY option's points)

function scoreToStyle(score) {
  if (score >= 19) return "FUNNY";
  if (score >= 13) return "SARCASTIC";
  if (score >= 7)  return "UNHINGED";
  return "SAFE";
}

function narrate(text, onDone) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onDone?.(); return; }
  try { window.speechSynthesis.cancel(); } catch { /* no-op */ }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  u.rate = 1.05;
  u.pitch = 1.0;
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  window.speechSynthesis.speak(u);
}

function cancelNarration() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch { /* no-op */ }
  }
}
 
const QUESTIONS_PROMPT = `Generate 6 funny scenario questions for a comedy game called "Know Your Humour Quotient". Players SPEAK or TYPE their own funny answer. To help them when they're stuck, each scenario also offers a few inspiration keywords — short, evocative words or short phrases the player can riff on or weave into their answer.

Return ONLY a valid JSON array. No markdown, no explanation, just the array. Use this exact shape:
[
  {
    "scenario": "A relatable/absurd 1-2 sentence situation that invites a funny response (end with a prompt like 'What do you say?' / 'What do you do?')",
    "keywords": ["4-5 short, vivid words or 2-word phrases tied to this scenario; concrete nouns/verbs/objects that spark a joke; not full sentences"]
  }
]

Mix scenarios: office disasters, awkward social moments, absurd everyday situations, tech gone wrong, food emergencies, public transport chaos. Indian-office-culture friendly where possible. Return only the JSON array of 6 objects.`;
 
function parseQuestions(raw) {
  try {
    const arr = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const cleaned = (Array.isArray(arr) ? arr : []).filter(q =>
      q && typeof q.scenario === "string" && q.scenario.trim() &&
      Array.isArray(q.keywords) && q.keywords.length >= 1
    );
    return cleaned.length ? cleaned : FALLBACK_QUESTIONS;
  } catch {
    return FALLBACK_QUESTIONS;
  }
}
 
async function generateQuestions() {
  const data = await callClaude({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: `You generate questions for a comedy game called "Know Your Humour Quotient". Return ONLY a valid JSON array. No markdown, no explanation, just the array.`,
    messages: [{ role: "user", content: QUESTIONS_PROMPT }],
  });
  const raw = data.content?.find(b => b.type === "text")?.text?.trim() || "[]";
  return parseQuestions(raw);
}
 
// ── Humor judging ──────────────────────────────────────────────────────────────
function parseScore(raw) {
  const extract = (txt) => {
    try { return JSON.parse(txt.replace(/```json|```/g, "").trim()); }
    catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
      return null;
    }
  };
  const json = extract(raw);
  if (!json) return { score: 0, style: "SAFE", reaction: "Our judge couldn't quite catch that one." };
  const score = Math.max(0, Math.min(MAX_PER_Q, Math.round(Number(json.score) || 0)));
  const style = scoreToStyle(score);
  const reaction = (typeof json.reaction === "string" && json.reaction.trim())
    ? json.reaction.trim()
    : "The judges have spoken.";
  return { score, style, reaction };
}
 
async function scoreAnswer(scenario, answer) {
  const data = await callClaude({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: `You are a sharp, fair comedy judge for a game called "Know Your Humour Quotient". A player hears a scenario and improvises an answer out loud; their speech is transcribed to text and you judge how FUNNY that answer is.
 
Judge on: wit, cleverness, originality, surprise, word choice, and the comedic tone that comes through the words (sarcasm, absurdity, deadpan, etc.). A safe, literal, or boring answer scores low. Length and randomness alone are not funny — genuine humour is the bar. Transcription may be imperfect; judge generously on intent.
 
Return ONLY a JSON object, no markdown:
{ "score": <integer 0-${MAX_PER_Q}>, "reaction": "<a short, witty one-line reaction to THEIR specific answer, max 14 words>" }
 
Score guide: 0-6 boring/safe/no real attempt; 7-12 chaotic or weak attempt; 13-18 sarcastic or witty, a real chuckle; 19-${MAX_PER_Q} genuinely funny / comic gold.`,
    messages: [{ role: "user", content: `Scenario: "${scenario}"\n\nPlayer's spoken answer (transcribed): "${answer}"` }],
  });
  const raw = data.content?.find(b => b.type === "text")?.text || "";
  return parseScore(raw);
}
 
// Fallbacks used when Claude is unreachable — scenario + a few inspiration keywords.
const FALLBACK_QUESTIONS = [
  {
    scenario: "You accidentally liked your ex's 3-year-old Instagram photo at 2am. They've seen it. What do you do?",
    keywords: ["2am", "ex", "double-tap", "new identity", "commit"],
  },
  {
    scenario: "Your boss asks 'Any ideas?' and you accidentally say your lunch order out loud.",
    keywords: ["dal makhani", "strategy", "pivot", "lunch", "eye contact"],
  },
  {
    scenario: "A pigeon walks into your video call and sits directly in front of your camera.",
    keywords: ["co-founder", "Dave", "introduce", "instincts", "attendance"],
  },
  {
    scenario: "You send a meme to your work WhatsApp group by mistake. The CEO reacts with 👀.",
    keywords: ["company culture", "double down", "CEO", "blink first", "vibe"],
  },
  {
    scenario: "Your phone rings loudly in a silent cinema during the most emotional scene.",
    keywords: ["mom", "speaker", "killer", "subtitles", "shame"],
  },
  {
    scenario: "You walk into the wrong meeting room mid-presentation. 15 strangers stare at you.",
    keywords: ["whiteboard", "pre-read", "authority", "network", "marker"],
  },
];
 
// ── Speech-to-text (Web Speech API, graceful fallback to typing) ─────────────────
function useSpeech() {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = !!SR;
  const recRef = useRef(null);
  const finalRef = useRef("");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
 
  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
  }, []);
 
  const start = useCallback(() => {
    if (!supported) return;
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    setTranscript("");
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t + " ";
        else interim += t;
      }
      setTranscript((finalRef.current + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [SR, supported]);
 
  // Typing fallback / manual edits write straight to the transcript.
  const edit = useCallback((text) => { finalRef.current = text ? text + " " : ""; setTranscript(text); }, []);
  const reset = useCallback(() => { finalRef.current = ""; setTranscript(""); setListening(false); }, []);
 
  return { supported, listening, transcript, start, stop, edit, reset };
}
 
function getHQTitle(score, maxScore) {
  const pct = score / maxScore;
  if (pct >= 0.88) return { title: "COMEDY LEGEND",      sub: "You could headline a show.",       emoji: "🌟", color: COLORS.red    };
  if (pct >= 0.72) return { title: "CERTIFIED FUNNY",    sub: "The room genuinely loves you.",     emoji: "😂", color: COLORS.pink   };
  if (pct >= 0.55) return { title: "WIT WITH POTENTIAL", sub: "Good instincts, needs polish.",     emoji: "😄", color: COLORS.purple };
  if (pct >= 0.38) return { title: "ACCIDENTAL COMIC",   sub: "Funny without meaning to be.",      emoji: "🙃", color: COLORS.purple };
  if (pct >= 0.20) return { title: "HUMOUR PADAWAN",     sub: "The force is… still loading.",      emoji: "🙂", color: COLORS.blue   };
  return              { title: "CHRONICALLY SERIOUS",    sub: "Have you tried laughing once?",      emoji: "😑", color: COLORS.slate  };
}
 
// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  const pieces = useRef(Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: [COLORS.red, COLORS.purple, COLORS.blueDark, COLORS.pink, COLORS.blue, COLORS.white, COLORS.redDark, COLORS.purpleDark][i % 8],
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
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" style={{ filter: `drop-shadow(0 0 8px ${COLORS.purple}60)` }}>
      <defs>
        <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={COLORS.red} />
          <stop offset="52%" stopColor={COLORS.purple} />
          <stop offset="100%" stopColor={COLORS.blue} />
        </linearGradient>
      </defs>
      <circle cx={32} cy={32} r={r} fill="none" stroke="#1A181B" strokeWidth={5} />
      <circle cx={32} cy={32} r={r} fill="none" stroke="url(#timerGrad)" strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - value / max)}
        strokeLinecap="round" transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset 1s linear" }} />
      <text x={32} y={37} textAnchor="middle" fill="#fff" className="dp fw-bold" style={{ fontSize: 18 }}>{value}</text>
    </svg>
  );
}
 
// ── Toast (Bootstrap .toast component, brand-themed) ─────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const icons = { error: "✗", warning: "⚡", info: "✦" };
  return (
    <div
      className={`toast toast-stage show position-fixed bottom-0 end-0 m-3 ${toast.type}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{ zIndex: 1090 }}
    >
      <div className="toast-body d-flex align-items-start gap-2">
        <span className="fs-6 lh-1">{icons[toast.type] || "✦"}</span>
        <p className="m-0 flex-grow-1 small">{toast.message}</p>
        <button type="button" className="btn-close btn-close-white ms-2" onClick={onDismiss} aria-label="Close" />
      </div>
    </div>
  );
}
 
// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const navigate = useNavigate();
  const [screen, setScreen]           = useState("home");
  const [name, setName]               = useState("");
  const [questions, setQuestions]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [toast, setToast]             = useState(null);
  const [qIdx, setQIdx]               = useState(0);
  const [result, setResult]           = useState(null);   // { score, style, reaction, transcript }
  const [judging, setJudging]         = useState(false);
  const [scores, setScores]           = useState([]);
  const [totalScore, setTotalScore]   = useState(0);
  const [timeLeft, setTimeLeft]       = useState(30);
  const [timerOn, setTimerOn]         = useState(false);
  const [narrating, setNarrating]     = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [animKey, setAnimKey]         = useState(0);
  const finalScoreRef                 = useRef(0);
  const timerRef                      = useRef(null);
  const submitRef                     = useRef(() => {});  // latest handleSubmit, for the timer
  const gameStartRef                  = useRef(0);
  const speech                        = useSpeech();
 
  const MAX_SCORE = 6 * MAX_PER_Q;
 
  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard).catch(() => {});
  }, []);

  useEffect(() => {
    if (screen !== "game") return;
    const scenario = questions[qIdx]?.scenario;
    if (!scenario) return;
    setTimeLeft(30);
    setNarrating(true);
    narrate(scenario, () => {
      setNarrating(false);
      setTimeLeft(30);
      setTimerOn(true);
    });
    return () => {
      cancelNarration();
      setNarrating(false);
    };
  }, [screen, qIdx, questions]); // eslint-disable-line
 
  useEffect(() => {
    if (!timerOn) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          submitRef.current();   // time's up — score whatever was said (or 0 if silent)
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerOn, qIdx]); // eslint-disable-line
 
  function stopTimer()  { setTimerOn(false); clearInterval(timerRef.current); }
 
  async function startGame() {
    if (!name.trim()) return;
    setLoading(true);
    setScreen("loading");
    let qs;
    try {
      qs = await generateQuestions();
    } catch {
      qs = FALLBACK_QUESTIONS;
      setToast({ type: "warning", message: "Claude unavailable — using built-in scenarios" });
    }
    setLoading(false);
    setQuestions(qs);
    setQIdx(0); setScores([]); setTotalScore(0);
    setResult(null); setJudging(false); speech.reset();
    finalScoreRef.current = 0;
    gameStartRef.current = Date.now();
    setScreen("game");
    setAnimKey(k => k + 1);
  }
 
  async function handleSubmit() {
    if (result || judging) return;          // score each question once
    speech.stop();
    cancelNarration(); setNarrating(false);
    stopTimer();
    const answer = speech.transcript.trim();
    if (!answer) {
      setResult({ score: 0, style: "SAFE", reaction: "Silence! Even the crickets walked out.", transcript: "" });
      return;
    }
    setJudging(true);
    let r;
    try {
      r = await scoreAnswer(q.scenario, answer);
    } catch {
      r = { score: 0, style: "SAFE", reaction: "Our judge stepped out — no score this round." };
      setToast({ type: "warning", message: "Couldn't reach the judge — scored 0 this round" });
    }
    setResult({ ...r, transcript: answer });
    setJudging(false);
  }
  submitRef.current = handleSubmit;
 
 
  async function handleNext() {
    const pts = result?.score || 0;
    const style = result?.style || "SAFE";
    const newTotal = totalScore + pts;
    setScores(prev => [...prev, { type: style, pts }]);
    setTotalScore(newTotal);
 
    if (qIdx + 1 >= questions.length) {
      finalScoreRef.current = newTotal;
      const hq = getHQTitle(newTotal, MAX_SCORE);
      if (newTotal >= MAX_SCORE * 0.55) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
      const entry = {
        name: name.trim(), score: newTotal,
        title: hq.title, emoji: hq.emoji,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        durationMs: Date.now() - gameStartRef.current,
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
    setResult(null); setJudging(false); speech.reset();
    setAnimKey(k => k + 1);
  }
 
  const q = questions[qIdx];
  const displayFinalScore = finalScoreRef.current > 0
    ? finalScoreRef.current
    : scores.reduce((s, r) => s + r.pts, 0) + (result ? result.score : 0);
  const hqInfo = getHQTitle(displayFinalScore, MAX_SCORE);
  const myRank = leaderboard.findIndex(e => e.name === name.trim() && e.score === displayFinalScore) + 1;
  const allScores = scores.concat(result ? [{ type: result.style }] : []);
  const styleCount = allScores.reduce((a, s) => { a[s.type] = (a[s.type] || 0) + 1; return a; }, {});
  const dominantStyle = Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "FUNNY";
 
  return (
    <div className="app-wrap min-vh-100 d-flex align-items-center justify-content-center p-3 position-relative overflow-hidden">
      <Confetti active={showConfetti} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
 
      {/* ── HOME ─────────────────────────────────────────────────────────────── */}
      {screen === "home" && (
        <div className="card stage-card slide-up border-0 overflow-hidden w-100" style={{ maxWidth: 1200 }}>
          <div className="row g-0">
            <div className="col-md-6 home-stage pane-divider position-relative overflow-hidden d-flex align-items-center justify-content-center" aria-hidden="true">
              <svg className="brain-svg" viewBox="0 0 200 200">
                <g className="brain-edges">
                  <path d="M100 20 L156.6 43.4" />
                  <path d="M156.6 43.4 L180 100" />
                  <path d="M180 100 L156.6 156.6" />
                  <path d="M156.6 156.6 L100 180" />
                  <path d="M100 180 L43.4 156.6" />
                  <path d="M43.4 156.6 L20 100" />
                  <path d="M20 100 L43.4 43.4" />
                  <path d="M43.4 43.4 L100 20" />
                  <path d="M100 20    L100 100" />
                  <path d="M156.6 43.4  L100 100" />
                  <path d="M180 100   L100 100" />
                  <path d="M156.6 156.6 L100 100" />
                  <path d="M100 180   L100 100" />
                  <path d="M43.4 156.6  L100 100" />
                  <path d="M20 100    L100 100" />
                  <path d="M43.4 43.4   L100 100" />
                  <path d="M100 20    L156.6 156.6" />
                  <path d="M156.6 43.4  L100 180" />
                  <path d="M180 100   L43.4 156.6" />
                  <path d="M156.6 156.6 L20 100" />
                  <path d="M100 180   L43.4 43.4" />
                  <path d="M43.4 156.6  L100 20" />
                  <path d="M20 100    L156.6 43.4" />
                  <path d="M43.4 43.4   L180 100" />
                </g>
                <g className="brain-nodes">
                  <circle className="n1" cx="100"   cy="20"    r="6" />
                  <circle className="n2" cx="156.6" cy="43.4"  r="6" />
                  <circle className="n3" cx="180"   cy="100"   r="6" />
                  <circle className="n4" cx="156.6" cy="156.6" r="6" />
                  <circle className="n5" cx="100"   cy="180"   r="6" />
                  <circle className="n6" cx="43.4"  cy="156.6" r="6" />
                  <circle className="n7" cx="20"    cy="100"   r="6" />
                  <circle className="n8" cx="43.4"  cy="43.4"  r="6" />
                  <circle className="center" cx="100" cy="100" r="10" />
                </g>
              </svg>
              {BRAIN_WORDS.map((w, i) => (
                <span key={i} className={`brain-word ${w.color}`} style={{
                  top: `${w.top}%`, left: `${w.left}%`,
                  animationDelay: `${w.delay}s`,
                }}>{w.text}</span>
              ))}
            </div>
 
            <div className="col-md-6 card-body p-4 p-md-5 d-flex flex-column justify-content-center">
              <div className="text-center mb-3">
                <img className="d-block mx-auto mb-2" src="https://imgcdn.analyticsvidhya.com/dhs/av_dhs_logo.svg" alt="Analytics Vidhya DataHack Summit" style={{ height: 52 }} />
                <h1 className="dp curtain display-5 fw-bolder lh-1 m-0">Know Your<br />Humour Quotient</h1>
                <p className="sn text-muted mt-2 mb-0 small lh-base">
                  6 wild scenarios. Speak or type your funniest answer — our AI judges your wit (up to 25 pts).<br />
                  <strong className="fw-medium">Stuck? Tap a hint word to drop it into your answer.</strong>
                </p>
              </div>
 
              <div className="row g-2 mb-3">
                {Object.entries(OPTION_TYPES).map(([key, val]) => (
                  <div key={key} className="col-6">
                    <div className={`type-card d-flex align-items-center gap-2 p-2 rounded-3 h-100 ${val.key}`}>
                      <div className="fs-5">{val.label.split(" ")[0]}</div>
                      <div>
                        <div className="sn type-label small fw-semibold">{val.label.slice(3)}</div>
                        <div className="sn text-muted" style={{ fontSize: 11 }}>{val.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
 
              <div className="mb-3">
                <label htmlFor="stageName" className="form-label sn small text-muted text-uppercase" style={{ letterSpacing: "0.1em" }}>Your stage name</label>
                <input
                  id="stageName"
                  className="form-control form-control-lg"
                  placeholder="Enter your name…"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && name.trim() && !loading && startGame()}
                  maxLength={20}
                  autoFocus
                />
              </div>
 
              <div className="d-grid gap-2">
                <button className="btn btn-primary btn-lg fw-bold py-2" onClick={startGame} disabled={!name.trim() || loading}>
                  {loading ? "Loading…" : "Unlock Your HQ!"}
                </button>
                <button className="btn btn-link" onClick={() => navigate("/leaderboard")}>
                  View Leaderboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {/* ── LOADING ──────────────────────────────────────────────────────────── */}
      {screen === "loading" && (
        <div className="text-center">
          <div className="display-3 mb-3">🤖</div>
          <h2 className="dp h2 mb-2">Cooking up chaos…</h2>
          <p className="sn text-muted mb-4">Generating fresh scenarios just for you</p>
          <div className="think-dots"><span /><span /><span /></div>
        </div>
      )}
 
      {/* ── GAME ─────────────────────────────────────────────────────────────── */}
      {screen === "game" && q && (
        <div className="card stage-card slide-up w-100" style={{ maxWidth: 1200 }} key={animKey}>
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div className="sn small text-muted text-uppercase" style={{ letterSpacing: "0.12em", fontSize: 10 }}>Question</div>
                <div className="dp fs-3 lh-1">
                  {qIdx + 1} <span className="text-muted fs-6">/ {questions.length}</span>
                </div>
              </div>
              <TimerRing value={timeLeft} max={30} />
              <div className="text-end">
                <div className="sn small text-muted text-uppercase" style={{ letterSpacing: "0.12em", fontSize: 10 }}>Score</div>
                <div className="dp fs-3 lh-1">{totalScore}</div>
              </div>
            </div>
 
            <div className="progress mb-3" role="progressbar" aria-valuenow={qIdx + 1} aria-valuemin={0} aria-valuemax={questions.length}>
              <div className="progress-bar" style={{ width: `${((qIdx + 1) / questions.length) * 100}%`, transition: "width .4s ease" }} />
            </div>
 
            <div className="alert scenario-alert rounded-4 p-3 mb-3" role="region">
              <div className="d-flex justify-content-between align-items-center mb-2" style={{ gap: 8 }}>
                <div className="sn small text-uppercase" style={{ letterSpacing: "0.15em", fontSize: 10, color: "var(--purple)" }}>The scenario</div>
                {narrating && (
                  <span className="sn small text-uppercase fw-bold" style={{ letterSpacing: "0.1em", fontSize: 10, color: "var(--purple)" }} aria-live="polite">
                    🔊 Narrating…
                  </span>
                )}
              </div>
              <p className="dp m-0 fs-5 lh-base">"{q.scenario}"</p>
              {Array.isArray(q.keywords) && q.keywords.length > 0 && (
                <div className="d-flex flex-wrap align-items-center mt-3" style={{ gap: 6 }}>
                  <span className="sn small text-uppercase text-muted me-1" style={{ letterSpacing: "0.12em", fontSize: 10 }}>Hints</span>
                  {q.keywords.map((kw, i) => (
                    <button
                      key={i}
                      type="button"
                      className="btn btn-sm rounded-pill px-3 py-1"
                      style={{ background: "var(--surface-2, rgba(255,255,255,.06))", color: "var(--fg)", fontSize: 12, border: "1px solid var(--border, rgba(255,255,255,.12))" }}
                      onClick={() => speech.edit((speech.transcript ? speech.transcript.trimEnd() + " " : "") + kw)}
                      disabled={result || judging}
                      title="Click to add to your answer"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              )}
            </div>
 
            {/* Answer stage — speak (or type) your funniest response */}
            {!result && !judging && (
              <div className="answer-stage mb-3">
                {speech.supported && (
                  <div className="text-center mb-3">
                    <button
                      type="button"
                      className={`mic-btn${speech.listening ? " recording" : ""}`}
                      onClick={speech.listening ? speech.stop : speech.start}
                      aria-pressed={speech.listening}
                      aria-label={speech.listening ? "Stop recording" : "Start recording"}
                    >
                      🎤
                    </button>
                    <div className="sn small text-muted mt-2">
                      {speech.listening
                        ? "Listening… say your funniest answer, then tap to stop"
                        : "Tap the mic and say your answer out loud"}
                    </div>
                  </div>
                )}
                {!speech.supported && (
                  <div className="sn small text-muted mb-2">
                    🎤 Voice input isn't supported in this browser — type your funniest answer instead.
                  </div>
                )}
                <textarea
                  className="form-control answer-box"
                  rows={3}
                  placeholder={speech.supported
                    ? "Your words appear here as you speak — you can also type or tweak them"
                    : "Type your funniest answer…"}
                  value={speech.transcript}
                  onChange={e => speech.edit(e.target.value)}
                />
                <div className="d-grid gap-2 col-md-6 mx-auto mt-3">
                  <button
                    className="btn btn-primary btn-lg fw-bold py-2"
                    onClick={handleSubmit}
                    disabled={!speech.transcript.trim()}
                  >
                    Submit Answer
                  </button>
                </div>
 
              </div>
            )}
 
            {judging && (
              <div className="text-center py-4">
                <div className="think-dots"><span /><span /><span /></div>
                <p className="sn text-muted mt-3 mb-0">The judge is weighing your wit…</p>
              </div>
            )}
 
            {result && (
              <>
                {result.transcript && (
                  <div className="alert reaction-box rounded-4 p-3 mb-3 safe" role="status">
                    <div className="sn small text-uppercase mb-1" style={{ letterSpacing: "0.12em", fontSize: 10, color: "var(--text-muted)" }}>{result.picked ? "You picked" : "You said"}</div>
                    <p className="dp m-0 lh-sm">"{result.transcript}"</p>
                  </div>
                )}
                <div className={`alert reaction-box pop d-flex justify-content-between align-items-center gap-3 mb-3 rounded-4 ${OPTION_TYPES[result.style].key}`} role="status">
                  <div>
                    <div className="sn small text-uppercase fw-bold mb-1" style={{ letterSpacing: "0.1em", fontSize: 10, color: "var(--fg)" }}>
                      {OPTION_TYPES[result.style].label}
                    </div>
                    <p className="dp m-0 lh-sm">"{result.reaction}"</p>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className="dp fs-1 lh-1" style={{ color: OPTION_TYPES[result.style].color }}>
                      +{result.score}
                    </div>
                    <div className="sn small text-muted">points</div>
                  </div>
                </div>
 
                <div className="d-grid gap-2 col-md-6 mx-auto">
                  <button className="btn btn-primary btn-lg fw-bold py-2" onClick={handleNext}>
                    {qIdx + 1 >= questions.length ? "See Your HQ" : "Next Question"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
 
      {/* ── RESULT ───────────────────────────────────────────────────────────── */}
      {screen === "result" && (
        <div className="card stage-card slide-up border-0 overflow-hidden w-100" style={{ maxWidth: 1200 }}>
          <div className="row g-0">
            <div className="col-md-6 pane-divider p-4 p-md-5 text-center d-flex flex-column justify-content-center">
              <div className="sn small text-muted text-uppercase mb-2" style={{ letterSpacing: "0.25em" }}>{name} · Your results</div>
              <div className="display-3 mb-1">{hqInfo.emoji}</div>
              <h2 className="dp curtain display-5 fw-bolder mb-1">{hqInfo.title}</h2>
              <p className="sn text-muted mb-4">{hqInfo.sub}</p>
 
              <div className="mb-3">
                <div className="sn small text-uppercase mb-1" style={{ letterSpacing: "0.2em", fontSize: 12 }}>Humour Quotient</div>
                <div className="dp display-1 fw-bolder lh-1 text-white">{displayFinalScore}/{MAX_SCORE}</div>
              </div>
 
              {dominantStyle && OPTION_TYPES[dominantStyle] && (
                <div>
                  <div className="sn small text-muted text-uppercase mb-2" style={{ letterSpacing: "0.1em" }}>Your Humour DNA</div>
                  <span className={`badge type-badge rounded-pill px-3 py-2 fs-6 ${OPTION_TYPES[dominantStyle].key}`}>
                    {OPTION_TYPES[dominantStyle].label}
                  </span>
                </div>
              )}
            </div>
 
            <div className="col-md-6 card-body p-4 p-md-5 d-flex flex-column">
              <div className="text-start mb-3 flex-grow-1">
                <div className="sn small text-muted text-uppercase mb-3" style={{ letterSpacing: "0.1em", fontSize: 10 }}>Round by round</div>
                {scores.map((s, i) => {
                  const st = OPTION_TYPES[s.type];
                  return (
                    <div key={i} className="d-flex align-items-center gap-2 p-2 px-3 rounded-3 border mb-2" style={{ background: "var(--fill-soft)" }}>
                      <div className="sn small text-muted" style={{ width: 24 }}>Q{i + 1}</div>
                      <div className="flex-grow-1">
                        <span className={`badge type-badge ${st.key}`} style={{ fontSize: 11 }}>{st.label}</span>
                      </div>
                      <div className={`dp fs-5 ${st.key}`} style={{ color: "var(--fg)" }}>+{s.pts}</div>
                    </div>
                  );
                })}
              </div>
 
              {myRank > 0 && (
                <div className="sn text-center mb-3">
                  {myRank === 1 ? "🥇 Top of the leaderboard!"
                    : myRank === 2 ? "🥈 So close to #1!"
                    : myRank === 3 ? "🥉 Top 3!"
                    : <>You're <span className="sn fw-bold" style={{ color: "var(--gold)" }}>#{myRank}</span> on the leaderboard!</>}
                </div>
              )}
 
              <div className="d-grid gap-2">
                <button className="btn btn-primary btn-lg fw-bold py-2" onClick={() => setScreen("home")}>Play Again</button>
                <button className="btn btn-link" onClick={() => navigate("/leaderboard")}>View Leaderboard</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}