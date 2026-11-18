# GuardAI Phase 1 Setup Guide (Supabase + Upstash Redis)

## 1. Environment Variables
Copy `.env.example` to `.env.local` and populate:
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## 2. Database Schema, Sync Trigger & RLS Migration
Run `supabase/migrations/0001_guardai_phase1_rbac_rls.sql` in the Supabase SQL Editor (or via `supabase db push`).
This creates:
- `public.profiles`, `public.workspaces`, `public.workspace_members`, `public.workspace_invitations`, `public.audit_logs`
- `on_auth_user_created` trigger (`public.handle_new_user()`) for instant profile sync & automatic workspace provisioning (`tenant_admin` role) for both Email/Password and Google OAuth signups, plus automatic invitation matching.
- `public.custom_access_token_hook(event jsonb)` for embedding `workspace_id`, `workspace_role`, `global_role`, and `account_status` into JWT tokens.
- Strict PostgreSQL RLS isolation policies across all tables.

## 3. Enable Custom Access Token Hook in Supabase
1. Open **Supabase Dashboard -> Authentication -> Hooks**.
2. Enable **Customize Access Token (JWT) Claims hook**.
3. Select Postgres function `public.custom_access_token_hook`.

## 4. Email Confirmation, Custom SMTP & 6-Digit OTP Template
1. Open **Supabase Dashboard -> Authentication -> Email Templates -> Reset Password**.
2. Include `{{ .Token }}` in the email body so users receive their 6-digit numeric OTP directly (e.g., `Your GuardAI verification code is: <strong>{{ .Token }}</strong>`).
3. Ensure **Authentication -> URL Configuration** includes `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/confirm` in Redirect URLs.
4. **Resolving `"Error sending confirmation email"`:** Supabase's default built-in mailer is capped at 2 emails/hour and restricts recipients. Either configure a **Custom SMTP** provider (Resend, SendGrid, Brevo, AWS SES) under **Authentication -> SMTP Settings**, or for local testing toggle off **Confirm email** under **Authentication -> Providers -> Email**.

## 5. Enable Google OAuth (Optional)
1. Open **Supabase Dashboard -> Authentication -> Providers -> Google**.
2. Add your Google Cloud OAuth Client ID and Secret and point the callback to your Supabase callback URL.

## 6. Promote a Platform Super Admin
Run in SQL Editor after registering your owner account:
```sql
UPDATE public.profiles
SET global_role = 'super_admin'
WHERE email = 'owner@yourcompany.com';
```
Sign out and sign back in so the updated `global_role` claim is embedded into your JWT and routes you to `/super-admin`.
