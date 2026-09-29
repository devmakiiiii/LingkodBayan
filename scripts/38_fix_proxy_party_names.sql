-- ============================================================================
-- Migration 38: Resolve proxy-filing counterparty names
--
-- Bug: the citizens' proxy pages showed "Unnamed resident" for the other party
-- of an authorization, and the "File on behalf of" picker showed blank entries.
--
-- Cause: the residents table has a strict SELECT policy
-- ("Residents can view their own data" -> USING (auth.uid() = user_id)).
-- lib/representatives.ts loads authorizations through the caller's own Supabase
-- client and embeds the other party with
--   represented:residents!representative_authorizations_represented_resident_id_fkey(...)
-- PostgREST applies the residents SELECT policy to that embedded join, so the
-- counterparty's row is filtered out and the join resolves to NULL. The UI then
-- fell back to its "Unnamed resident" placeholder.
--
-- We must not loosen the residents SELECT policy just to make a display work:
-- that would expose every resident's full row (address, DOB, phone, ...) to
-- anyone they ever authorized. Instead this SECURITY DEFINER helper exposes a
-- deliberately narrow projection - id, first_name, last_name, email - and only
-- for residents who share an authorization row with the caller. The resident id
-- is the account's own primary key, the name is what the party already knows
-- (they typed or picked it when granting), and the email is only ever used as a
-- display fallback.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.proxy_party_directory(p_resident_ids uuid[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.id, r.first_name, r.last_name, r.email
  FROM public.residents r
  JOIN public.representative_authorizations ra
    ON ra.represented_resident_id = r.id
    OR ra.representative_resident_id = r.id
  WHERE r.id = ANY (p_resident_ids)
    AND (
      ra.represented_resident_id = public.current_resident_id()
      OR ra.representative_resident_id = public.current_resident_id()
    );
$$;

-- Only authenticated portal users may resolve their own proxy counterparties.
REVOKE ALL ON FUNCTION public.proxy_party_directory(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proxy_party_directory(uuid[]) TO authenticated;
