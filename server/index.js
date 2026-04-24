import "dotenv/config";
import cors from "cors";
import express from "express";
import OpenAI from "openai";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const PORT = Number(process.env.PORT) || 8787;
const apiKey = process.env.OPENROUTER_API_KEY;
const siteUrl = process.env.OPENROUTER_SITE_URL || "http://localhost:5174";
const siteName = process.env.OPENROUTER_SITE_NAME || "AI Podcast Studio";
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(
  __dirname,
  process.env.DB_PATH || "../data/history.db",
);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS history_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('brainstorm', 'script')),
    title TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": siteUrl,
        "X-Title": siteName,
      },
    })
  : null;

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

function requireKey(res) {
  if (!client) {
    res.status(503).json({
      error:
        "OPENROUTER_API_KEY is not set. Create a .env file in ai-podcast-studio (see .env.example).",
    });
    return false;
  }
  return true;
}

const MODEL_ID = process.env.OPENROUTER_MODEL || "openrouter/auto";

const brainstormSystem = `You are a sharp podcast producer and story editor. You help brainstorm:
- episode titles and hooks
- audience angles and guest ideas
- segment outlines and cold opens
Always respond in clear point-by-point format:
1) Use short numbered sections with concise bullet points.
2) Keep each bullet to one idea.
3) Leave a blank line between sections for readability.
Ask a clarifying question only when the topic is too vague.`;

const scriptSystem = `You write engaging podcast scripts meant to be read aloud.

Rules:
- Use a natural, conversational host voice unless the user asks otherwise.
- Include: cold open, intro with episode promise, 2–4 main segments with transitions, and a tight outro with CTA.
- Add [PAUSE] or [MUSIC BED] sparingly where useful.
- Do not include sound effects stage directions unless asked.
- Aim for the target length; slightly under is OK.`;

app.post("/api/chat", async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { messages = [] } = req.body;
    const validMessages = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? ""),
      }));
    const completion = await client.chat.completions.create({
      model: MODEL_ID,
      messages: [{ role: "system", content: brainstormSystem }, ...validMessages],
      temperature: 0.85,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    res.json({ message: text });
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || "");
    if (msg.includes("No endpoints found")) {
      res.status(502).json({
        error:
          "Selected OpenRouter model has no active endpoints. Set OPENROUTER_MODEL=openrouter/auto or another available model in .env, then restart.",
      });
      return;
    }
    res.status(500).json({ error: msg || "Chat failed" });
  }
});

app.post("/api/script", async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const {
      topic,
      tone = "friendly expert",
      length = "8–12 minute episode",
      extra = "",
    } = req.body;

    if (!topic || typeof topic !== "string") {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    const user = `Topic: ${topic.trim()}
Tone: ${tone}
Target length: ${length}
${extra ? `Notes: ${extra}` : ""}

Write the full narration script only — no meta commentary.`;

    const completion = await client.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: "system", content: scriptSystem },
        { role: "user", content: user },
      ],
      temperature: 0.75,
    });
    const script = completion.choices[0]?.message?.content ?? "";
    res.json({ script });
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || "");
    if (msg.includes("No endpoints found")) {
      res.status(502).json({
        error:
          "Selected OpenRouter model has no active endpoints. Set OPENROUTER_MODEL=openrouter/auto or another available model in .env, then restart.",
      });
      return;
    }
    res.status(500).json({ error: msg || "Script generation failed" });
  }
});

app.get("/api/history", (_req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(_req.query.limit) || 20, 1),
      100,
    );
    const kind =
      _req.query.kind === "brainstorm" || _req.query.kind === "script"
        ? _req.query.kind
        : null;
    const rows = kind
      ? db
          .prepare(
            `SELECT id, kind, title, payload, created_at
             FROM history_items
             WHERE kind = ?
             ORDER BY id DESC
             LIMIT ?`,
          )
          .all(kind, limit)
      : db
          .prepare(
            `SELECT id, kind, title, payload, created_at
             FROM history_items
             ORDER BY id DESC
             LIMIT ?`,
          )
          .all(limit);

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        createdAt: r.created_at,
        payload: JSON.parse(r.payload),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

app.post("/api/history", (req, res) => {
  try {
    const { kind, title, payload } = req.body ?? {};
    if (kind !== "brainstorm" && kind !== "script") {
      res.status(400).json({ error: "kind must be brainstorm or script" });
      return;
    }
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (payload == null) {
      res.status(400).json({ error: "payload is required" });
      return;
    }
    const cleanTitle = title.trim().slice(0, 120);
    if (!cleanTitle) {
      res.status(400).json({ error: "title cannot be empty" });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO history_items (kind, title, payload)
         VALUES (?, ?, ?)`,
      )
      .run(kind, cleanTitle, JSON.stringify(payload));
    const row = db
      .prepare(
        `SELECT id, kind, title, payload, created_at
         FROM history_items
         WHERE id = ?`,
      )
      .get(info.lastInsertRowid);
    res.status(201).json({
      item: {
        id: row.id,
        kind: row.kind,
        title: row.title,
        createdAt: row.created_at,
        payload: JSON.parse(row.payload),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save history" });
  }
});

app.delete("/api/history", (req, res) => {
  try {
    const idsRaw = req.body?.ids;
    const ids = Array.isArray(idsRaw)
      ? idsRaw.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array of positive integers" });
      return;
    }
    const placeholders = ids.map(() => "?").join(", ");
    const result = db
      .prepare(`DELETE FROM history_items WHERE id IN (${placeholders})`)
      .run(...ids);
    res.json({ deleted: result.changes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete history items" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(client),
    model: MODEL_ID,
    provider: "openrouter",
  });
});

app.listen(PORT, () => {
  console.log(`AI Podcast Studio API http://127.0.0.1:${PORT}`);
  if (!client) {
    console.warn(
      "Warning: OPENROUTER_API_KEY missing — API routes will return 503.",
    );
  }
});
