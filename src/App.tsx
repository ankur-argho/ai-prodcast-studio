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

function getGuestToken(): string {
  if (typeof window === "undefined") return "guest_default";
  let guestToken = localStorage.getItem("ai_podcast_guest_token");
  if (!guestToken) {
    guestToken = "guest_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
    localStorage.setItem("ai_podcast_guest_token", guestToken);
  }
  return guestToken;
}

async function apiJson<T>(path: string, body: unknown, token?: string, guestToken?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (guestToken) {
    headers["x-guest-token"] = guestToken;
  }
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = (data as { error?: string }).error || res.statusText;
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).limitReached = Boolean((data as any).limitReached);
    throw err;
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
  onOpenAuthModal,
}: {
  messages: ChatMessage[];
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  error: string | null;
  isDark: boolean;
  chatLimitReached: boolean;
  onOpenAuthModal: (mode: "signin" | "signup") => void;
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
        <span
          className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${
            chatLimitReached
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {chatLimitReached ? "1/1 Free Chat Used" : "1 Free Chat Available"}
        </span>
      </header>

      <div
        className={`flex-1 space-y-3 overflow-y-auto rounded-xl p-4 ring-1 ${
          isDark ? "bg-zinc-950/50 ring-zinc-800/60" : "bg-white/90 ring-zinc-200"
        }`}
      >
        {messages.length === 0 && (
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            Try: “Podcast about urban composting for renters — need a punchy cold open.”
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

      {chatLimitReached && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-center text-xs text-amber-300">
          <div className="font-semibold">
            You've used your free chat. Please sign in or create an account to continue.
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAuthModal("signin")}
              className="rounded-lg bg-violet-600 px-3.5 py-1.5 font-semibold text-white transition hover:bg-violet-500 shadow-md"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuthModal("signup")}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 font-semibold text-zinc-200 transition hover:bg-zinc-700"
            >
              Create Account
            </button>
          </div>
        </div>
      )}

      {error && !chatLimitReached && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <textarea
          value={draft}
          disabled={chatLimitReached}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={
            chatLimitReached
              ? "You've used your free chat. Please sign in or create an account to continue."
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
          disabled={loading || !draft.trim() || chatLimitReached}
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
  const [health, setHealth] = useState<{ ok: boolean; hasKey: boolean } | null>(null);

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

  const isPermanentUser = Boolean(user && !user.is_anonymous);

  const openAuthModal = (mode: "signin" | "signup" = "signin") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const checkUserUsage = useCallback(async (token?: string, guestTokenOverride?: string) => {
    const gToken = guestTokenOverride || getGuestToken();
    const headers: Record<string, string> = {
      "x-guest-token": gToken,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const res = await fetch(apiUrl("/api/user/usage"), { headers });
      const data = await res.json().catch(() => ({}));
      if (data.chatsUsed !== undefined) {
        setChatsUsed(data.chatsUsed);
        setChatLimitReached(Boolean(data.limitReached || data.chatsUsed >= 1));
      }
    } catch {
      // Ignore network usage check errors
    }
  }, []);

  useEffect(() => {
    // Check URL parameters for OAuth errors
    const searchParams = new URLSearchParams(window.location.search);
    const hashString = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : "";
    const hashParams = new URLSearchParams(hashString);
    const errorDesc = searchParams.get("error_description") || hashParams.get("error_description");
    const errorMsg = searchParams.get("error") || hashParams.get("error");

    if (errorDesc || errorMsg) {
      const decoded = decodeURIComponent(errorDesc || errorMsg || "Authentication failed");
      if (decoded.toLowerCase().includes("unable to exchange external code")) {
        setToastMsg("Google Sign In Error: Please ensure Google OAuth Client ID & Secret are enabled in your Supabase Dashboard.");
      } else {
        setToastMsg(`Auth Error: ${decoded}`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setToastMsg(null), 8000);
    }

    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      let currentSession = data.session;
      if (!currentSession && supabase) {
        // Attempt anonymous sign in for visitors
        const { data: anonData } = await supabase.auth.signInAnonymously().catch(() => ({ data: null }));
        if (anonData?.session) {
          currentSession = anonData.session;
        }
      }
      const u = currentSession?.user ?? null;
      setUser(u);
      const token = currentSession?.access_token;
      checkUserUsage(token, getGuestToken());
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      const token = session?.access_token;
      checkUserUsage(token, getGuestToken());

      if (event === "SIGNED_IN" && session?.user && !session.user.is_anonymous) {
        setToastMsg("Welcome back! 👋");
        setTimeout(() => setToastMsg(null), 4000);

        // Link guest usage to permanent user
        const guestToken = getGuestToken();
        if (token && guestToken) {
          fetch(apiUrl("/api/user/link-guest"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ guestToken }),
          }).catch(() => {});
        }
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
    // Maintain guest usage check so logging out does NOT give another free chat
    checkUserUsage(undefined, getGuestToken());
  };

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
      if (supabase && user && !user.is_anonymous) {
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
    setSelectedHistoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const deleteSelectedHistory = useCallback(async () => {
    if (selectedHistoryIds.length === 0 || deleteLoading) return;
    setHistoryError(null);
    setDeleteLoading(true);
    try {
      if (supabase && user && !user.is_anonymous) {
        const { error } = await supabase.from("history_items").delete().in("id", selectedHistoryIds);
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

    if (chatLimitReached || chatsUsed >= 1) {
      setChatError("You've used your free chat. Please sign in or create an account to continue.");
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
      const guestToken = getGuestToken();
      const msgs = next.map((m) => ({ role: m.role, content: m.content }));

      const { message } = await apiJson<{ message: string }>("/api/chat", { messages: msgs }, token, guestToken);

      setChatMessages([...next, { role: "assistant", content: message }]);
      setChatsUsed((prev) => prev + 1);
      setChatLimitReached(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      if (msg.includes("used your free chat") || (e as any).limitReached) {
        setChatLimitReached(true);
        setChatsUsed(1);
      }
      setChatError(msg);
      setChatMessages(next);
    } finally {
      setChatLoading(false);
    }
  }, [chatDraft, chatLoading, chatMessages, chatLimitReached, chatsUsed]);

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
      const firstUser = chatMessages.find((m) => m.role === "user")?.content || "Brainstorm chat";
      const title = firstUser.slice(0, 80);
      const payload = { messages: chatMessages };

      if (supabase && user && !user.is_anonymous) {
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

      if (supabase && user && !user.is_anonymous) {
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
            Brainstorm with a producer-style chatbot, then generate full scripts — API key stays on the server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isPermanentUser ? (
            <div
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-sm ${
                isDark ? "border-zinc-700 bg-zinc-900/80 text-zinc-200" : "border-zinc-300 bg-white text-zinc-800"
              }`}
            >
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Avatar"
                  className="h-6 w-6 rounded-full ring-1 ring-violet-500"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  {(user?.user_metadata?.full_name || user?.email || "U").slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-semibold text-violet-400">
                Welcome, {user?.user_metadata?.full_name || user?.email?.split("@")[0]} 👋
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
              onClick={() => openAuthModal("signin")}
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
            onOpenAuthModal={openAuthModal}
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
      </main>

      <section
        className={`mt-8 rounded-2xl border p-5 shadow-xl backdrop-blur-sm ${
          isDark ? "border-zinc-800/80 bg-zinc-900/40" : "border-zinc-200 bg-white/70"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`font-display text-lg ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
              Saved history
            </h3>
            <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              No saved entries yet. Save a brainstorm or script to keep it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "brainstorm" ? (
              <button
                type="button"
                onClick={saveBrainstorm}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-violet-500"
              >
                Save brainstorm
              </button>
            ) : (
              <button
                type="button"
                onClick={saveScript}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-violet-500"
              >
                Save script
              </button>
            )}
            <button
              type="button"
              onClick={() => loadHistory()}
              disabled={historyLoading}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                isDark ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {historyLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {historyError && (
          <p className="mt-2 text-xs text-rose-400" role="alert">
            {historyError}
          </p>
        )}

        {history.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{history.length} saved item(s)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectingHistory(!selectingHistory);
                    setSelectedHistoryIds([]);
                  }}
                  className="font-medium text-violet-400 hover:underline"
                >
                  {selectingHistory ? "Cancel selection" : "Select to delete"}
                </button>
                {selectingHistory && selectedHistoryIds.length > 0 && (
                  <button
                    type="button"
                    onClick={deleteSelectedHistory}
                    disabled={deleteLoading}
                    className="font-medium text-rose-400 hover:underline"
                  >
                    Delete ({selectedHistoryIds.length})
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-xl border p-3 text-xs transition ${
                    isDark ? "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/60" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {selectingHistory && (
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.includes(item.id)}
                        onChange={() => toggleHistorySelection(item.id)}
                        className="h-4 w-4 rounded border-zinc-700 text-violet-600 focus:ring-violet-500"
                      />
                    )}
                    <div>
                      <span className="font-semibold text-violet-400 uppercase text-[10px] tracking-wider mr-2">
                        [{item.kind}]
                      </span>
                      <button
                        type="button"
                        onClick={() => applyHistory(item)}
                        className="font-medium hover:underline text-left"
                      >
                        {item.title}
                      </button>
                      <div className="text-[10px] text-zinc-500">{item.createdAt}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyHistory(item)}
                    className="rounded-lg bg-violet-600/10 px-2.5 py-1 text-xs font-semibold text-violet-400 hover:bg-violet-600/20"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        isDark={isDark}
        initialMode={authModalMode}
      />

      <footer className="mt-12 text-center text-xs text-zinc-500">
        © 2026 Argho Ghosh. All Rights Reserved.
      </footer>
    </div>
  );
}
