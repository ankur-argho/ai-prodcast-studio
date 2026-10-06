import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { AuthModal } from "./components/AuthModal";

type ChatMessage = { role: "user" | "assistant"; content: string };
type HistoryKind = "brainstorm" | "script";
type HistoryItem = {
  id: number | string;
  kind: HistoryKind;
  title: string;
  payload: unknown;
  createdAt: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
type Theme = "light" | "dark";

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function apiJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
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

async function apiDelete<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  isDark,
  chatLimitReached,
  user,
  onOpenSignIn,
}: {
  messages: ChatMessage[];
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  error: string | null;
  isDark: boolean;
  chatLimitReached: boolean;
  user: User | null;
  onOpenSignIn: () => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <section
      className={`flex h-full min-h-[420px] flex-col rounded-2xl border p-5 shadow-xl backdrop-blur-sm ${
        isDark ? "border-zinc-800/80 bg-zinc-900/40" : "border-zinc-200 bg-white/70"
      }`}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className={`font-display text-2xl ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
            Brainstorm
          </h2>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Chat through angles, titles, segments, and hooks before you write.
          </p>
        </div>
        {user && (
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            chatLimitReached
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          }`}>
            {chatLimitReached ? "1/1 Free Chat Used" : "1 Free Chat Remaining"}
          </span>
        )}
      </header>
      <div
        className={`flex-1 space-y-3 overflow-y-auto rounded-xl p-4 ring-1 ${
          isDark ? "bg-zinc-950/50 ring-zinc-800/60" : "bg-white/90 ring-zinc-200"
        }`}
      >
        {messages.length === 0 && (
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            Try: “Podcast about urban composting for renters — need a punchy cold
            open.”
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? isDark
                  ? "ml-8 bg-violet-600/20 text-violet-100 ring-1 ring-violet-500/30"
                  : "ml-8 bg-violet-100 text-violet-800 ring-1 ring-violet-200"
                : isDark
                  ? "mr-8 bg-zinc-800/60 text-zinc-200"
                  : "mr-8 bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
            }`}
          >
            <span className="whitespace-pre-wrap">{m.content}</span>
          </div>
        ))}
        {loading && (
          <div
            className={`mr-8 rounded-lg px-3 py-2 text-sm ${
              isDark ? "bg-zinc-800/40 text-zinc-400" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            Thinking…
          </div>
        )}
        <div ref={bottom} />
      </div>

      {!user ? (
        <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-center text-xs text-violet-300">
          Please{" "}
          <button type="button" onClick={onOpenSignIn} className="font-bold underline hover:text-white">
            Sign In
          </button>{" "}
          or create an account to start brainstorming.
        </div>
      ) : chatLimitReached ? (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs font-medium text-amber-300">
          You've used your free chat. Upgrade to continue.
        </div>
      ) : null}

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <textarea
          value={draft}
          disabled={chatLimitReached || !user}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={
            !user
              ? "Please sign in to start chatting…"
              : chatLimitReached
              ? "Free chat limit reached. Upgrade to continue."
              : "Describe your show idea or paste rough notes…"
          }
          rows={3}
          className={`min-h-[88px] flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none ring-violet-500/0 transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
            isDark
              ? "border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
              : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400"
          }`}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !draft.trim() || chatLimitReached || !user}
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
  isDark,
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
  isDark: boolean;
}) {
  return (
    <section
      className={`flex min-h-[420px] flex-col rounded-2xl border p-5 shadow-xl backdrop-blur-sm ${
        isDark ? "border-zinc-800/80 bg-zinc-900/40" : "border-zinc-200 bg-white/70"
      }`}
    >
      <header className="mb-4">
        <h2 className={`font-display text-2xl ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
          Script
        </h2>
        <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          Generate a full episode script and edit it before recording.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className={`block text-xs font-medium uppercase tracking-wide ${
            isDark ? "text-zinc-500" : "text-zinc-600"
          }`}
        >
          Topic / episode focus
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-sky-500/50 ${
              isDark
                ? "border-zinc-700 bg-zinc-950/60 text-zinc-100"
                : "border-zinc-300 bg-white text-zinc-900"
            }`}
            placeholder="e.g. How cities quietly shape what we eat"
          />
        </label>
        <label
          className={`block text-xs font-medium uppercase tracking-wide ${
            isDark ? "text-zinc-500" : "text-zinc-600"
          }`}
        >
          Tone
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-sky-500/50 ${
              isDark
                ? "border-zinc-700 bg-zinc-950/60 text-zinc-100"
                : "border-zinc-300 bg-white text-zinc-900"
            }`}
            placeholder="friendly expert, curious, warm"
          />
        </label>
        <label
          className={`block text-xs font-medium uppercase tracking-wide ${
            isDark ? "text-zinc-500" : "text-zinc-600"
          }`}
        >
          Target length
          <input
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-sky-500/50 ${
              isDark
                ? "border-zinc-700 bg-zinc-950/60 text-zinc-100"
                : "border-zinc-300 bg-white text-zinc-900"
            }`}
          />
        </label>
        <label
          className={`block text-xs font-medium uppercase tracking-wide ${
            isDark ? "text-zinc-500" : "text-zinc-600"
          }`}
        >
          Extra notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-sky-500/50 ${
              isDark
                ? "border-zinc-700 bg-zinc-950/60 text-zinc-100"
                : "border-zinc-300 bg-white text-zinc-900"
            }`}
            placeholder="guest names, sponsor shoutout…"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onGenerateScript}
        disabled={scriptLoading || !topic.trim()}
        className="mt-4 self-start rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:opacity-40"
      >
        {scriptLoading ? "Drafting script…" : "Generate script"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-1 flex-col">
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Script output will appear here. Edit freely."
          rows={12}
          className={`min-h-[260px] flex-1 resize-y rounded-xl border p-4 text-sm font-mono leading-relaxed outline-none focus:border-violet-500/50 ${
            isDark
              ? "border-zinc-700 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-600"
              : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400"
          }`}
        />
      </div>
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

  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [chatsUsed, setChatsUsed] = useState(0);
  const [chatLimitReached, setChatLimitReached] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectingHistory, setSelectingHistory] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<(number | string)[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openSignIn = () => {
    setAuthModalMode("signin");
    setAuthModalOpen(true);
  };

  const checkUserUsage = useCallback(async (token?: string) => {
    if (!token) {
      setChatsUsed(0);
      setChatLimitReached(false);
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/user/usage"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (data.chatsUsed !== undefined) {
        setChatsUsed(data.chatsUsed);
        setChatLimitReached(Boolean(data.limitReached || data.chatsUsed >= 1));
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.access_token) {
        checkUserUsage(data.session.access_token);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.access_token) {
        checkUserUsage(session.access_token);
      } else {
        setChatsUsed(0);
        setChatLimitReached(false);
      }

      if (event === "SIGNED_IN") {
        setToastMsg("Welcome back! 👋");
        setTimeout(() => setToastMsg(null), 4000);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [checkUserUsage]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setToastMsg("You have been signed out successfully.");
    setTimeout(() => setToastMsg(null), 3000);
  };

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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
      if (supabase && user) {
        const { data, error } = await supabase
          .from("history_items")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25);
        if (error) throw error;
        const items: HistoryItem[] = (data || []).map((row: any) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          payload: row.payload,
          createdAt: new Date(row.created_at).toLocaleString(),
        }));
        setHistory(items);
        setSelectedHistoryIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
      } else {
        const { items } = await apiGet<{ items: HistoryItem[] }>("/api/history?limit=25");
        setHistory(items);
        setSelectedHistoryIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
      }
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  const toggleHistorySelection = useCallback((id: number | string) => {
    setSelectedHistoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const deleteSelectedHistory = useCallback(async () => {
    if (selectedHistoryIds.length === 0 || deleteLoading) return;
    setHistoryError(null);
    setDeleteLoading(true);
    try {
      if (supabase && user) {
        const { error } = await supabase
          .from("history_items")
          .delete()
          .in("id", selectedHistoryIds);
        if (error) throw error;
      } else {
        await apiDelete("/api/history", { ids: selectedHistoryIds });
      }
      setSelectedHistoryIds([]);
      setSelectingHistory(false);
      await loadHistory();
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Failed to delete history");
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedHistoryIds, deleteLoading, user, loadHistory]);

  useEffect(() => {
    loadHistory().catch(() => {});
  }, [loadHistory]);

  const sendChat = useCallback(async () => {
    const text = chatDraft.trim();
    if (!text || chatLoading) return;

    if (!user) {
      setChatError("Please sign in or create an account to use AI chat.");
      openSignIn();
      return;
    }

    if (chatLimitReached || chatsUsed >= 1) {
      setChatError("You've used your free chat. Please upgrade to continue.");
      return;
    }

    setChatError(null);
    setChatDraft("");
    const next: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next);
    setChatLoading(true);

    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const token = session?.access_token;
      const msgs = next.map((m) => ({ role: m.role, content: m.content }));
      const { message } = await apiJson<{ message: string }>(
        "/api/chat",
        { messages: msgs },
        token
      );
      setChatMessages([...next, { role: "assistant", content: message }]);
      setChatsUsed((prev) => prev + 1);
      setChatLimitReached(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      if (msg.includes("used your free chat")) {
        setChatLimitReached(true);
      }
      setChatError(msg);
      setChatMessages(next);
    } finally {
      setChatLoading(false);
    }
  }, [chatDraft, chatLoading, chatMessages, user, chatLimitReached, chatsUsed]);

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
      const title = firstUser.slice(0, 80);
      const payload = { messages: chatMessages };

      if (supabase && user) {
        const { error } = await supabase.from("history_items").insert({
          user_id: user.id,
          kind: "brainstorm",
          title,
          payload,
        });
        if (error) throw error;
      } else {
        await apiJson("/api/history", {
          kind: "brainstorm",
          title,
          payload,
        });
      }
      await loadHistory();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to save history");
    }
  }, [chatMessages, user, loadHistory]);

  const saveScript = useCallback(async () => {
    if (!script.trim()) {
      setStudioError("Generate or write a script before saving history");
      return;
    }
    setStudioError(null);
    try {
      const title = topic.trim().slice(0, 80) || "Untitled script";
      const payload = { topic, tone, length, notes, script };

      if (supabase && user) {
        const { error } = await supabase.from("history_items").insert({
          user_id: user.id,
          kind: "script",
          title,
          payload,
        });
        if (error) throw error;
      } else {
        await apiJson("/api/history", {
          kind: "script",
          title,
          payload,
        });
      }
      await loadHistory();
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : "Failed to save history");
    }
  }, [topic, tone, length, notes, script, user, loadHistory]);

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
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-zinc-900/90 px-5 py-3 text-sm font-semibold text-emerald-400 shadow-2xl backdrop-blur-md transition-all">
          {toastMsg}
        </div>
      )}

      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/90">
            Prototype
          </p>
          <h1 className={`font-display mt-1 text-4xl sm:text-5xl ${isDark ? "text-white" : "text-zinc-900"}`}>
            AI Podcast Studio
          </h1>
          <p className={`mt-2 max-w-xl ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Brainstorm with a producer-style chatbot, then generate full scripts
            — API key stays on the server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-sm ${isDark ? "border-zinc-700 bg-zinc-900/80 text-zinc-200" : "border-zinc-300 bg-white text-zinc-800"}`}>
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Avatar"
                  className="h-6 w-6 rounded-full ring-1 ring-violet-500"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  {(user.user_metadata?.full_name || user.email || "A").slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-semibold text-violet-400">
                Welcome, {user.user_metadata?.full_name || user.email?.split("@")[0]} 👋
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/20"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openSignIn}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold shadow-sm transition ${
                isDark
                  ? "border-violet-500/40 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30"
                  : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
              }`}
            >
              Sign In / Sign Up
            </button>
          )}

          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
              isDark
                ? "border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {isDark ? "Light mode" : "Dark mode"}
          </button>
        </div>
        {health && !health.hasKey && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            Add <code className="rounded bg-black/30 px-1">OPENROUTER_API_KEY</code> to{" "}
            <code className="rounded bg-black/30 px-1">.env</code> (see{" "}
            <code className="rounded bg-black/30 px-1">.env.example</code>).
          </div>
        )}
      </header>

      <div
        className={`mb-6 flex gap-2 rounded-xl p-1 ring-1 ${
          isDark ? "bg-zinc-900/50 ring-zinc-800" : "bg-zinc-100/70 ring-zinc-300"
        }`}
      >
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
                ? isDark
                  ? "bg-zinc-800 text-white shadow ring-1 ring-zinc-700"
                  : "bg-white text-zinc-900 shadow ring-1 ring-zinc-200"
                : isDark
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-zinc-500 hover:text-zinc-700"
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
            isDark={isDark}
            chatLimitReached={chatLimitReached}
            user={user}
            onOpenSignIn={openSignIn}
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
            isDark={isDark}
          />
        )}

        <section
          className={`mt-10 rounded-2xl border p-5 shadow-xl backdrop-blur-sm ${
            isDark ? "border-zinc-800/80 bg-zinc-900/40" : "border-zinc-200 bg-white/70"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className={`font-display text-xl ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
                Saved history
              </h2>
              <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                No saved entries yet. Save a brainstorm or script to keep it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectingHistory((prev) => !prev)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  selectingHistory
                    ? "border-red-500/50 bg-red-500/10 text-red-400"
                    : isDark
                    ? "border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {selectingHistory ? "Cancel selection" : "Select to delete"}
              </button>
              {tab === "brainstorm" ? (
                <button
                  type="button"
                  onClick={saveBrainstorm}
                  className="rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow transition hover:bg-violet-500"
                >
                  Save brainstorm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveScript}
                  className="rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow transition hover:bg-violet-500"
                >
                  Save script
                </button>
              )}
              <button
                type="button"
                onClick={() => loadHistory()}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  isDark
                    ? "border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Refresh
              </button>
            </div>
          </div>

          {selectingHistory && selectedHistoryIds.length > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <span>{selectedHistoryIds.length} item(s) selected</span>
              <button
                type="button"
                onClick={deleteSelectedHistory}
                disabled={deleteLoading}
                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting…" : "Delete selected"}
              </button>
            </div>
          )}

          {historyError && (
            <p className="mb-3 text-xs text-red-400" role="alert">
              {historyError}
            </p>
          )}

          {historyLoading && history.length === 0 && (
            <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              Loading history…
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {history.map((item) => (
              <div
                key={item.id}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  isDark
                    ? "border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900/70"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {selectingHistory && (
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.includes(item.id)}
                        onChange={() => toggleHistorySelection(item.id)}
                        className="h-4 w-4 accent-red-500"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        selectingHistory ? toggleHistorySelection(item.id) : applyHistory(item)
                      }
                      className={`truncate text-left ${
                        isDark ? "text-zinc-100" : "text-zinc-900"
                      }`}
                    >
                      {item.title}
                    </button>
                  </div>
                  <span
                    className={`shrink-0 text-xs uppercase tracking-wide ${
                      isDark ? "text-zinc-500" : "text-zinc-500"
                    }`}
                  >
                    {item.kind}
                  </span>
                </div>
                <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                  {item.createdAt}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={`mt-16 border-t py-6 text-center text-xs transition ${isDark ? "border-zinc-800/80 text-zinc-500" : "border-zinc-200 text-zinc-600"}`}>
        © 2026 Argho Ghosh. All Rights Reserved.
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        isDark={isDark}
        initialMode={authModalMode}
        onLoginSuccess={(name) => {
          setToastMsg(`Welcome back, ${name}! 👋`);
          setTimeout(() => setToastMsg(null), 4000);
        }}
      />
    </div>
  );
}
