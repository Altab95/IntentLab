// const { GoogleGenerativeAI } = require("@google/generative-ai");
// const { extractSignals } = require("./signals");

// const NUDGES = {
//   browser: {
//     action: "inspire_not_hard_sell",
//     copy: "Surface a short editorial story + 3 hero picks; soft social proof, no urgency timers.",
//   },
//   comparer: {
//     action: "decision_aids",
//     copy: "Show a compare strip of recently viewed SKUs with size/fit callouts and a clear “best for” label.",
//   },
//   discount_seeker: {
//     action: "value_transparency",
//     copy: "Reveal eligible threshold progress (e.g. free shipping) and one honest code — avoid fake scarcity.",
//   },
//   cart_abandoner: {
//     action: "friction_remove_plus_reassure",
//     copy: "Offer express checkout, trust badges at payment, and a low-friction save-for-later with restock alert.",
//   },
//   loyal_customer: {
//     action: "recognize_and_replenish",
//     copy: "Greet by name, surface reorder of prior SKUs, and unlock a loyalty-only early access module.",
//   },
// };

// function buildFallback(signals, events) {
//   const state = signals.heuristic.state;
//   const nudge = NUDGES[state];
//   return {
//     state,
//     confidence: signals.heuristic.confidence,
//     evidence: signals.evidence.slice(0, 5).map((e) => ({
//       claim: e.signal.replace(/_/g, " "),
//       detail: e.detail,
//       weight: e.weight,
//     })),
//     rationale: `Heuristic ranking led with ${state} (score ${signals.heuristic.ranked[0].score}) based on ${signals.evidence.length} extracted signals across ${events.length} events.`,
//     recommendedAction: {
//       type: nudge.action,
//       message: nudge.copy,
//       priority: signals.heuristic.confidence >= 0.7 ? "high" : "medium",
//     },
//     alternatives: signals.heuristic.ranked.slice(1, 3).map((r) => ({
//       state: r.state,
//       confidence: Number(Math.max(0.2, r.score / (signals.heuristic.ranked[0].score || 1) * signals.heuristic.confidence * 0.7).toFixed(2)),
//     })),
//     source: "heuristic",
//   };
// }

// function getClient() {
//   if (!process.env.GEMINI_API_KEY) return null;

//   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//   return genAI.getGenerativeModel({
//     model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
//   });
// }

// async function classifyWithLlm(events, signals) {
//   const client = getClient();
//   if (!client) return null;

//   const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
//   const system = `You are an ecommerce personalization classifier for IntentLab.
// Given a shopper event stream and pre-extracted signals, classify the shopper into exactly one state:
// - browser: shallow exploration, low purchase urgency
// - comparer: researching / comparing multiple SKUs before deciding
// - discount_seeker: oriented around promos, sale, or price sensitivity
// - cart_abandoner: showed cart/checkout intent but stalled without purchase
// - loyal_customer: returning / repurchase / loyalty markers (may include a completed purchase)

// Rules:
// - Ground every claim in the provided events or signals. Do not invent SKUs or events.
// - Prefer cart_abandoner over comparer when checkout was started and no purchase occurred.
// - Prefer loyal_customer when returning + prior orders / repurchase signals are strong, even if a purchase completed.
// - confidence is 0-1 reflecting how decisive the evidence is.
// - recommendedAction must be a concrete on-site nudge (not generic marketing advice).
// Return JSON only matching the schema.`;

//   const user = JSON.stringify(
//     {
//       events,
//       signals: {
//         features: signals.features,
//         evidence: signals.evidence,
//         heuristicTop: signals.heuristic,
//       },
//     },
//     null,
//     2
//   );

//   const response = await client.chat.completions.create({
//     model,
//     temperature: 0.2,
//     response_format: { type: "json_object" },
//     messages: [
//       { role: "system", content: system },
//       {
//         role: "user",
//         content: `${user}

// Respond with JSON:
// {
//   "state": "browser|comparer|discount_seeker|cart_abandoner|loyal_customer",
//   "confidence": 0.0,
//   "evidence": [{"claim": "...", "detail": "...", "weight": 0.0}],
//   "rationale": "1-3 sentences",
//   "recommendedAction": {"type": "snake_case_action", "message": "...", "priority": "high|medium|low"},
//   "alternatives": [{"state": "...", "confidence": 0.0}]
// }`,
//       },
//     ],
//   });

//   const raw = response.choices[0]?.message?.content;
//   if (!raw) return null;
//   const parsed = JSON.parse(raw);

//   const valid = new Set([
//     "browser",
//     "comparer",
//     "discount_seeker",
//     "cart_abandoner",
//     "loyal_customer",
//   ]);
//   if (!valid.has(parsed.state)) {
//     throw new Error(`Invalid state from model: ${parsed.state}`);
//   }

//   return {
//     state: parsed.state,
//     confidence: clamp01(parsed.confidence ?? signals.heuristic.confidence),
//     evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 6) : [],
//     rationale: parsed.rationale || "",
//     recommendedAction: parsed.recommendedAction || NUDGES[parsed.state],
//     alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3) : [],
//     source: "llm",
//     model,
//   };
// }

// function clamp01(n) {
//   const x = Number(n);
//   if (Number.isNaN(x)) return 0.5;
//   return Math.max(0, Math.min(1, x));
// }

// /**
//  * Hybrid classify: signals always run; LLM enriches when key is present.
//  * On LLM failure, fall back to heuristic so the demo never hard-crashes.
//  */
// async function classifySession(events) {
//   if (!Array.isArray(events) || events.length === 0) {
//     const err = new Error("events array is required");
//     err.status = 400;
//     throw err;
//   }

//   const signals = extractSignals(events);
//   const fallback = buildFallback(signals, events);

//   try {
//     const llm = await classifyWithLlm(events, signals);
//     if (!llm) {
//       return { ...fallback, signals };
//     }
//     // If LLM disagrees wildly with strong heuristic, keep LLM but flag it.
//     const agree = llm.state === signals.heuristic.state;
//     return {
//       ...llm,
//       signals,
//       meta: {
//         heuristicState: signals.heuristic.state,
//         heuristicConfidence: signals.heuristic.confidence,
//         agreement: agree,
//       },
//     };
//   } catch (err) {
//     console.error("LLM classify failed, using heuristic:", err.message);
//     return {
//       ...fallback,
//       signals,
//       meta: { llmError: err.message },
//     };
//   }
// }

// module.exports = { classifySession, NUDGES };

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { extractSignals } = require("./signals");

const NUDGES = {
  browser: {
    action: "inspire_not_hard_sell",
    copy: "Surface a short editorial story + 3 hero picks; soft social proof, no urgency timers.",
  },
  comparer: {
    action: "decision_aids",
    copy: "Show a compare strip of recently viewed SKUs with size/fit callouts and a clear “best for” label.",
  },
  discount_seeker: {
    action: "value_transparency",
    copy: "Reveal eligible threshold progress (e.g. free shipping) and one honest code — avoid fake scarcity.",
  },
  cart_abandoner: {
    action: "friction_remove_plus_reassure",
    copy: "Offer express checkout, trust badges at payment, and a low-friction save-for-later with restock alert.",
  },
  loyal_customer: {
    action: "recognize_and_replenish",
    copy: "Greet by name, surface reorder of prior SKUs, and unlock a loyalty-only early access module.",
  },
};

function buildFallback(signals, events) {
  const state = signals.heuristic.state;
  const nudge = NUDGES[state];

  return {
    state,
    confidence: signals.heuristic.confidence,

    evidence: signals.evidence.slice(0, 5).map((e) => ({
      claim: e.signal.replace(/_/g, " "),
      detail: e.detail,
      weight: e.weight,
    })),

    rationale: `Heuristic ranking led with ${state} (score ${
      signals.heuristic.ranked[0].score
    }) based on ${
      signals.evidence.length
    } extracted signals across ${events.length} events.`,

    recommendedAction: {
      type: nudge.action,
      message: nudge.copy,
      priority:
        signals.heuristic.confidence >= 0.7 ? "high" : "medium",
    },

    alternatives: signals.heuristic.ranked
      .slice(1, 3)
      .map((r) => ({
        state: r.state,
        confidence: Number(
          Math.max(
            0.2,
            (r.score /
              (signals.heuristic.ranked[0].score || 1)) *
              signals.heuristic.confidence *
              0.7
          ).toFixed(2)
        ),
      })),

    source: "heuristic",
  };
}

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  });
}

async function classifyWithLlm(events, signals) {
  const modelClient = getClient();

  if (!modelClient) {
    return null;
  }

  const modelName =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const system = `You are an ecommerce personalization classifier for IntentLab.

Given a shopper event stream and pre-extracted signals, classify the shopper into exactly one state:

- browser: shallow exploration, low purchase urgency
- comparer: researching / comparing multiple SKUs before deciding
- discount_seeker: oriented around promos, sale, or price sensitivity
- cart_abandoner: showed cart/checkout intent but stalled without purchase
- loyal_customer: returning / repurchase / loyalty markers

Rules:
- Ground every claim in the provided events or signals.
- Do not invent SKUs, events, prices, or behavior.
- Prefer cart_abandoner over comparer when checkout was started and no purchase occurred.
- Prefer loyal_customer when returning + prior orders / repurchase signals are strong.
- confidence must be between 0 and 1.
- recommendedAction must be a concrete on-site nudge.
- Return valid JSON only.
`;

  const user = JSON.stringify(
    {
      events,
      signals: {
        features: signals.features,
        evidence: signals.evidence,
        heuristicTop: signals.heuristic,
      },
    },
    null,
    2
  );

  const prompt = `${system}

SHOPPER DATA:

${user}

Return JSON using exactly this structure:

{
  "state": "browser|comparer|discount_seeker|cart_abandoner|loyal_customer",
  "confidence": 0.0,
  "evidence": [
    {
      "claim": "...",
      "detail": "...",
      "weight": 0.0
    }
  ],
  "rationale": "1-3 sentences",
  "recommendedAction": {
    "type": "snake_case_action",
    "message": "...",
    "priority": "high|medium|low"
  },
  "alternatives": [
    {
      "state": "...",
      "confidence": 0.0
    }
  ]
}`;

  const result = await modelClient.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const raw = result.response.text();

  if (!raw) {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Gemini returned invalid JSON");
  }

  const validStates = new Set([
    "browser",
    "comparer",
    "discount_seeker",
    "cart_abandoner",
    "loyal_customer",
  ]);

  if (!validStates.has(parsed.state)) {
    throw new Error(
      `Invalid state from Gemini: ${parsed.state}`
    );
  }

  return {
    state: parsed.state,

    confidence: clamp01(
      parsed.confidence ?? signals.heuristic.confidence
    ),

    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence.slice(0, 6)
      : [],

    rationale: parsed.rationale || "",

    recommendedAction:
      parsed.recommendedAction ||
      NUDGES[parsed.state],

    alternatives: Array.isArray(parsed.alternatives)
      ? parsed.alternatives.slice(0, 3)
      : [],

    source: "llm",

    model: modelName,
  };
}

function clamp01(n) {
  const x = Number(n);

  if (Number.isNaN(x)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, x));
}

/**
 * Hybrid classification:
 *
 * 1. Extract deterministic signals
 * 2. Try Gemini LLM
 * 3. If Gemini succeeds -> return LLM result
 * 4. If Gemini fails -> return heuristic fallback
 *
 * This keeps the demo functional even when the LLM is unavailable.
 */
async function classifySession(events) {
  if (!Array.isArray(events) || events.length === 0) {
    const err = new Error("events array is required");
    err.status = 400;
    throw err;
  }

  const signals = extractSignals(events);

  const fallback = buildFallback(
    signals,
    events
  );

  try {
    const llm = await classifyWithLlm(
      events,
      signals
    );

    if (!llm) {
      return {
        ...fallback,
        signals,
      };
    }

    const agree =
      llm.state === signals.heuristic.state;

    return {
      ...llm,

      signals,

      meta: {
        heuristicState:
          signals.heuristic.state,

        heuristicConfidence:
          signals.heuristic.confidence,

        agreement: agree,
      },
    };
  } catch (err) {
    console.error(
      "LLM classify failed, using heuristic:",
      err.message
    );

    return {
      ...fallback,

      signals,

      meta: {
        llmError: err.message,
      },
    };
  }
}

module.exports = {
  classifySession,
  NUDGES,
};