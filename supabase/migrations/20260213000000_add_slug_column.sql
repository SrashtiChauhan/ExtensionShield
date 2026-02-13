-- Add slug column for SEO-friendly URLs
-- URL scheme: /scan/results/{slug} e.g. /scan/results/session-buddy

-- Add slug column
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_scan_results_slug ON scan_results(slug);

-- Note: slug is NOT unique because different extensions might have similar names
-- that generate the same slug. The frontend will always link to the most recent scan.
-- If you need uniqueness, add a unique constraint later after cleaning up duplicates.

-- Backfill slugs for existing rows (generates slug from extension_name)
-- This uses a simple slug generation: lowercase, replace spaces with hyphens, remove special chars
UPDATE scan_results 
SET slug = LOWER(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    COALESCE(extension_name, extension_id),
                    '[:\-–—_/\\|]+', '-', 'g'  -- Replace separators with hyphens
                ),
                '[^a-zA-Z0-9\s\-]', '', 'g'  -- Remove non-alphanumeric
            ),
            '\s+', '-', 'g'  -- Replace whitespace with hyphens
        ),
        '-+', '-', 'g'  -- Collapse multiple hyphens
    )
)
WHERE slug IS NULL;

-- Trim leading/trailing hyphens
UPDATE scan_results
SET slug = TRIM(BOTH '-' FROM slug)
WHERE slug LIKE '-%' OR slug LIKE '%-';
