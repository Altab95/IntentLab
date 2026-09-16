# IntentLab

LLM-powered **Ecommerce Personalization Rules Engine** — Take-home Assignment (Option C).

IntentLab analyzes a shopper's event stream and classifies their current shopping intent into one of five states:

- `browser`
- `comparer`
- `discount_seeker`
- `cart_abandoner`
- `loyal_customer`

The system returns:

- Intent classification
- Confidence score
- Evidence/signals behind the classification
- Recommended on-site personalization nudge

It also includes a live event simulator that updates the shopper classification as events are added or removed.

## How It Works

1. **Signal Extraction** — Deterministic feature extraction from shopper events.
2. **LLM Classification** — Uses Google Gemini to classify shopper intent based on extracted signals and event context.
3. **Heuristic Fallback** — If the LLM is unavailable or the API quota is exceeded, the application automatically falls back to the deterministic classifier.

## Features

- Five shopper intent states
- LLM-powered classification
- Deterministic signal extraction
- Confidence scoring
- Evidence-based classification
- Personalized on-site nudges
- Live event stream simulator
- Add/remove shopper events
- Automatic classification updates
- Sample sessions
- Graceful LLM fallback

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- REST API

### AI
- Google Gemini API
- Gemini `gemini-3.6-flash`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Status + whether LLM is configured |
| GET | `/api/sessions` | Sample sessions |
| GET | `/api/sessions/:id` | Full event stream |
| POST | `/api/signals` | `{ events }` → features + heuristic |
| POST | `/api/classify` | `{ events }` → state, evidence, nudge |

## Project Structure

```text
IntentLab/
├── backend/
│   ├── src/
│   │   ├── data/
│   │   ├── routes/
│   │   └── services/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── README.md
└── .gitignore