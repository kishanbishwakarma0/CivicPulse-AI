"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function AuthorityLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("civicpulse_authority_token");
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to authenticate authority."
        );
      }

      localStorage.setItem(
        "civicpulse_authority_token",
        data.access_token
      );

      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-slate-950">
              C
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                CivicPulse <span className="text-cyan-400">AI</span>
              </h1>
              <p className="text-xs text-slate-400">
                Intelligent Civic Infrastructure
              </p>
            </div>
          </a>

          <a
            href="/"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            Citizen Portal
          </a>
        </div>
      </nav>

      <section className="relative flex min-h-[calc(100vh-81px)] items-center justify-center overflow-hidden px-6 py-16">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-xl font-black text-slate-950">
              C
            </div>

            <p className="mt-7 text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Secure Authority Access
            </p>

            <h2 className="mt-3 text-4xl font-bold tracking-tight">
              Authority Login
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Sign in to manage civic issues, update their status, and
              verify resolution evidence.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl shadow-black/20"
          >
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Authority username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                  placeholder="Enter password"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-7 w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign in to Dashboard"}
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              Authority credentials are validated by the CivicPulse backend.
              Your password is never sent to the frontend after authentication.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
