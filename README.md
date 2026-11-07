## AI Interviewer

An AI mock interviewer. It reads your GitHub, CV and the job description, tells you how well you fit the role, then runs a practice interview and scores your answers.

Based on the AI interviewer built in a YouTube video by Harkirat Singh: https://www.youtube.com/watch?v=iNJ7z4YLQFk

---

## How to use it

### 1. Requirements
- [Bun](https://bun.com) 1.3+
- A free [Groq](https://console.groq.com) API key (used for all AI calls in practice mode)

### 2. Set up
```bash
bun install
```

Create `apps/backend/.env`:
```env
GROQ_API_KEY=your_groq_key
GROQ_MODEL=openai/gpt-oss-120b   # optional, this is the default
GITHUB_TOKEN=                    # optional, avoids GitHub rate limits
PROXY_URL=                       # optional, proxy for GitHub requests
```

### 3. Run
```bash
bun run dev
```
This starts both apps with Turborepo:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000 (the URL is printed in the terminal)

### 4. Use the app
1. **Setup** (`/`): add any of these: GitHub username/URL, CV (PDF or text), job description (text, or a screenshot that gets read with OCR in the browser).
2. **Fit check** (`/fit`): see your match score (0-100), strengths, gaps, CV edits to make, and topics to practise.
3. **Practice** (`/practice`): answer one question at a time by typing or speaking (browser speech-to-text). You can ask the interviewer to clarify, press **Hint**, or **Skip**. Each answer gets a score (0-10), strengths, weaknesses, a better answer and a tip.
4. **Summary** (`/summary`): overall score, patterns in your answers, and next steps before the real interview.

---

## How it works

```
apps/
  frontend/   React + Tailwind, served by Bun
  backend/    Express API on Bun (port 3001)
```

### Practice mode (default, only needs Groq)
All AI calls go through `groqJson()` in [apps/backend/llm.ts](apps/backend/llm.ts). It asks Groq for JSON in a fixed schema, checks the reply with Zod, and retries up to 3 times (on rate limits or bad output).

Endpoints in [apps/backend/practice.ts](apps/backend/practice.ts), under `/api/v2/practice`:

| Endpoint | What it does |
|---|---|
| `POST /analyze` | Fetches GitHub repos, extracts text from the CV PDF, and asks the AI for a fit report. It also returns a short **context** (target role + ~200-word candidate profile + job). |
| `POST /question` | Generates the next question from the context, focus topics and questions already asked (gets harder over time, never repeats). |
| `POST /evaluate` | Decides whether your message is an answer, a clarification question, a hint request or a skip, and replies to it. Only answers are scored. |
| `POST /summary` | Looks at all scored answers and writes the final report. |

The full CV/GitHub text is sent to the AI only once (in `/analyze`). After that the frontend sends back the short context on every call, so requests stay under Groq's free-tier token limit. Nothing is saved in a database in this mode.

### Live voice interview (original version from the video)
Routes `/interview/:id` and `/result/:id`. This one needs extra setup: `OPENAI_KEY`, a Deepgram key (set in [Interview.tsx](apps/frontend/src/components/Interview.tsx)) and a Postgres `DATABASE_URL`, then `bunx prisma migrate dev` in `apps/backend`.

1. `POST /api/v1/pre-interview` fetches your GitHub repos and creates an `Interview` row.
2. `POST /api/v1/session/:id` connects the browser to the OpenAI Realtime voice model (WebRTC).
3. The backend opens a second WebSocket to the same call ([sideband.ts](apps/backend/sideband.ts)) to give the AI its instructions + your GitHub data, and saves the AI's lines to the database. Your speech is transcribed by Deepgram and saved too.
4. `GET /api/v1/result/:id` returns the transcript and has Groq score it 0-10 with feedback ([result.ts](apps/backend/result.ts)).
