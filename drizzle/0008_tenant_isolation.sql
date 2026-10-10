-- The login role can only complete a verified OAuth login. It cannot read tables.
CREATE ROLE pointed_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
--> statement-breakpoint

CREATE ROLE pointed_login NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
--> statement-breakpoint

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO pointed_runtime, pointed_login;
--> statement-breakpoint

CREATE SCHEMA pointed_private;
--> statement-breakpoint

REVOKE ALL ON SCHEMA pointed_private FROM PUBLIC;
--> statement-breakpoint

GRANT USAGE ON SCHEMA pointed_private TO pointed_runtime, pointed_login;
--> statement-breakpoint


-- Owner-executed authentication lookup avoids recursive auth_sessions policies.
-- Identity comes from a valid, unexpired server session, not client user/org IDs.
CREATE FUNCTION pointed_private.identity() RETURNS TABLE(user_id uuid, organization_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT u.id, u.organization_id FROM public.auth_sessions a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.token_hash = nullif(current_setting('pointed.session_hash', true), '')
    AND a.expires_at > now() LIMIT 1
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION pointed_private.identity() FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION pointed_private.identity() TO pointed_runtime;
--> statement-breakpoint


CREATE FUNCTION pointed_private.invite_preview(invite_code text)
RETURNS TABLE(title text, "teamName" text, status public.session_status, "issueCount" integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s.title, s.team_name, s.status, count(q.id)::integer
  FROM public.poker_sessions s LEFT JOIN public.queue_items q ON q.session_id = s.id
  WHERE s.code = invite_code GROUP BY s.id LIMIT 1
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION pointed_private.invite_preview(text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION pointed_private.invite_preview(text) TO pointed_runtime;
--> statement-breakpoint


CREATE FUNCTION pointed_private.complete_login(
  linear_id text, org_id text, user_email text, display_name text, avatar_url text,
  access_token text, refresh_token text, token_scopes text[], token_expires timestamptz,
  session_hash text, session_expires timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE account_id uuid;
BEGIN
  IF linear_id IS NULL OR org_id IS NULL OR length(linear_id) = 0 OR length(org_id) = 0
    OR session_hash IS NULL OR session_hash !~ '^[a-f0-9]{64}$'
    OR session_expires IS NULL OR session_expires <= now() OR session_expires > now() + interval '15 days' THEN
    RAISE EXCEPTION 'Invalid login identity';
  END IF;
  INSERT INTO public.users(linear_user_id, organization_id, email, display_name, avatar_url)
  VALUES (linear_id, org_id, user_email, display_name, avatar_url)
  ON CONFLICT (organization_id, linear_user_id) DO UPDATE
    SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url, updated_at = now()
  RETURNING id INTO account_id;
  INSERT INTO public.linear_connections(user_id, encrypted_access_token, encrypted_refresh_token, scopes, expires_at)
  VALUES(account_id, access_token, refresh_token, token_scopes, token_expires)
  ON CONFLICT(user_id) DO UPDATE SET encrypted_access_token=EXCLUDED.encrypted_access_token,
    encrypted_refresh_token=EXCLUDED.encrypted_refresh_token, scopes=EXCLUDED.scopes, expires_at=EXCLUDED.expires_at, updated_at=now();
  INSERT INTO public.auth_sessions(user_id, token_hash, expires_at) VALUES(account_id, session_hash, session_expires);
  RETURN account_id;
END
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION pointed_private.complete_login(text,text,text,text,text,text,text,text[],timestamptz,text,timestamptz) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION pointed_private.complete_login(text,text,text,text,text,text,text,text[],timestamptz,text,timestamptz) TO pointed_login;
--> statement-breakpoint



ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "linear_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "poker_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "queue_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "round_signals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "round_voters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "rounds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "slack_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "team_defaults" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "votes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint


ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.users FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.auth_sessions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.auth_sessions FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_sessions TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.linear_connections FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.linear_connections FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linear_connections TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.user_settings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.user_settings FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.slack_connections FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.slack_connections FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_connections TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.team_defaults FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.team_defaults FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_defaults TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.poker_sessions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.poker_sessions FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poker_sessions TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.queue_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.queue_items FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_items TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.participants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.participants FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.rounds FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.rounds FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rounds TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.round_voters FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.round_voters FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_voters TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.votes FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.votes FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.round_signals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.round_signals FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_signals TO pointed_runtime;
--> statement-breakpoint

ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON public.audit_events FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_events TO pointed_runtime;
--> statement-breakpoint

CREATE POLICY users_read ON public.users FOR SELECT TO pointed_runtime USING (organization_id = (SELECT organization_id FROM pointed_private.identity()));
--> statement-breakpoint

CREATE POLICY users_delete ON public.users FOR DELETE TO pointed_runtime USING (id = (SELECT user_id FROM pointed_private.identity()));
--> statement-breakpoint

CREATE POLICY own_record ON public.auth_sessions TO pointed_runtime USING (user_id = (SELECT user_id FROM pointed_private.identity())) WITH CHECK (user_id = (SELECT user_id FROM pointed_private.identity()));
--> statement-breakpoint

CREATE POLICY own_record ON public.linear_connections TO pointed_runtime USING (user_id = (SELECT user_id FROM pointed_private.identity())) WITH CHECK (user_id = (SELECT user_id FROM pointed_private.identity()));
--> statement-breakpoint

CREATE POLICY own_record ON public.user_settings TO pointed_runtime USING (user_id = (SELECT user_id FROM pointed_private.identity())) WITH CHECK (user_id = (SELECT user_id FROM pointed_private.identity()));
--> statement-breakpoint

CREATE POLICY own_record ON public.slack_connections TO pointed_runtime USING (user_id = (SELECT user_id FROM pointed_private.identity())) WITH CHECK (user_id = (SELECT user_id FROM pointed_private.identity()));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.team_defaults TO pointed_runtime USING (organization_id = (SELECT organization_id FROM pointed_private.identity())) WITH CHECK (organization_id = (SELECT organization_id FROM pointed_private.identity()));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.poker_sessions TO pointed_runtime USING (organization_id = (SELECT organization_id FROM pointed_private.identity())) WITH CHECK (organization_id = (SELECT organization_id FROM pointed_private.identity()) AND host_user_id IN (SELECT id FROM public.users));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.queue_items TO pointed_runtime USING (session_id IN (SELECT id FROM public.poker_sessions)) WITH CHECK (session_id IN (SELECT id FROM public.poker_sessions));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.participants TO pointed_runtime USING (session_id IN (SELECT id FROM public.poker_sessions)) WITH CHECK (session_id IN (SELECT id FROM public.poker_sessions) AND user_id IN (SELECT id FROM public.users));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.rounds TO pointed_runtime USING (session_id IN (SELECT id FROM public.poker_sessions)) WITH CHECK (session_id IN (SELECT id FROM public.poker_sessions) AND queue_item_id IN (SELECT id FROM public.queue_items WHERE session_id = rounds.session_id));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.audit_events TO pointed_runtime USING (session_id IN (SELECT id FROM public.poker_sessions)) WITH CHECK (session_id IN (SELECT id FROM public.poker_sessions) AND (actor_user_id IS NULL OR actor_user_id IN (SELECT id FROM public.users)));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.round_voters TO pointed_runtime USING (round_id IN (SELECT id FROM public.rounds)) WITH CHECK (round_id IN (SELECT id FROM public.rounds) AND user_id IN (SELECT id FROM public.users));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.votes TO pointed_runtime USING (round_id IN (SELECT id FROM public.rounds)) WITH CHECK (round_id IN (SELECT id FROM public.rounds) AND user_id IN (SELECT id FROM public.users));
--> statement-breakpoint

CREATE POLICY workspace_record ON public.round_signals TO pointed_runtime USING (round_id IN (SELECT id FROM public.rounds)) WITH CHECK (round_id IN (SELECT id FROM public.rounds) AND user_id IN (SELECT id FROM public.users));
