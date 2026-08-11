# Supabase Connection

## Local Environment

The project reads Supabase browser credentials from the workspace root `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`.env.local` is ignored by Git. Keep `service_role` keys out of client code and out of committed files.

## Vercel Environment Variables

Add the same public values in Vercel:

1. Open Vercel dashboard.
2. Select the Budget Book project.
3. Go to `Settings` > `Environment Variables`.
4. Add `NEXT_PUBLIC_SUPABASE_URL`.
5. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Select Production, Preview, and Development unless you create separate Supabase projects per environment.

## Supabase Dashboard Checks

1. Open the Supabase project.
2. Go to `SQL Editor`.
3. Run `supabase/migrations/20260724000000_initial_budget_book_schema.sql`.
4. Go to `Table Editor` and confirm the public tables exist.
5. Go to `Authentication` > `Policies` and confirm RLS is enabled on the public tables.
6. Go to `Storage` and confirm the `receipts` bucket exists and is private.

## Client Helper

Use `getSupabaseBrowserClient()` from `src/lib/supabase/client.ts` in client components.
