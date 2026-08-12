"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginScreenProps = {
  authNotice?: string;
  onAuthSubmitted: (email: string) => void;
};

type AuthMode = "signIn" | "signUp";

export function LoginScreen({ authNotice, onAuthSubmitted }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = authMode === "signUp";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })
      : await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setMessage(
      isSignUp
        ? "회원가입이 완료되었습니다. 이메일 확인이 켜져 있다면 메일 확인 후 로그인해 주세요."
        : "로그인되었습니다.",
    );
    onAuthSubmitted(normalizedEmail);
  }

  function switchMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setMessage("");
    setError("");
  }

  return (
    <main className="min-h-dvh bg-[#10231f] text-[#14221f]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#fdfbf6] px-5 py-6">
        <header className="pt-4">
          <div className="grid size-12 place-items-center rounded-lg bg-[#2f9f8f] text-white">
            <ShieldCheck size={24} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#5e746f]">
            Budget Book
          </p>
          <h1 className="mt-3 text-3xl font-bold">
            {isSignUp ? "회원가입" : "로그인"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#63746f]">
            이메일과 비밀번호로 내 가계부와 영수증 데이터를 안전하게 관리합니다.
          </p>
        </header>

        <section className="mt-10 rounded-lg border border-[#e2d8c7] bg-white p-4">
          <div className="grid grid-cols-2 rounded-lg bg-[#fffaf0] p-1">
            <button
              type="button"
              onClick={() => switchMode("signIn")}
              className={`h-10 rounded-md text-sm font-bold ${
                !isSignUp ? "bg-[#10231f] text-white" : "text-[#63746f]"
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => switchMode("signUp")}
              className={`h-10 rounded-md text-sm font-bold ${
                isSignUp ? "bg-[#10231f] text-white" : "text-[#63746f]"
              }`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="mt-5 block text-sm font-bold" htmlFor="email">
              이메일
            </label>
            <div className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-[#d8cebb] bg-[#fffaf0] px-3">
              <Mail size={18} className="shrink-0 text-[#257d72]" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
                placeholder="you@example.com"
              />
            </div>

            <label className="mt-4 block text-sm font-bold" htmlFor="password">
              비밀번호
            </label>
            <div className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-[#d8cebb] bg-[#fffaf0] px-3">
              <LockKeyhole size={18} className="shrink-0 text-[#257d72]" />
              <input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
                placeholder="8자 이상"
              />
            </div>

            {error ? (
              <p className="mt-3 text-sm font-semibold text-[#b15e32]">{error}</p>
            ) : null}
            {authNotice && !error ? (
              <p className="mt-3 text-sm font-semibold text-[#b15e32]">
                {authNotice}
              </p>
            ) : null}
            {message ? (
              <p className="mt-3 text-sm font-semibold text-[#257d72]">{message}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#10231f] text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#8a958f]"
            >
              <LockKeyhole size={17} />
              {isSubmitting
                ? "처리 중"
                : isSignUp
                  ? "계정 만들기"
                  : "로그인"}
            </button>
          </form>
        </section>

        <section className="mt-auto rounded-lg bg-[#e8f3ef] p-4 text-sm leading-6 text-[#34554f]">
          처음 가입할 때만 이메일 확인이 필요할 수 있고, 이후에는 비밀번호로 바로 로그인합니다.
        </section>
      </div>
    </main>
  );
}
