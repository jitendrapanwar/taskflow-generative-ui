/**
 * TaskFlow AI — CopilotKit Node.js Runtime Server
 * No remoteEndpoints needed — frontend handles all AI actions.
 */
import { config } from "dotenv";
import express from "express";
import cors from "cors";
config()

import {
  CopilotRuntime,
  OpenAIAdapter,
  AnthropicAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from "@copilotkit/runtime";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

function createAdapter() {
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    console.log(`🤖  OpenAI — ${model}`);
    return new OpenAIAdapter({ model });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    console.log(`🤖  Anthropic — ${model}`);
    return new AnthropicAdapter({ model });
  }
  throw new Error("❌  Set OPENAI_API_KEY or ANTHROPIC_API_KEY in runtime/.env");
}

// No remoteEndpoints — Python is a plain REST API, not a CopilotKit endpoint
const runtime = new CopilotRuntime();
const serviceAdapter = createAdapter();

const copilotHandler = copilotRuntimeNodeExpressEndpoint({
  endpoint: "/copilotkit",
  runtime,
  serviceAdapter,
});

app.use("/copilotkit", (req, res) => {
  req.url = "/copilotkit" + (req.url === "/" ? "" : req.url);
  return copilotHandler(req, res);
});

app.get("/", (_req, res) => res.json({ status: "ok", endpoint: `/copilotkit` }));

app.listen(PORT, () => {
  console.log(`\n✅  Node runtime → http://localhost:${PORT}/copilotkit\n`);
});