import { useState } from "react";
import { supabase } from "../lib/supabase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  initialMode?: "signin" | "signup";
}

export function AuthModal({ isOpen, onClose, isDark, initialMode = "signin" }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSwitchMode = (newMode: "signin" | "signup") => {
    setMode(newMode);
    resetForm();
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Google sign in failed");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    if (!supabase) {
      setErrorMsg("Authentication service is not configured.");
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setErrorMsg("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || cleanEmail.split("@")[0],
            },
          },
        });

        if (error) {
          if (error.message.toLowerCase().includes("already registered") || error.status === 400) {
            setErrorMsg("An account with this email already exists. Please sign in.");
            setMode("signin");
          } else {
            setErrorMsg(error.message);
          }
          return;
        }

        // Handle case where user is already registered (Supabase identity check)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setErrorMsg("An account with this email already exists. Please sign in.");
          setMode("signin");
          return;
        }

        setSuccessMsg("Account created successfully! You can now sign in.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Sign up failed");
      } finally {
        setLoading(false);
      }
    } else {
      // Sign In Flow
      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            setErrorMsg("Invalid email or password. Please check your details and try again.");
          } else {
            setErrorMsg(error.message);
          }
          return;
        }

        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Sign in failed");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark
            ? "border-zinc-800 bg-zinc-900 text-zinc-100"
            : "border-zinc-200 bg-white text-zinc-900"
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:text-zinc-200 transition`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="mb-6 text-center">
          <h2 className="font-display text-2xl font-bold">
            {mode === "signin" ? "Welcome Back" : "Create an Account"}
          </h2>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {mode === "signin"
              ? "Sign in to access your saved brainstorms and scripts."
              : "Sign up to start saving your podcast projects."}
          </p>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div
          className={`mb-6 flex rounded-xl p-1 ring-1 ${
            isDark ? "bg-zinc-950/60 ring-zinc-800" : "bg-zinc-100 ring-zinc-200"
          }`}
        >
          <button
            type="button"
            onClick={() => handleSwitchMode("signin")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              mode === "signin"
                ? isDark
                  ? "bg-zinc-800 text-white shadow"
                  : "bg-white text-zinc-900 shadow"
                : isDark
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("signup")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              mode === "signup"
                ? isDark
                  ? "bg-zinc-800 text-white shadow"
                  : "bg-white text-zinc-900 shadow"
                : isDark
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Alert Messages */}
        {successMsg && (
          <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
            {errorMsg}
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className={`mb-4 flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
            isDark
              ? "border-zinc-700 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-800"
              : "border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.32 7.31 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.99 0 12s.46 3.84 1.26 5.42l4.02-3.15z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.68 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
          </svg>
          Continue with Google
        </button>

        <div className="relative mb-4 flex items-center justify-center">
          <div className={`w-full border-t ${isDark ? "border-zinc-800" : "border-zinc-200"}`} />
          <span className={`absolute px-2 text-[10px] uppercase ${isDark ? "bg-zinc-900 text-zinc-500" : "bg-white text-zinc-400"}`}>
            or with email
          </span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className={`mb-1 block text-xs font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs transition outline-none ${
                  isDark
                    ? "border-zinc-800 bg-zinc-950 text-white focus:border-violet-500"
                    : "border-zinc-300 bg-zinc-50 text-zinc-900 focus:border-violet-500"
                }`}
              />
            </div>
          )}

          <div>
            <label className={`mb-1 block text-xs font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-xs transition outline-none ${
                isDark
                  ? "border-zinc-800 bg-zinc-950 text-white focus:border-violet-500"
                  : "border-zinc-300 bg-zinc-50 text-zinc-900 focus:border-violet-500"
              }`}
            />
          </div>

          <div>
            <label className={`mb-1 block text-xs font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Password *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-xs transition outline-none ${
                isDark
                  ? "border-zinc-800 bg-zinc-950 text-white focus:border-violet-500"
                  : "border-zinc-300 bg-zinc-50 text-zinc-900 focus:border-violet-500"
              }`}
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className={`mb-1 block text-xs font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                Confirm Password *
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs transition outline-none ${
                  isDark
                    ? "border-zinc-800 bg-zinc-950 text-white focus:border-violet-500"
                    : "border-zinc-300 bg-zinc-50 text-zinc-900 focus:border-violet-500"
                }`}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : mode === "signin" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Footer switch prompt */}
        <div className="mt-5 text-center text-xs text-zinc-500">
          {mode === "signin" ? (
            <span>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("signup")}
                className="font-semibold text-violet-400 hover:underline"
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("signin")}
                className="font-semibold text-violet-400 hover:underline"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
