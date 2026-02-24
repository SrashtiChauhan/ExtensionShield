# Scan Results Page & Scoring Engine Design

This document describes the **`/scan/results/:scanId`** page (e.g. `/scan/results/authenticator`), the **scoring engine design**, and **each UI card** so you can understand what is included and how scores are calculated. Use it for scoring model improvements and consistency checks.

---

## 1. Page Overview

- **Route:** `/scan/results/:scanId` — `scanId` can be Chrome extension ID (32 chars), UUID (upload scan), or **slug** (e.g. `authenticator`).
- **Component:** `frontend/src/pages/scanner/ScanResultsPageV2.jsx`
- **Data source:** `GET /api/scan/results/{identifier}`; response is normalized by `normalizeScanResult.ts` into a **ReportViewModel**.
- **No client-side score computation** — the UI only displays what the backend sends (`scoring_v2` is the single source of truth).

---

## 2. Scoring Engine Architecture (Backend)

**Single source of truth:** `src/extension_shield/scoring/engine.py` — `ScoringEngine` class.

### 2.1 High-level flow

1. **Normalize signals** → factors with `severity` [0,1] and `confidence` [0,1].
2. **Compute layer scores** (Security, Privacy, Governance) using a **confidence-weighted risk** formula.
3. **Evaluate hard gates** (can BLOCK/WARN regardless of score).
4. **Apply gate penalties** to layer scores (so gates affect both decision and numeric score).
5. **Compute overall score** as weighted average of (possibly penalized) layer scores.
6. **Apply coverage cap** (e.g. missing SAST → cap overall at 80).
7. **Determine decision** (ALLOW / NEEDS_REVIEW / BLOCK) and build explanation.

### 2.2 Core formulas

**Layer risk (per layer):**

```
R = Σ(w_i × c_i × s_i) / Σ(w_i × c_i)
```

- `w_i` = weight of factor i  
- `c_i` = confidence [0,1]  
- `s_i` = severity [0,1]  

**Layer score:**

```
score = round(100 × (1 - R))
```

So: **low risk → high score** (100 = safest). If `Σ(w_i × c_i) = 0`, layer score = 100.

**Overall score (after gate penalties):**

```
overall_score = security_score × 0.5 + privacy_score × 0.3 + governance_score × 0.2
```

**Factor contribution (for explainability):**

```
contribution = severity × confidence × weight
```

---

## 3. Layer Weights (V1)

Defined in `src/extension_shield/scoring/weights.py`.

### 3.1 Layer → overall

| Layer      | Weight | Role |
|-----------|--------|------|
| Security  | 0.50   | Primary |
| Privacy   | 0.30   | Secondary |
| Governance| 0.20   | Policy/compliance |

### 3.2 Security factors (sum = 1.0)

| Factor      | Weight | Description |
|-------------|--------|-------------|
| SAST        | 0.30   | Static analysis findings |
| VirusTotal  | 0.15   | Malware detection |
| Obfuscation | 0.15   | Code obfuscation |
| Manifest    | 0.10   | Manifest security (CSP, MV3, host perms) |
| ChromeStats | 0.10   | Behavioral threat intel |
| Webstore    | 0.10   | Store reputation (rating, users, privacy policy) |
| Maintenance | 0.10   | Update freshness (staleness) |

### 3.3 Privacy factors (sum = 1.0)

| Factor             | Weight | Description |
|--------------------|--------|-------------|
| PermissionsBaseline| 0.25   | High-risk permission count |
| PermissionCombos   | 0.25   | Dangerous permission combos |
| NetworkExfil       | 0.35   | Network exfiltration patterns |
| CaptureSignals     | 0.15   | Screenshot/tab capture |

### 3.4 Governance factors (sum = 1.0)

| Factor              | Weight | Description |
|---------------------|--------|-------------|
| ToSViolations       | 0.50   | ToS / policy violations |
| Consistency         | 0.30   | Claimed vs actual behavior |
| DisclosureAlignment| 0.20   | Privacy policy vs data collection |

---

## 4. Normalizers (How Each Factor Is Calculated)

All in `src/extension_shield/scoring/normalizers.py`. Severity and confidence are always [0,1].

### 4.1 Security factors

- **SAST:** Exclude test files, dedupe by (rule_id, file_path, line). Weighted sum with `SAST_SEVERITY_WEIGHTS` (CRITICAL=15, HIGH=8, ERROR=3, MEDIUM=1.5, etc.). `severity = 1 - exp(-0.12 * x)`. Confidence: 1.0 if findings, 0.8 if ran but none, 0.6 if no scan.
- **VirusTotal:** Malicious count → severity (0→0, 1→0.3, 2–4→0.6, 5–9→0.8, ≥10→1.0); +suspicious. Confidence from engine count (e.g. ≥50 engines → 0.98).
- **Obfuscation:** `x = 2×obfuscated + 1×suspicious`; `severity = 1 - exp(-0.2*x)`. Confidence reduced by popularity (e.g. ≥1M users → ×0.6).
- **Manifest:** Missing CSP +0.3, MV2 +0.2, broad host +0.3; cap 1.0.
- **ChromeStats:** Uses `total_risk_score` with saturation; confidence 0.8 if enabled.
- **Webstore:** Low rating, low users, missing privacy policy → additive severity; confidence from data availability.
- **Maintenance:** Days since last update → severity (e.g. >365d → 0.8, 90–180d → 0.4, <90d → 0.1).

### 4.2 Privacy factors

- **PermissionsBaseline:** `n = high_risk_permissions + unreasonable_permissions`; `severity = 1 - exp(-0.25*n)`.
- **PermissionCombos:** Dangerous combos (e.g. cookies+webRequest, clipboardRead+webRequest, debugger, nativeMessaging) and broad host → additive severity, cap 1.0.
- **NetworkExfil:** Domain risk (known good 0.1, analytics 0.6, unknown 0.5) + suspicious flags (HTTP, base64, credential exfil, etc.); `severity = 1 - exp(-0.25*D)`; confidence from network analysis.
- **CaptureSignals:** Capture perms + screenshot analysis; context-aware (disclosed screenshot tool → lower severity, covert capture → higher).

### 4.3 Governance factors (computed in engine)

- **ToSViolations:** Prohibited perms (debugger, proxy, nativeMessaging), broad access + VT detection, travel-docs/visa portal automation risk.
- **Consistency:** Benign-claimed but high security/privacy risk; “offline” claim + network access.
- **DisclosureAlignment:** No privacy policy + data collection or network.

---

## 5. Hard Gates

Defined in `src/extension_shield/scoring/gates.py`. Evaluated **after** layer scores; they can **override** decision and **penalize** layer scores.

### 5.1 Gate list (priority order)

| Gate ID          | Layer     | Condition | Decision |
|------------------|-----------|-----------|----------|
| VT_MALWARE       | Security  | ≥5 malicious detections | BLOCK |
| VT_MALWARE       | Security  | 1–4 malicious          | WARN  |
| CRITICAL_SAST    | Security  | ≥1 critical or ≥3 high or critical-high pattern | BLOCK |
| TOS_VIOLATION    | Governance| Prohibited perms or travel-docs automation     | BLOCK |
| PURPOSE_MISMATCH | Governance| Credential/tracking vs claimed purpose         | WARN/BLOCK |
| SENSITIVE_EXFIL  | Privacy   | Sensitive perms + network + no privacy policy  | WARN  |

### 5.2 Gate penalties (applied to layer scores)

- CRITICAL_SAST → security −50  
- VT_MALWARE → security −45  
- TOS_VIOLATION → governance −60  
- PURPOSE_MISMATCH → governance −45  
- SENSITIVE_EXFIL → privacy −40  

Penalties are scaled by gate decision (BLOCK=1.0, WARN=0.7) and confidence; layer score is floored at 0.

---

## 6. Decision Logic

In `ScoringEngine._determine_decision`:

1. **Any blocking gate** → BLOCK  
2. **Security score < 30** → BLOCK  
3. **Overall score < 30** → BLOCK  
4. **Any warning gate** → NEEDS_REVIEW  
5. **Security score < 60** → NEEDS_REVIEW  
6. **Overall score < 60** → NEEDS_REVIEW (with optional privacy/governance reasons)  
7. **Else** → ALLOW  

If **SAST coverage is missing** and overall would be >80, overall is **capped at 80** and decision is forced to NEEDS_REVIEW.

---

## 7. Risk Bands (UI)

Used by DonutScore, sidebar tiles, and LayerModal. Defined in `frontend/src/constants/riskBands.js` and aligned with `normalizeScanResult.ts`:

| Band  | Score range | Label          | Color (CSS)     |
|-------|-------------|----------------|-----------------|
| BAD   | 0–59        | Not safe       | `--risk-bad`    |
| WARN  | 60–84       | Needs review   | `--risk-warn`   |
| GOOD  | 85–100      | Safe           | `--risk-good`   |
| NA    | —           | N/A            | `--risk-neutral`|

**Effective band** for a layer = max(score-based band, gate-based band) so that a triggered WARN/BLOCK gate can make the tile show WARN/BAD even if the numeric score would fall in a better band.

---

## 8. UI Cards on the Scan Results Page

### 8.1 Layout

- **Left column:** Extension card (meta + DonutScore) + Quick Summary (SummaryPanel).  
- **Right column:** Three sidebar tiles (Security, Privacy, Governance).  
- **Modals:** Layer modal (per-layer breakdown), Evidence drawer, File viewer.

### 8.2 Extension card (top-left)

- **Source:** `viewModel.meta` + `scores.overall` from normalized `ReportViewModel`.
- **Content:**
  - Icon (from `getExtensionIconUrl(extensionId)`).
  - Name: `meta.name` (extension_name / metadata.title / manifest.name).
  - Details: users, rating, “Last scanned” (meta.scanTimestamp), “Updated” (publisherDisclosures.last_updated_iso).
  - Description: from metadata.description, manifest.description, or report_view_model/summary (short overview 250 chars).
  - Publisher: trader status, Website, Support, Privacy, Web Store links (from publisherDisclosures).
- **DonutScore (same card, right side):**
  - **Props:** `score = scores.overall.score`, `band = scores.overall.band`, `size` (responsive).
  - **Behavior:** Circular gauge with three zones (red 0–59, amber 60–84, green 85–100); center shows numeric score and band label (“Safe” / “Needs review” / “Not safe”). No score calculation in frontend.

### 8.3 DonutScore component

- **File:** `frontend/src/components/report/DonutScore.jsx`
- **Inputs:** `score` (0–100), `band` ('GOOD'|'WARN'|'BAD'|'NA'), optional `size`, `label`.
- **Display:** Track segments by band; fill arc uses band color; center = score + status pill. Accessibility: aria-label describes score and scale.

### 8.4 ResultsSidebarTile (×3: Security, Privacy, Governance)

- **File:** `frontend/src/components/report/ResultsSidebarTile.jsx`
- **Inputs per tile:**
  - `title`: "Security" | "Privacy" | "Governance"
  - `score`: `scores.security.score` / `scores.privacy.score` / `scores.governance.score`
  - `band`: `scores.security.band` (etc.) — **effective** band (score + gate override)
  - `findingsCount`: length of `factorsByLayer.security` (etc.) — **count of factors** for that layer, not raw SAST count
  - `onClick`: opens LayerModal for that layer
- **Display:** Icon, title, “X%”, “N findings”, pill (Safe / Needs review / Not safe), progress bar (width = score %).

### 8.5 Quick Summary (SummaryPanel)

- **File:** `frontend/src/components/report/SummaryPanel.jsx`
- **Inputs:** `scores`, `factorsByLayer`, `rawScanResult`, `keyFindings`, `topFindings`, `onViewRiskyPermissions`, `onViewNetworkDomains`.
- **Content (priority order):**
  1. **Unified summary** (`report_view_model.unified_summary`): headline, narrative, tldr, concerns, recommendation.
  2. **Consumer summary** (`report_view_model.consumer_summary`): verdict, reasons, access, action.
  3. **Fallback:** `normalizeHighlights(raw)` (oneLiner, keyPoints) + engine keyFindings (high/medium severity) as concerns.
- **Decision badge:** From `scores.decision` (ALLOW → SAFE, WARN/NEEDS_REVIEW → REVIEW, BLOCK → BLOCKED).
- **Actions:** “View risky permissions” → Layer modal Security; “View network domains” → Layer modal Privacy.
- **Top 3 findings:** From `topFindings` (deduped security + privacy + governance findings, sliced to 3); only actionable findings (not pure factor-only labels like “Maintenance: Contribution: X%”) are shown.

### 8.6 Layer modal (Security / Privacy / Governance)

- **File:** `frontend/src/components/report/LayerModal.jsx`
- **Inputs:** `layer`, `score`, `band`, `factors` (= `factorsByLayer[layer]`), `keyFindings`, `gateResults`, `layerReasons`, `layerDetails`, `onViewEvidence`.
- **Content:**
  - Header: layer icon, title, score ring (mini donut), “X/100”, band label.
  - Insight: `layerDetails[layer].one_liner` or default tagline.
  - **Risk breakdown:** Factors grouped by category (Code Checks, Threat Detection, Trust Signals, What It Can Access, Data Handling, Rules & Policies). Each factor card: icon, human label, description, severity gauge (width = severity×100%), badge (Safe / Needs review / Not safe / Clear).
- **Factor name → human label:** e.g. SAST → “Code Safety”, VirusTotal → “Malware Scan”, PermissionsBaseline → “Permission Risk”, ToSViolations → “Policy Violations” (see `FACTOR_HUMAN` in LayerModal.jsx).

### 8.7 Evidence drawer & file viewer

- **EvidenceDrawer:** Shows evidence items for `evidenceIds` from factors/findings; evidence index comes from `governance_bundle.signal_pack.evidence` or legacy evidence_index.
- **FileViewerModal:** Fetches file content via API for a given extension and path.

---

## 9. View Model (Normalization)

- **File:** `frontend/src/utils/normalizeScanResult.ts`
- **Primary source:** `raw.scoring_v2` (or `raw.governance_bundle.scoring_v2`).
- **Scores:** `security_score`, `privacy_score`, `governance_score`, `overall_score`, `decision`, `reasons` from scoring_v2; fallbacks to legacy fields if needed.
- **Bands:** From `risk_level` if present, else from score thresholds (≥85 GOOD, ≥60 WARN, else BAD). **Effective band** = max(score band, gate band) per layer.
- **factorsByLayer:** From `scoring_v2.security_layer.factors` (and privacy, governance). Each factor: name, severity, confidence, weight, contribution, evidenceIds, details.
- **keyFindings:** Hard gates (by layer) + top factors by contribution (severity ≥ 0.4) + decision reasons fallback.
- **Findings by layer:** `extractFindingsByLayer(raw)` merges SAST findings, scoring_v2 factors (severity ≥ 0.3), triggered gates, unreasonable permissions, governance checks into security/privacy/governance arrays. **Findings count** in the sidebar is the length of **factors** for that layer (`factorsByLayer.security.length` etc.), not the full findings list length.

---

## 10. What Is Included in Each Card (Summary)

| Card            | Data source                    | What’s shown |
|-----------------|---------------------------------|--------------|
| Extension card  | meta, publisherDisclosures     | Name, icon, users, rating, last scanned, updated, description, publisher chips |
| DonutScore      | scores.overall                 | Overall score 0–100, band (Safe/Needs review/Not safe) |
| Security tile   | scores.security, factorsByLayer.security | Score %, findings count = # factors, band, progress bar |
| Privacy tile    | scores.privacy, factorsByLayer.privacy   | Same |
| Governance tile | scores.governance, factorsByLayer.governance | Same |
| Quick Summary   | report_view_model, scores, keyFindings, topFindings | Verdict, concerns, actions, top 3 findings |
| Layer modal     | factorsByLayer[layer], layerDetails      | Per-factor severity, category grouping, human labels |

---

## 11. Scoring Model Improvement Notes

- **Weights:** All factor and layer weights are in `weights.py`; changing them changes both layer and overall scores without touching normalizers.
- **Normalizers:** Severity/confidence formulas (e.g. saturation rate `k`, thresholds) are in `normalizers.py`; SAST weights in `SAST_SEVERITY_WEIGHTS`.
- **Gates:** Thresholds (e.g. VT block/warn, SAST critical/high counts) and penalties are in `gates.py` and `engine._apply_gate_penalties`.
- **Decision thresholds:** Score cutoffs (30 for BLOCK, 60 for NEEDS_REVIEW) and coverage cap (80) are in `engine._determine_decision` and the coverage-cap block in `calculate_scores`.
- **Frontend:** No recalculation; only band logic (score → band, gate override). For A/B tests, consider versioned weight presets (e.g. `weights_version` in engine) and exposing `scoring_version` / `base_overall` / `gate_penalty` in the API for transparency.
- **Findings count:** Sidebar shows **factor count** per layer. If you want “SAST finding count” or “total findings” instead, that would require a different field from the API or a different mapping in `ScanResultsPageV2` (e.g. use `findingsByLayer.security.length` instead of `factorsByLayer.security.length`).

---

## 12. Example: Authenticator-like Result

For a result like “Authenticator” (e.g. overall 80, Security 84%, Privacy 79%, Governance 100%):

- **Overall 80** = 0.5×security + 0.3×privacy + 0.2×governance (after any gate penalties).
- **Band “Needs review”** = overall in 60–84 (WARN).
- **Security 84%** = 100×(1 − R_sec) where R_sec is confidence-weighted risk from the 7 security factors.
- **Privacy 79%** = same from the 4 privacy factors.
- **Governance 100%** = no risk from the 3 governance factors.
- **Quick Summary** text (e.g. “Maintenance: moderate risk”, “PermissionsBaseline: low risk”, “Data access: can access current tab”) comes from unified_summary/consumer_summary or engine reasons/factors; “Top 3 findings” can show factor-level lines (e.g. “Security factor: severity 80%, confidence 90%”) when no richer finding text is available.

This document is the single reference for what appears on `/scan/results/authenticator` (and any other scan result) and how each number and label is produced by the engine and the UI.
