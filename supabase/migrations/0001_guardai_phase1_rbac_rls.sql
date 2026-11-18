-- ==============================================================================
-- GuardAI Phase 1: Multi-Tenant RBAC, Profile Sync Trigger, Custom JWT Claims,
-- and Strict Row Level Security (RLS) Isolation
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Core Tables
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  global_role text NOT NULL DEFAULT 'user'
    CHECK (global_role IN ('super_admin', 'user')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'banned')),
  avatar_url text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro')),
  subscription_status text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'suspended')),
  seat_limit integer NOT NULL DEFAULT 5,
  soc_settings jsonb NOT NULL DEFAULT '{
    "auto_quarantine": false,
    "retention_days": 30,
    "alert_threshold": "high",
    "realtime_rag_enabled": true
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_role text NOT NULL DEFAULT 'member'
    CHECK (workspace_role IN ('tenant_admin', 'member')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('tenant_admin', 'member')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for multi-tenant query performance
CREATE INDEX IF NOT EXISTS idx_profiles_global_role ON public.profiles(global_role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Updated-At Trigger & Privilege Escalation Guard
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Prevent regular users from mutating their own global_role or status via client queries
CREATE OR REPLACE FUNCTION public.guard_profile_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.role() = 'authenticated') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.global_role = 'super_admin'
    ) THEN
      IF NEW.global_role IS DISTINCT FROM OLD.global_role THEN
        RAISE EXCEPTION 'Unauthorized modification of global_role';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Unauthorized modification of account status';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privilege ON public.profiles;
CREATE TRIGGER trg_guard_profile_privilege
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privilege_columns();

-- Prevent tenant_admin from self-escalating billing plan, seat limits, or unsuspending workspace via client queries
CREATE OR REPLACE FUNCTION public.guard_workspace_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.role() = 'authenticated') THEN
    IF NOT public.is_super_admin() THEN
      IF NEW.plan IS DISTINCT FROM OLD.plan THEN
        RAISE EXCEPTION 'Unauthorized modification of workspace plan';
      END IF;
      IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
        RAISE EXCEPTION 'Unauthorized modification of workspace subscription_status';
      END IF;
      IF NEW.seat_limit IS DISTINCT FROM OLD.seat_limit THEN
        RAISE EXCEPTION 'Unauthorized modification of workspace seat_limit';
      END IF;
      IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Unauthorized modification of workspace owner';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_workspace_billing ON public.workspaces;
CREATE TRIGGER trg_guard_workspace_billing
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_workspace_billing_columns();

-- ------------------------------------------------------------------------------
-- 3. Instant Profile & Workspace Sync Trigger (on_auth_user_created)
--    Handles Email/Password Sign-Up, Google OAuth Auto-Provisioning, and Invites
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.slugify_workspace_name(input_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned text;
BEGIN
  cleaned := lower(regexp_replace(coalesce(input_name, 'soc-workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
  cleaned := trim(both '-' FROM cleaned);
  IF length(cleaned) < 2 THEN
    cleaned := 'soc-workspace';
  END IF;
  RETURN left(cleaned, 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_workspace_name text;
  v_workspace_id uuid;
  v_invite record;
  v_invite_token text;
BEGIN
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'analyst@guardai.sec'), '@', 1)
  );

  -- 1. Immediately create or synchronize user profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, global_role, status)
  VALUES (
    new.id,
    lower(new.email),
    v_full_name,
    new.raw_user_meta_data ->> 'avatar_url',
    'user',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  -- 2. Check if user already belongs to a workspace (idempotency guard)
  SELECT workspace_id INTO v_workspace_id
  FROM public.workspace_members
  WHERE user_id = new.id
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    RETURN new;
  END IF;

  -- 3. Check for pending workspace invitation (by token metadata or matching email)
  v_invite_token := nullif(trim(new.raw_user_meta_data ->> 'invitation_token'), '');

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_invite
    FROM public.workspace_invitations
    WHERE token = v_invite_token
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;
  END IF;

  IF v_invite IS NULL THEN
    SELECT * INTO v_invite
    FROM public.workspace_invitations
    WHERE lower(email) = lower(new.email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_invite IS NOT NULL THEN
    -- Join existing invited workspace with invited role
    INSERT INTO public.workspace_members (workspace_id, user_id, workspace_role, invited_by)
    VALUES (v_invite.workspace_id, new.id, v_invite.role, v_invite.invited_by)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    UPDATE public.workspace_invitations
    SET status = 'accepted'
    WHERE id = v_invite.id;

    INSERT INTO public.audit_logs (workspace_id, actor_id, actor_email, action, target_type, target_id, severity, metadata)
    VALUES (
      v_invite.workspace_id,
      new.id,
      lower(new.email),
      'member.joined_via_invite',
      'workspace_member',
      new.id::text,
      'info',
      jsonb_build_object('role', v_invite.role)
    );

    RETURN new;
  END IF;

  -- 4. Standard Self-Signup or Google OAuth Auto-Provisioning -> Create Workspace + Assign tenant_admin
  v_workspace_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), ''),
    v_full_name || '''s SOC Workspace'
  );

  INSERT INTO public.workspaces (name, slug, owner_id, plan, subscription_status)
  VALUES (
    left(v_workspace_name, 80),
    public.slugify_workspace_name(v_workspace_name),
    new.id,
    'free',
    'active'
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, workspace_role, invited_by)
  VALUES (v_workspace_id, new.id, 'tenant_admin', new.id);

  INSERT INTO public.audit_logs (workspace_id, actor_id, actor_email, action, target_type, target_id, severity, metadata)
  VALUES (
    v_workspace_id,
    new.id,
    lower(new.email),
    'workspace.provisioned',
    'workspace',
    v_workspace_id::text,
    'info',
    jsonb_build_object(
      'workspace_name', v_workspace_name,
      'assigned_role', 'tenant_admin',
      'provider', coalesce(new.raw_app_meta_data ->> 'provider', 'email')
    )
  );

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 4. Custom Access Token Hook (Embeds workspace_id, workspace_role, global_role)
--    Note: Preserves top-level PostgreSQL JWT "role" as 'authenticated' so
--    PostgREST role switching succeeds, while embedding RBAC claims cleanly.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims jsonb;
  v_user_id uuid;
  v_global_role text;
  v_account_status text;
  v_workspace_id uuid;
  v_workspace_role text;
  v_app_metadata jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  SELECT global_role, status
  INTO v_global_role, v_account_status
  FROM public.profiles
  WHERE id = v_user_id;

  SELECT workspace_id, workspace_role
  INTO v_workspace_id, v_workspace_role
  FROM public.workspace_members
  WHERE user_id = v_user_id
  ORDER BY joined_at ASC
  LIMIT 1;

  v_global_role := coalesce(v_global_role, 'user');
  v_account_status := coalesce(v_account_status, 'active');

  -- Embed top-level custom JWT claims for RLS & Middleware/Proxy inspection
  IF v_workspace_id IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{workspace_id}', to_jsonb(v_workspace_id::text), true);
  END IF;

  IF v_workspace_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{workspace_role}', to_jsonb(v_workspace_role), true);
  END IF;

  v_claims := jsonb_set(v_claims, '{global_role}', to_jsonb(v_global_role), true);
  v_claims := jsonb_set(v_claims, '{account_status}', to_jsonb(v_account_status), true);

  -- Also mirror into app_metadata.role for unified client/server claim inspection
  v_app_metadata := coalesce(v_claims -> 'app_metadata', '{}'::jsonb);
  v_app_metadata := jsonb_set(
    v_app_metadata,
    '{role}',
    to_jsonb(CASE WHEN v_global_role = 'super_admin' THEN 'super_admin' ELSE coalesce(v_workspace_role, 'member') END),
    true
  );
  IF v_workspace_id IS NOT NULL THEN
    v_app_metadata := jsonb_set(v_app_metadata, '{workspace_id}', to_jsonb(v_workspace_id::text), true);
  END IF;
  v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_metadata, true);

  RETURN jsonb_set(event, '{claims}', v_claims, true);
END;
$$;

-- Grant Supabase Auth admin permission to execute the Custom Access Token Hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.workspace_members TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- ------------------------------------------------------------------------------
-- 5. RLS Helper Functions (JWT-first with safe SECURITY DEFINER fallback)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(auth.jwt() ->> 'global_role', '') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND global_role = 'super_admin' AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(auth.jwt() ->> 'workspace_id', '')::uuid,
    (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
      ORDER BY wm.joined_at ASC
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(auth.jwt() ->> 'workspace_role', ''),
    (
      SELECT wm.workspace_role
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
      ORDER BY wm.joined_at ASC
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR (
      target_workspace_id = public.current_workspace_id()
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.user_id = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(target_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR (
      target_workspace_id = public.current_workspace_id()
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.user_id = auth.uid()
          AND wm.workspace_role = 'tenant_admin'
      )
    );
$$;

-- ------------------------------------------------------------------------------
-- 6. Strict Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_self_or_tenant_or_super" ON public.profiles;
CREATE POLICY "profiles_select_self_or_tenant_or_super"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.user_id = public.profiles.id
        AND wm.workspace_id = public.current_workspace_id()
    )
  );

DROP POLICY IF EXISTS "profiles_update_self_or_super" ON public.profiles;
CREATE POLICY "profiles_update_self_or_super"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "profiles_delete_super_only" ON public.profiles;
CREATE POLICY "profiles_delete_super_only"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- WORKSPACES POLICIES (Strict Tenant Isolation)
DROP POLICY IF EXISTS "workspaces_select_own_or_super" ON public.workspaces;
CREATE POLICY "workspaces_select_own_or_super"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_workspace_member(id)
  );

DROP POLICY IF EXISTS "workspaces_update_tenant_admin_or_super" ON public.workspaces;
CREATE POLICY "workspaces_update_tenant_admin_or_super"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(id))
  WITH CHECK (public.is_tenant_admin(id));

DROP POLICY IF EXISTS "workspaces_delete_super_only" ON public.workspaces;
CREATE POLICY "workspaces_delete_super_only"
  ON public.workspaces FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- WORKSPACE MEMBERS POLICIES
DROP POLICY IF EXISTS "workspace_members_select_isolated" ON public.workspace_members;
CREATE POLICY "workspace_members_select_isolated"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_members_insert_tenant_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_tenant_admin"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(workspace_id));

DROP POLICY IF EXISTS "workspace_members_update_tenant_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_update_tenant_admin"
  ON public.workspace_members FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(workspace_id))
  WITH CHECK (public.is_tenant_admin(workspace_id));

DROP POLICY IF EXISTS "workspace_members_delete_tenant_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_tenant_admin"
  ON public.workspace_members FOR DELETE
  TO authenticated
  USING (public.is_tenant_admin(workspace_id));

-- WORKSPACE INVITATIONS POLICIES (Strictly hidden from 'member' role)
DROP POLICY IF EXISTS "workspace_invitations_select_admin" ON public.workspace_invitations;
CREATE POLICY "workspace_invitations_select_admin"
  ON public.workspace_invitations FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(workspace_id));

DROP POLICY IF EXISTS "workspace_invitations_insert_admin" ON public.workspace_invitations;
CREATE POLICY "workspace_invitations_insert_admin"
  ON public.workspace_invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(workspace_id));

DROP POLICY IF EXISTS "workspace_invitations_update_admin" ON public.workspace_invitations;
CREATE POLICY "workspace_invitations_update_admin"
  ON public.workspace_invitations FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(workspace_id))
  WITH CHECK (public.is_tenant_admin(workspace_id));

DROP POLICY IF EXISTS "workspace_invitations_delete_admin" ON public.workspace_invitations;
CREATE POLICY "workspace_invitations_delete_admin"
  ON public.workspace_invitations FOR DELETE
  TO authenticated
  USING (public.is_tenant_admin(workspace_id));

-- AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "audit_logs_select_admin_or_super" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin_or_super"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      workspace_id IS NOT NULL
      AND public.is_tenant_admin(workspace_id)
    )
  );

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      actor_id = auth.uid()
      AND (workspace_id IS NULL OR workspace_id = public.current_workspace_id())
    )
  );
