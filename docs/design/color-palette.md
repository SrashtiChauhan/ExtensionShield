# ExtensionShield – Color palette & theme

## Green theme & logo

- **Primary brand:** Emerald green (`hsl(142 71% 45%)` → `#22c55e`). Used for primary actions, accent, success, and focus rings.
- **Extension logo:** The shield icon is green everywhere:
  - **Header:** `ShieldLogo` component (green gradient `#22c55e` → `#16a34a`) – single source of truth.
  - **Modals / auth:** Same `ShieldLogo` component.
  - **Favicon / PWA:** Use a green shield asset to match.
- **Consistency:** Primary, accent, success, and input focus all use the same green. No competing brand colors in the main UI.

## Do we introduce a lot of colors?

**No.** The design uses a **controlled palette**:

| Role | Colors | Where |
|------|--------|--------|
| **Brand** | Green (emerald) | Logo, CTAs, links, focus, success |
| **Neutrals** | Dark navy, white, slate grays | Backgrounds, body text, borders |
| **Semantic** | Green / amber / red / gray | Risk levels, status (good / warn / bad / neutral) – required for meaning |
| **Secondary** | Purple | Optional gradient with primary (e.g. hero), some badges |
| **Decorative** | Orange, blue, etc. | Limited (e.g. Atlas tokens for marketing); hero carousel uses multi‑color extension icons by design |

Recommendation: keep this. The only “extra” hue is purple as a secondary; the rest is green + neutrals + semantic. The carousel is intentionally colorful for the illustration only.

## Current background & lighter option

- **Current (default):**  
  - `--atlas-bg-primary: #0d1424`  
  - `--atlas-bg-secondary: #111827`  
  Dark navy, strong contrast, WCAG AA.

- **Lighter dark (optional):**  
  Same hue, less heavy, still WCAG AA:
  - `--atlas-bg-primary: #131b2e`  
  - `--atlas-bg-secondary: #161f33`  

To use the lighter background without changing the rest of the design, set on `<html>`:

```html
<html lang="en" data-theme="dark-lighter">
```

All backgrounds that use `var(--atlas-bg-primary)` / `var(--atlas-bg-secondary)` (and the new HSL surface tokens in `index.css`) will pick this up. Text and green accents stay the same and remain accessible.

## Concept color palettes (reference)

You can use these as inspiration; they are **not** applied in code.

### 1. Current – Emerald dark (in use)

- Background: `#0d1424` / `#111827`
- Primary/accent: `#22c55e` (emerald)
- Text: `#f8fafc` / `#94a3b8`
- Mood: Trust, security, dark tech.

### 2. Lighter dark – Same green (optional, implemented)

- Background: `#131b2e` / `#161f33`
- Primary/accent: `#22c55e` (unchanged)
- Text: unchanged
- Mood: Same brand, slightly less heavy, still dark.

### 3. Soft dark – Green‑gray

- Background: `#1a2332` (blue‑gray)
- Primary: `#22c55e`
- Surfaces: `#1e293b`, `#334155`
- Text: `#f1f5f9` / `#94a3b8`
- Mood: Softer, still professional.

### 4. High contrast dark

- Background: `#0a0e14`
- Primary: `#34d399` (brighter green)
- Text: `#ffffff` / `#a1a1aa`
- Mood: Maximum contrast, very dark.

### 5. Reference only – Deasy‑style (do not copy)

- Light off‑white background, dark forest green header, muted orange accent.
- We keep our dark theme and green‑first palette; copying this would break the current design and brand.

## Where colors live in code

- **Global tokens:** `frontend/src/index.css` (`:root`, `.light`, `[data-theme="dark-lighter"]`)
- **Atlas (marketing/legacy):** `frontend/src/index.css` and `frontend/src/App.scss` (`--atlas-bg-primary`, `--atlas-accent`, etc.)
- **Shield logo:** `frontend/src/components/ShieldLogo.jsx` (green gradient) and `ShieldLogo.scss`
- **Header logo:** Uses `ShieldLogo` in `App.jsx` (green icon only)

## Accessibility

- Primary text on dark backgrounds: ≥ 4.5:1 (WCAG AA).
- Green buttons: dark text on green (`#0d1424` on `#22c55e`) and white on green both meet contrast requirements.
- Lighter dark theme (`#131b2e`) was chosen so `#f8fafc` and `#94a3b8` still pass WCAG AA.
