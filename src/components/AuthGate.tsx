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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
    return <LoginScreen onEmailSent={setLastEmailSent} />;
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
