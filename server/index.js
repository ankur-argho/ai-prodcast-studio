import "dotenv/config";
import cors from "cors";
import express from "express";
import OpenAI from "openai";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const PORT = Number(process.env.PORT) || 8787;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;
function getDb() {
  if (!db) {
    try {
      const isVercel = Boolean(process.env.VERCEL);
      const dbPath = isVercel
        ? "/tmp/history.db"
        : path.resolve(__dirname, process.env.DB_PATH || "../data/history.db");
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      db = new Database(dbPath);
      db.exec(`
        CREATE TABLE IF NOT EXISTS history_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL CHECK (kind IN ('brainstorm', 'script')),
          title TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (err) {
      console.error("Database initialization notice:", err?.message || err);
      return null;
    }
  }
  return db;
}

function getSupabaseServer() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const siteUrl = process.env.OPENROUTER_SITE_URL || "https://ai-podcast-studio.vercel.app";
  const siteName = process.env.OPENROUTER_SITE_NAME || "AI Podcast Studio";
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": siteUrl,
      "X-Title": siteName,
    },
  });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function requireKey(res) {
  const client = getClient();
  if (!client) {
    res.status(503).json({
      error:
        "OPENROUTER_API_KEY is not set. Add it in Vercel Environment Variables or .env.",
    });
    return false;
  }
  return client;
}

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

app.get("/api/user/usage", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const supabase = getSupabaseServer();
  if (!supabase || !token) {
    res.json({ chatsUsed: 0, limitReached: false });
    return;
  }
  try {
    const { data } = await supabase.auth.getUser(token);
    const user = data?.user;
    if (!user) {
      res.json({ chatsUsed: 0, limitReached: false });
      return;
    }
    const { data: usage } = await supabase
      .from("user_usages")
      .select("chats_used")
      .eq("user_id", user.id)
      .single();
    const chatsUsed = usage?.chats_used || 0;
    res.json({ chatsUsed, limitReached: chatsUsed >= 1 });
  } catch (err) {
    res.json({ chatsUsed: 0, limitReached: false });
  }
});

app.post("/api/chat", async (req, res) => {
  const client = requireKey(res);
  if (!client) return;

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const supabase = getSupabaseServer();
  let user = null;

  if (supabase && token) {
    try {
      const { data } = await supabase.auth.getUser(token);
      user = data?.user || null;
    } catch (err) {
      console.error("Auth token verification error:", err);
    }
  }

  if (supabase && !user) {
    res.status(401).json({
      error: "Authentication required. Please sign in or create an account.",
      requireAuth: true,
    });
    return;
  }

  // Enforce 1 FREE CHAT LIMIT
  if (supabase && user) {
    try {
      const { data: usage } = await supabase
        .from("user_usages")
        .select("chats_used")
        .eq("user_id", user.id)
        .single();

      if (usage && usage.chats_used >= 1) {
        res.status(403).json({
          error: "You've used your free chat. Please upgrade to continue.",
          limitReached: true,
        });
        return;
      }
    } catch (err) {
      console.error("Usage check notice:", err?.message);
    }
  }

  const modelId = process.env.OPENROUTER_MODEL || "openrouter/auto";
  try {
    const { messages = [] } = req.body;
    const validMessages = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? ""),
      }));
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: "system", content: brainstormSystem }, ...validMessages],
      temperature: 0.85,
    });
    const text = completion.choices[0]?.message?.content ?? "";

    // Increment chat count after completion success
    if (supabase && user) {
      try {
        const { data: usage } = await supabase
          .from("user_usages")
          .select("chats_used")
          .eq("user_id", user.id)
          .single();
        const currentCount = usage?.chats_used || 0;
        await supabase.from("user_usages").upsert({
          user_id: user.id,
          chats_used: currentCount + 1,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to update user usage count:", err);
      }
    }

    res.json({ message: text });
  } catch (err) {
    console.error("Chat error:", err);
    const msg = String(err?.message || "");
    if (msg.includes("No endpoints found")) {
      res.status(502).json({
        error:
          "Selected OpenRouter model has no active endpoints. Set OPENROUTER_MODEL to another model.",
      });
      return;
    }
    res.status(500).json({ error: msg || "Chat failed" });
  }
});

app.post("/api/script", async (req, res) => {
  const client = requireKey(res);
  if (!client) return;
  const modelId = process.env.OPENROUTER_MODEL || "openrouter/auto";
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
      model: modelId,
      messages: [
        { role: "system", content: scriptSystem },
        { role: "user", content: user },
      ],
      temperature: 0.75,
    });
    const script = completion.choices[0]?.message?.content ?? "";
    res.json({ script });
  } catch (err) {
    console.error("Script error:", err);
    const msg = String(err?.message || "");
    if (msg.includes("No endpoints found")) {
      res.status(502).json({
        error:
          "Selected OpenRouter model has no active endpoints. Set OPENROUTER_MODEL to another available model.",
      });
      return;
    }
    res.status(500).json({ error: msg || "Script generation failed" });
  }
});

app.get("/api/history", (_req, res) => {
  try {
    const database = getDb();
    if (!database) {
      res.json({ items: [] });
      return;
    }
    const limit = Math.min(
      Math.max(Number(_req.query.limit) || 20, 1),
      100,
    );
    const kind =
      _req.query.kind === "brainstorm" || _req.query.kind === "script"
        ? _req.query.kind
        : null;
    const rows = kind
      ? database
          .prepare(
            `SELECT id, kind, title, payload, created_at
             FROM history_items
             WHERE kind = ?
             ORDER BY id DESC
             LIMIT ?`,
          )
          .all(kind, limit)
      : database
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
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

app.post("/api/history", (req, res) => {
  try {
    const database = getDb();
    if (!database) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
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

    const info = database
      .prepare(
        `INSERT INTO history_items (kind, title, payload)
         VALUES (?, ?, ?)`,
      )
      .run(kind, cleanTitle, JSON.stringify(payload));
    const row = database
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
    console.error("History save error:", err);
    res.status(500).json({ error: "Failed to save history" });
  }
});

app.delete("/api/history", (req, res) => {
  try {
    const database = getDb();
    if (!database) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const idsRaw = req.body?.ids;
    const ids = Array.isArray(idsRaw)
      ? idsRaw.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array of positive integers" });
      return;
    }
    const placeholders = ids.map(() => "?").join(", ");
    const result = database
      .prepare(`DELETE FROM history_items WHERE id IN (${placeholders})`)
      .run(...ids);
    res.json({ deleted: result.changes });
  } catch (err) {
    console.error("History delete error:", err);
    res.status(500).json({ error: "Failed to delete history items" });
  }
});

app.get("/api/health", (_req, res) => {
  const client = getClient();
  res.json({
    ok: true,
    hasKey: Boolean(client),
    model: process.env.OPENROUTER_MODEL || "openrouter/auto",
    provider: "openrouter",
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`AI Podcast Studio API http://127.0.0.1:${PORT}`);
  });
}

export default app;
