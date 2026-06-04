# Know Your Humour Quotient

An AI-powered comedy game for booth events. Players pick from 4 mystery options for funny scenarios — the AI judges their humour style and ranks them on a live leaderboard that persists across sessions.

---

## Project Structure

```
know-your-hq/
├── server/                  ← Express backend (holds API keys, leaderboard data)
│   ├── index.js
│   ├── leaderboard.json     ← auto-created on first play; gitignored
│   ├── package.json
│   └── .env.example         ← copy to .env and fill in your keys
│
├── client/                  ← React frontend
│   ├── src/
│   │   ├── index.js
│   │   └── App.js
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── .env.example         ← copy to .env and fill in server URL
│
├── package.json             ← root scripts to run both together
└── .gitignore
```

---

## Setup — Step by Step

### 1. Get your Anthropic API key

Grab a key from https://platform.anthropic.com/api-keys. The app falls back to built-in questions if the key is missing or the API call fails.

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

Open `server/.env` and paste your key:

```env
ANTHROPIC_API_KEY=your-anthropic-key-here

PORT=3001
CLIENT_ORIGIN=http://localhost:3000
```

### 3. Configure the client

```bash
cd ../client
cp .env.example .env
```

`client/.env` should look like:

```env
REACT_APP_API_URL=http://localhost:3001
```

### 4. Install dependencies

From the **root** folder:

```bash
npm install
npm run install:all
```

### 5. Run in development

```bash
npm run dev
```

This starts both the server (port 3001) and the React app (port 3000) simultaneously.

Open http://localhost:3000 in your browser.

---

## Leaderboard

Scores are saved to `server/leaderboard.json` on the server. This file:

- Is created automatically on the first game played
- Persists across page refreshes and server restarts
- Is shared across all devices/browsers connected to the same server
- Is gitignored so scores don't end up in version control

To reset the leaderboard, delete `server/leaderboard.json` or send:

```bash
curl -X DELETE http://localhost:3001/api/leaderboard
```

---

## Production Deployment

### Option A — Same server (recommended for booth)

1. Build the React app:
   ```bash
   npm run build --prefix client
   ```

2. Serve the build folder from Express by adding to `server/index.js`:
   ```js
   const path = require("path");
   app.use(express.static(path.join(__dirname, "../client/build")));
   app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../client/build/index.html")));
   ```

3. Set env vars on your server/hosting platform and run:
   ```bash
   node server/index.js
   ```

### Option B — Separate hosting (e.g. Vercel + Railway)

- **Backend**: Deploy `server/` to Railway, Render, or any Node host
  - Set `ANTHROPIC_API_KEY` and `CLIENT_ORIGIN` in the platform's env settings
- **Frontend**: Deploy `client/` to Vercel or Netlify
  - Set `REACT_APP_API_URL` to your backend's deployed URL

---

## Environment Variables Reference

### server/.env

| Variable           | Required | Description                                           |
|--------------------|----------|-------------------------------------------------------|
| ANTHROPIC_API_KEY  | yes      | Anthropic API key — powers Claude (claude-sonnet-4-5) |
| PORT               | optional | Server port (default: 3001)                           |
| CLIENT_ORIGIN      | optional | Frontend URL for CORS (default: localhost:3000)       |

### client/.env

| Variable          | Required | Description                                   |
|-------------------|----------|-----------------------------------------------|
| REACT_APP_API_URL | optional | Backend URL (default: same origin via proxy)  |

---

## Security Notes

- The API keys live **only** on the server — never sent to the browser
- `.env` files and `leaderboard.json` are in `.gitignore` — never committed to git
- CORS is configured to only accept requests from your frontend URL
- For a public booth, consider adding rate limiting (e.g. `express-rate-limit`) to prevent API abuse

---

## Cost Estimate

Each game generates roughly 1,500 input tokens + 800 output tokens per player on Claude Sonnet 4.5.

| Players | Estimated cost |
|---------|----------------|
| 50      | ~$0.25         |
| 200     | ~$1.00         |
| 500     | ~$2.50         |
