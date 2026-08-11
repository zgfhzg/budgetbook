# Budget Book Database Model and RLS

This document is the working Supabase schema plan for Budget Book.

## Security Baseline

- All user-owned tables are protected by Row Level Security.
- User-owned rows include `user_id uuid references auth.users(id)`.
- Policies use `to authenticated` plus `(select auth.uid()) = user_id`.
- No application table grants access to unauthenticated `anon`.
- Receipt images live in the private `receipts` storage bucket.
- Storage object names must start with the signed-in user id: `{user_id}/{receipt_id}/{filename}`.
- Supabase `service_role` keys must only be used from trusted server code, never from browser code.

This follows Supabase guidance that RLS should be enabled for tables exposed in the public schema and that Storage access is controlled through RLS on `storage.objects`.

## Tables

`profiles`

One row per Supabase Auth user. Stores app-level preferences such as default currency and timezone.

`categories`

System categories have `is_system = true` and `user_id is null`. Users can read system categories and manage only their own custom categories.

`stores`

User-private merchant/place records extracted from receipts or selected manually. These are not shared globally because a user's merchant history is sensitive.

`transactions`

The main ledger table. Each row belongs to one user, has a `local_date` for calendar views, and keeps `occurred_at` for precise timestamps.

`receipts`

One uploaded receipt image and its analysis state. Keeps OCR text and parsed JSON because receipt extraction may need review or reprocessing.

`receipt_items`

Line items extracted from a receipt. The table duplicates `user_id` for simple RLS and faster user-scoped queries, while still checking ownership through the parent receipt.

## Receipt Flow

1. User signs in.
2. Client uploads image to private Storage at `{auth.uid()}/{receipt_id}/original.ext`.
3. App inserts `receipts` row with `status = uploaded`.
4. Server-side analyzer updates status to `processing`, extracts OCR and structured fields.
5. Analyzer inserts `receipt_items`.
6. User reviews the result.
7. App creates or updates a `transactions` row and marks receipt `confirmed`.

## RLS Notes

- `profiles`: user can select, insert, and update only their own profile.
- `categories`: users can select system categories plus their own; only their own custom categories can be changed.
- `stores`, `transactions`, `receipts`: all operations are limited to the owning user.
- `receipt_items`: all operations require both matching `user_id` and ownership of the parent receipt.
- `storage.objects`: authenticated users can select, insert, update, and delete only objects in the `receipts` bucket whose first path segment is their user id.

## Follow-Up Decisions

- Whether to allow anonymous Supabase users for trial mode. Current design assumes permanent authenticated users.
- Whether to separate OCR text into a private server-only table later. Current design keeps it in `receipts` because RLS already isolates by user.
- Whether to add household/shared ledgers. That would require `households`, `household_members`, and team-based RLS instead of direct user ownership.
