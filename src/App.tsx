import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };
type HistoryKind = "brainstorm" | "script";
type HistoryItem = {
  id: number;
  kind: HistoryKind;
  title: string;
  payload: unknown;
  createdAt: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function apiJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as T;
}

function BrainstormPanel({
  messages,
  draft,
  setDraft,
  onSend,
  loading,
  error,
}: {
  messages: ChatMessage[];
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  error: string | null;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-sm">
      <header className="mb-4">
        <h2 className="font-display text-2xl text-zinc-50">Brainstorm</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Chat through angles, titles, segments, and hooks before you write.
        </p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-zinc-950/50 p-4 ring-1 ring-zinc-800/60">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Try: “Podcast about urban composting for renters — need a punchy cold
            open.”
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-8 bg-violet-600/20 text-violet-100 ring-1 ring-violet-500/30"
                : "mr-8 bg-zinc-800/60 text-zinc-200"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="mr-8 rounded-lg bg-zinc-800/40 px-3 py-2 text-sm text-zinc-400">
            Thinking…
          </div>
        )}
        <div ref={bottom} />
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Describe your show idea or paste rough notes…"
          rows={3}
          className="min-h-[88px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/0 transition placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/30"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !draft.trim()}
          className="self-end rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </section>
  );
}

function StudioPanel({
  topic,
  setTopic,
  tone,
  setTone,
  length,
  setLength,
  notes,
  setNotes,
  script,
  setScript,
  onGenerateScript,
  scriptLoading,
  error,
}: {
  topic: string;
  setTopic: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  length: string;
  setLength: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  script: string;
  setScript: (v: string) => void;
  onGenerateScript: () => void;
  scriptLoading: boolean;
  error: string | null;
}) {
  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-sm">
      <header className="mb-4">
        <h2 className="font-display text-2xl text-zinc-50">Script</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Generate a full episode script and edit it before recording.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Topic / episode focus
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/50"
            placeholder="e.g. How cities quietly shape what we eat"
          />
        </label>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tone
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/50"
            placeholder="friendly expert, curious, warm"
          />
        </label>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Target length
          <input
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/50"
            placeholder="8–12 minute episode"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        Extra notes (optional)
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/50"
          placeholder="Mention guest Dr. Lee; avoid politics"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerateScript}
          disabled={scriptLoading || !topic.trim()}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scriptLoading ? "Writing script…" : "Generate script"}
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(script)}
          disabled={!script.trim()}
          className="rounded-xl text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline disabled:opacity-30"
        >
          Copy script
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <label className="mt-4 block flex-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Script
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={14}
          className="mt-1 w-full flex-1 resize-y rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-100 outline-none focus:border-sky-500/50"
          placeholder="Generated script appears here — edit freely."
        />
      </label>

    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState<"brainstorm" | "studio">("brainstorm");
  const [health, setHealth] = useState<{ ok: boolean; hasKey: boolean } | null>(
    null,
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("friendly expert");
  const [length, setLength] = useState("8–12 minute episode");
  const [notes, setNotes] = useState("");
  const [script, setScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/health"))
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, hasKey: false }));
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { items } = await apiGet<{ items: HistoryItem[] }>("/api/history?limit=25");
      setHistory(items);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory().catch(() => {});
  }, [loadHistory]);

  const sendChat = useCallback(async () => {
    const text = chatDraft.trim();
    if (!text || chatLoading) return;
    setChatError(null);
    setChatDraft("");
    const next: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next);
    setChatLoading(true);
    try {
      const msgs = next.map((m) => ({ role: m.role, content: m.content }));
      const { message } = await apiJson<{ message: string }>("/api/chat", {
        messages: msgs,
      });
      setChatMessages([...next, { role: "assistant", content: message }]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Request failed");
      setChatMessages(next);
    } finally {
      setChatLoading(false);
    }
  }, [chatDraft, chatLoading, chatMessages]);

  const generateScript = useCallback(async () => {
    if (!topic.trim()) return;
    setStudioError(null);
    setScriptLoading(true);
    try {
      const { script: s } = await apiJson<{ script: string }>("/api/script", {
        topic,
        tone,
        length,
        extra: notes,
      });
      setScript(s);
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : "Script failed");
    } finally {
      setScriptLoading(false);
    }
  }, [topic, tone, length, notes]);

  const saveBrainstorm = useCallback(async () => {
    if (chatMessages.length === 0) {
      setChatError("Add messages before saving history");
      return;
    }
    setChatError(null);
    try {
      const firstUser =
        chatMessages.find((m) => m.role === "user")?.content || "Brainstorm chat";
      await apiJson("/api/history", {
        kind: "brainstorm",
        title: firstUser.slice(0, 80),
        payload: { messages: chatMessages },
      });
      await loadHistory();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to save history");
    }
  }, [chatMessages, loadHistory]);

  const saveScript = useCallback(async () => {
    if (!script.trim()) {
      setStudioError("Generate or write a script before saving history");
      return;
    }
    setStudioError(null);
    try {
      await apiJson("/api/history", {
        kind: "script",
        title: topic.trim().slice(0, 80) || "Untitled script",
        payload: { topic, tone, length, notes, script },
      });
      await loadHistory();
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : "Failed to save history");
    }
  }, [topic, tone, length, notes, script, loadHistory]);

  const applyHistory = useCallback((item: HistoryItem) => {
    if (item.kind === "brainstorm") {
      const payload = item.payload as { messages?: ChatMessage[] };
      const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
      setChatMessages(msgs);
      setTab("brainstorm");
      return;
    }
    const payload = item.payload as {
      topic?: string;
      tone?: string;
      length?: string;
      notes?: string;
      script?: string;
    };
    setTopic(String(payload?.topic ?? ""));
    setTone(String(payload?.tone ?? "friendly expert"));
    setLength(String(payload?.length ?? "8–12 minute episode"));
    setNotes(String(payload?.notes ?? ""));
    setScript(String(payload?.script ?? ""));
    setTab("studio");
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/90">
            Prototype
          </p>
          <h1 className="font-display mt-1 text-4xl text-white sm:text-5xl">
            AI Podcast Studio
          </h1>
          <p className="mt-2 max-w-xl text-zinc-400">
            Brainstorm with a producer-style chatbot, then generate full scripts
            — API key stays on the server.
          </p>
        </div>
        {health && !health.hasKey && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            Add <code className="rounded bg-black/30 px-1">OPENROUTER_API_KEY</code> to{" "}
            <code className="rounded bg-black/30 px-1">.env</code> (see{" "}
            <code className="rounded bg-black/30 px-1">.env.example</code>).
          </div>
        )}
      </header>

      <div className="mb-6 flex gap-2 rounded-xl bg-zinc-900/50 p-1 ring-1 ring-zinc-800">
        {(
          [
            ["brainstorm", "Brainstorm"],
            ["studio", "Script"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === id
                ? "bg-zinc-800 text-white shadow ring-1 ring-zinc-700"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1">
        {tab === "brainstorm" ? (
          <BrainstormPanel
            messages={chatMessages}
            draft={chatDraft}
            setDraft={setChatDraft}
            onSend={sendChat}
            loading={chatLoading}
            error={chatError}
          />
        ) : (
          <StudioPanel
            topic={topic}
            setTopic={setTopic}
            tone={tone}
            setTone={setTone}
            length={length}
            setLength={setLength}
            notes={notes}
            setNotes={setNotes}
            script={script}
            setScript={setScript}
            onGenerateScript={generateScript}
            scriptLoading={scriptLoading}
            error={studioError}
          />
        )}

        <section className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-xl text-zinc-50">Saved history</h3>
            <div className="flex gap-2">
              {tab === "brainstorm" ? (
                <button
                  type="button"
                  onClick={saveBrainstorm}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
                >
                  Save brainstorm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveScript}
                  className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500"
                >
                  Save script
                </button>
              )}
              <button
                type="button"
                onClick={() => loadHistory()}
                className="rounded-xl border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
              >
                Refresh
              </button>
            </div>
          </div>
          {historyError && (
            <p className="mb-2 text-sm text-red-400" role="alert">
              {historyError}
            </p>
          )}
          {historyLoading && <p className="text-sm text-zinc-500">Loading history…</p>}
          {!historyLoading && history.length === 0 && (
            <p className="text-sm text-zinc-500">
              No saved entries yet. Save a brainstorm or script to keep it.
            </p>
          )}
          <div className="space-y-2">
            {history.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => applyHistory(item)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-left text-sm hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-zinc-100">{item.title}</span>
                  <span className="shrink-0 text-xs uppercase tracking-wide text-zinc-500">
                    {item.kind}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{item.createdAt}</p>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-12 text-center text-xs text-zinc-600">
        Uses OpenRouter for chat + script generation.
      </footer>
    </div>
  );
}
