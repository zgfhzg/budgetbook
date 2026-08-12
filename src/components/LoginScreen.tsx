"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginScreenProps = {
  onEmailSent: (email: string) => void;
};

export function LoginScreen({ onEmailSent }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("이메일로 로그인 링크를 보냈습니다.");
    onEmailSent(normalizedEmail);
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
          <h1 className="mt-3 text-3xl font-bold">로그인</h1>
          <p className="mt-3 text-sm leading-6 text-[#63746f]">
            가계부와 영수증 데이터는 로그인한 사용자에게만 표시됩니다.
          </p>
        </header>

        <section className="mt-10 rounded-lg border border-[#e2d8c7] bg-white p-4">
          <form onSubmit={handleSubmit}>
            <label className="text-sm font-bold" htmlFor="email">
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

            {error ? (
              <p className="mt-3 text-sm font-semibold text-[#b15e32]">{error}</p>
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
              {isSubmitting ? "전송 중" : "로그인 링크 받기"}
            </button>
          </form>
        </section>

        <section className="mt-auto rounded-lg bg-[#e8f3ef] p-4 text-sm leading-6 text-[#34554f]">
          Supabase Auth 세션과 RLS 정책으로 사용자별 데이터를 분리합니다.
        </section>
      </div>
    </main>
  );
}
