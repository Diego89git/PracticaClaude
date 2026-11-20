-- SPEC 24: puntuaciones de usuarios autenticados y renombrado.

-- La política anónima de SPEC 06 (user_id is null) se queda.
create policy "scores_insert_authenticated" on public.scores
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Renombra solo las filas propias que tenían el nombre anterior.
create function public.renombrar_scores(anterior text, nuevo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  filas integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sin sesión';
  end if;
  if char_length(nuevo) not between 1 and 10 then
    raise exception 'Nombre inválido';
  end if;
  update public.scores
     set player_name = nuevo
   where user_id = (select auth.uid())
     and player_name = anterior;
  get diagnostics filas = row_count;
  return filas;
end;
$$;

revoke execute on function public.renombrar_scores(text, text) from public, anon;
grant execute on function public.renombrar_scores(text, text) to authenticated;
