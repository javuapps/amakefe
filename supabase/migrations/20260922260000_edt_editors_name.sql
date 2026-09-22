-- An editor records their own name.
--
-- `edt_editors` had a select policy and nothing else, so the only way a row
-- ever appeared was `sec_provision_account`. That is right for accounts made
-- from now on and useless for the one that predates this model: the studio's
-- `super_admin` has no name recorded anywhere, because the old schema never
-- had anywhere to put one.
--
-- **It is an RPC rather than an insert policy, because the name lives twice.**
-- `sec_users.full_name` is what every surface reads without joining, and
-- `edt_editors.first_name`/`last_name` are what a form edits; a policy allowing
-- a direct write to the profile would let the two drift, which is the
-- two-sources-of-truth problem this schema keeps refusing elsewhere. One
-- statement moves both or neither.
--
-- Self-service is safe here in a way it would not be for a type or a role: an
-- editor's name is chrome. Stories carry no byline, so it reaches nothing a
-- reader ever sees — it names the person to themselves and to the other editors
-- in a studio they are already inside.
create or replace function public.edt_save_name(p_first_name text, p_last_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid := (select auth.uid());
  v_first text := btrim(p_first_name);
  v_last  text := btrim(p_last_name);
begin
  if not public.sec_is_editorial() then
    raise exception 'not permitted';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'a name needs both halves';
  end if;

  insert into public.edt_editors (user_id, first_name, last_name)
  values (v_id, v_first, v_last)
  on conflict (user_id) do update
    set first_name = excluded.first_name,
        last_name  = excluded.last_name;

  update public.sec_users
     set full_name = v_first || ' ' || v_last
   where id = v_id;
end;
$$;

revoke execute on function public.edt_save_name(text, text) from public, anon;
grant execute on function public.edt_save_name(text, text) to authenticated;
