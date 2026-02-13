# Hero Orbital Carousel – Hybrid Data Strategy

This document describes the hybrid data strategy used to eliminate the 5-second icon render delay on the homepage hero carousel.

## Overview

The hero carousel displays up to 17 scanned extensions in orbital rings. Previously, icons took several seconds to load because they depended on API calls. The hybrid strategy ensures **instant first-paint** while still supporting live data when available.

## Strategy

### 1. Instant First Paint (0ms)

- **HERO_SNAPSHOT** (`frontend/src/data/heroSnapshot.js`) contains real extension IDs and **embedded base64 icons** from the database
- Icons render immediately from the static snapshot – no network requests required
- Generated via: `node scripts/generate_hero_snapshot.js`

### 2. Session Cache (instant on subsequent navigations)

- Recent scans are cached in `sessionStorage` with a 5-minute TTL
- After the first load, navigating back to the homepage uses cached data
- No API call when cache is valid

### 3. Background DB Fetch (when cache misses)

- If no valid cache exists, `/api/recent` is fetched in the background
- When data arrives, the carousel updates seamlessly
- Result is cached for future navigations

## Files

| File | Purpose |
|------|---------|
| `frontend/src/data/heroSnapshot.js` | Static snapshot with embedded icons (instant first paint) |
| `frontend/src/components/hero/HeroOrbitalCarousel.jsx` | Carousel component; implements cache + fetch logic |
| `scripts/generate_hero_snapshot.js` | Script to regenerate `heroSnapshot.js` from the database |

## Regenerating the Snapshot

To update the hero snapshot with the latest scans from the database:

```bash
# Ensure the API is running (e.g. make api)
node scripts/generate_hero_snapshot.js
```

The script fetches from `VITE_API_URL` (or `http://localhost:8007` by default). For production, run against your deployed API:

```bash
VITE_API_URL=https://your-api.example.com node scripts/generate_hero_snapshot.js
```

Then copy the output into `frontend/src/data/heroSnapshot.js`, or pipe it:

```bash
node scripts/generate_hero_snapshot.js | sed -n '/^\/\*\*/,/^];$/p' > frontend/src/data/heroSnapshot.js
```

## Icon Resolution Order

1. **icon_base64** – If present (from DB or snapshot), use data URL (instant)
2. **Real extension ID (32 chars a–p)** – Check cache, else use `/api/scan/icon/{id}`
3. **Static snapshot item** – Use placeholder (no network request)

## Result

- **First visit:** Icons render instantly from embedded base64 in HERO_SNAPSHOT
- **Subsequent visits:** Icons render instantly from sessionStorage cache (if valid)
- **API latency:** Loaded in the background; users do not see a 5-second delay
