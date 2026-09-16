// require("dotenv").config();

// const express = require("express");
// const cors = require("cors");
// const api = require("./routes/api");

// const app = express();
// const PORT = process.env.PORT || 3001;

// app.use(cors({ origin: true }));
// app.use(express.json({ limit: "1mb" }));
// app.use("/api", api);

// app.use((err, _req, res, _next) => {
//   console.error(err);
//   res.status(500).json({ error: "Internal server error" });
// });

// app.listen(PORT, () => {
//   console.log(`IntentLab API on http://localhost:${PORT}`);
//   console.log(`LLM: ${process.env.OPENAI_API_KEY ? "enabled" : "heuristic fallback (set OPENAI_API_KEY)"}`);
// });

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const api = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", api);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`IntentLab API on http://localhost:${PORT}`);

  const llmEnabled =
    Boolean(process.env.GEMINI_API_KEY) ||
    Boolean(process.env.OPENAI_API_KEY);

  console.log(
    `LLM: ${
      llmEnabled
        ? "enabled"
        : "heuristic fallback (set GEMINI_API_KEY)"
    }`
  );
});