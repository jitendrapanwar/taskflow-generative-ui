/**
 * TaskFlow AI — CopilotKit Node.js Runtime Server
 *
 * This is the missing piece between your React frontend and an LLM.
 * It runs on port 4000 and exposes POST /copilotkit for the frontend.
 *
 * Supports: OpenAI, Anthropic, or Google (swap the adapter below).
 */

import { config } from "dotenv";
import express from "express";
import cors from "cors";
config();

import {
  CopilotRuntime,
  OpenAIAdapter,
  AnthropicAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from "@copilotkit/runtime";

const app = express();
const PORT = process.env.PORT || 4000;

// ── CORS — allow the React Vite dev server ──────────────────────────────────
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Pick your LLM adapter ───────────────────────────────────────────────────
function createAdapter() {

  console.log("🤖 Using OpenAI adapter (gpt-4o-mini)");
  try {
    return new OpenAIAdapter({
      model: "gpt-4o-mini",
      // apiKey is auto-read from OPENAI_API_KEY env var
      allowSystemInMessages: false,
    });
  } catch (err) {
    throw new Error(
      "❌  No LLM API key found!\n" +
      "    Set OPENAI_API_KEY or ANTHROPIC_API_KEY in runtime/.env"
    );

  }
}

// if (process.env.ANTHROPIC_API_KEY) {
//   console.log("🤖 Using Anthropic adapter (claude-haiku-4-5)");
//   return new AnthropicAdapter({
//     model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
//     // apiKey is auto-read from ANTHROPIC_API_KEY env var
//   });
// }




// ── CopilotKit Runtime ──────────────────────────────────────────────────────
const serviceAdapter = createAdapter();
const runtime = new CopilotRuntime();

// const runtime = new CopilotRuntime({
//   remoteEndpoints: {
//     url: "http://localhost:8000/copilotkit",
//   },
// });



// ── KEY FIX: mount at root, NOT app.use('/copilotkit', handler) ───────────────
// The handler is built with endpoint: '/copilotkit' as its basePath.
// Hono internally matches the full path, so the request URL must include
// '/copilotkit'. If we mount at '/copilotkit' in Express, Express strips it
// before the handler sees it — breaking the Hono basePath match.
const copilotHandler = copilotRuntimeNodeExpressEndpoint({
  endpoint: "/copilotkit",
  runtime,
  serviceAdapter,
});



app.use("/copilotkit", (req, res, next) => {
  // Restore the full path so Hono's basePath matching works correctly.
  // Express strips the mount prefix from req.url; we put it back.
  req.url = "/copilotkit" + (req.url === "/" ? "" : req.url);
  return copilotHandler(req, res);
});

// ── Health check ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "CopilotKit Node Runtime",
    version: "1.57.4",
    endpoint: "/copilotkit",
    adapter: process.env.OPENAI_API_KEY ? "OpenAI" : "Anthropic",
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  CopilotKit runtime running at http://localhost:${PORT}`);
  console.log(`   Endpoint: http://localhost:${PORT}/copilotkit`);
  console.log(`\n   Point your frontend at this URL:`);
  console.log(`   VITE_RUNTIME_URL=http://localhost:${PORT}/copilotkit\n`);
})