-- 001b_rename_timestamp_to_scanned_at.sql
-- Migration script to rename "timestamp" column to "scanned_at" if table already exists.
-- Run this ONLY if you already ran the old 001_scan_results.sql migration.
-- Safe to run multiple times (checks if column exists first).

-- Check if old "timestamp" column exists and rename it
do $$
begin
  if exists (
    select 1 
    from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'scan_results' 
      and column_name = 'timestamp'
  ) then
    -- Rename column
    alter table public.scan_results rename column "timestamp" to scanned_at;
    
    -- Change type from text to timestamptz
    -- Handle ISO format strings (e.g., "2024-01-01T12:00:00" or "2024-01-01T12:00:00Z")
    alter table public.scan_results alter column scanned_at type timestamptz 
      using case 
        when scanned_at ~ '^\d{4}-\d{2}-\d{2}' then scanned_at::timestamptz
        else now()  -- Fallback to now() if format is invalid
      end;
    
    -- Rename index if it exists
    drop index if exists public.idx_timestamp;
    create index if not exists idx_scanned_at 
      on public.scan_results(scanned_at desc);
    
    raise notice 'Column renamed from timestamp to scanned_at and converted to timestamptz';
  else
    raise notice 'Column timestamp does not exist, skipping rename';
  end if;
end $$;



