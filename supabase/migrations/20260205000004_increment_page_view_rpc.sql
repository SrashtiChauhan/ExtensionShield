-- 003b_increment_page_view_rpc.sql
-- Atomic RPC function for incrementing page views (prevents lost updates).
-- Uses INSERT ... ON CONFLICT ... DO UPDATE for atomic increment.

create or replace function public.increment_page_view(
  p_day text,
  p_path text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  -- Atomic upsert: insert with count=1 or increment existing count
  insert into public.page_views_daily (day, path, count)
  values (p_day, p_path, 1)
  on conflict (day, path) 
  do update set count = page_views_daily.count + 1
  returning count into v_count;
  
  return v_count;
end;
$$;

-- Grant execute permission to service role (backend uses service role key)
grant execute on function public.increment_page_view(text, text) to service_role;

-- Note: This function is atomic and prevents race conditions.
-- Multiple concurrent calls will correctly increment the count.



