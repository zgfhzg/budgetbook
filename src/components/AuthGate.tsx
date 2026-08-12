"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { BudgetApp } from "@/components/BudgetApp";
import { LoginScreen } from "@/components/LoginScreen";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastEmailSent, setLastEmailSent] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;
    const fallbackTimer = window.setTimeout(() => {
      if (!isMounted) {
        return;
      }

      setAuthError("세션 확인이 지연되어 로그인 화면으로 전환했습니다.");
      setIsLoading(false);
    }, 5000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setAuthError(error.message);
        }

        window.clearTimeout(fallbackTimer);
        setSession(data.session);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        window.clearTimeout(fallbackTimer);
        setAuthError(
          error instanceof Error ? error.message : "세션 확인에 실패했습니다.",
        );
        setSession(null);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.clearTimeout(fallbackTimer);
      setSession(nextSession);
      setIsLoading(false);

      const user = nextSession?.user;
      if (user) {
        void supabase.from("profiles").upsert({
          id: user.id,
          display_name:
            user.user_metadata?.name ?? user.email?.split("@")[0] ?? null,
          default_currency: "KRW",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f6f1e7] px-5 text-[#14221f]">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5e746f]">
            Budget Book
          </p>
          <p className="mt-3 text-lg font-bold">세션 확인 중</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        authNotice={authError}
        onAuthSubmitted={(email) => {
          setAuthError("");
          setLastEmailSent(email);
        }}
      />
    );
  }

  return (
    <BudgetApp
      userId={session.user.id}
      userEmail={session.user.email ?? lastEmailSent}
      onSignOut={async () => {
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut();
      }}
    />
  );
}
