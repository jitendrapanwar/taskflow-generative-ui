/**
 * TaskFlow AI — CopilotKit Node.js Runtime Server
 * No remoteEndpoints needed — frontend handles all AI actions.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
  path.resolve(process.cwd(), ".env"),
];

const resolvedEnvPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (resolvedEnvPath) {
  config({ path: resolvedEnvPath });
} else {
  config();
}

import {
  CopilotRuntime,
  OpenAIAdapter,
  AnthropicAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from "@copilotkit/runtime";

const originalWarn = console.warn.bind(console);
console.warn = (...args) => {
  const message = args.join(" ");
  if (message.includes("AI SDK Warning: System messages")) {
    return;
  }
  originalWarn(...args);
};

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

function createAdapter() {
  console.log(`🤖  OpenAI API Key found`);
  if (process.env.OPENAI_API_KEY) {

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";
    console.log(`🤖  OpenAI — ${model}`);
    return new OpenAIAdapter({ model });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    console.log(`🤖  Anthropic — ${model}`);
    return new AnthropicAdapter({ model });
  }
  throw new Error("❌  Set OPENAI_API_KEY or ANTHROPIC_API_KEY in frontend/.env or your shell environment");
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