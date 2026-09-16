# IntentLab

LLM-powered **ecommerce personalization rules engine** (take-home Option C).

Paste or simulate a shopper event stream → classify into a state (`browser`, `comparer`, `discount_seeker`, `cart_abandoner`, `loyal_customer`) with **evidence**, **confidence**, and a **recommended on-site nudge**. Live simulator updates classification as you add/remove events.

## How it works

1. **Signal extraction** (deterministic) — features and weighted evidence from the event stream (SKU revisits, promo attempts, checkout stall, loyalty markers, etc.).
2. **LLM classification** (when `OPENAI_API_KEY` is set) — structured JSON judgment grounded in those signals + raw events.
3. **Heuristic fallback** — same API works without a key so the demo never bricks.

This hybrid is intentional: models explain and adjudicate; code owns reliable feature evidence.

## Quick start

```bash
# Backend
cd backend
cp .env.example .env
# optional: add OPENAI_API_KEY=sk-...
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — API proxies to http://localhost:3001.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Status + whether LLM is configured |
| GET | `/api/sessions` | Sample sessions |
| GET | `/api/sessions/:id` | Full event stream |
| POST | `/api/signals` | `{ events }` → features + heuristic |
| POST | `/api/classify` | `{ events }` → state, evidence, nudge |

## Product notes

- Five seeded sessions map cleanly to each state for reviewer walkthrough.
- **Live mode** debounces reclassification (~450ms) as the stream changes.
- Nudges are concrete UI actions (compare strip, threshold progress, express checkout), not generic CRO advice.

## Stack

- Frontend: React + Vite
- Backend: Express
- LLM: OpenAI Chat Completions (`gpt-4o-mini` by default) with JSON mode
