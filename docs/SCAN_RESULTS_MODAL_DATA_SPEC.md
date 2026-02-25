# Scan Results Page & Layer Modal Data Specification

**Route:** `/scan/results/[id]`  
**Purpose:** Document how data is displayed on the scan results page, specifically inside the **Security**, **Privacy**, and **Governance** modals. Use this spec to design or tune LLM outputs for each layer.

**See also:** [SCAN_RESULTS_ARCHITECTURE.md](./SCAN_RESULTS_ARCHITECTURE.md) for full implementation details (Quick Summary LLM, unified summary pipeline, and data flow).

---

## 1. Page Overview

The scan results page (`ScanResultsPageV2.jsx`) displays:
- **Hero section:** Extension name, icon, Safety Score dial
- **Score cards row:** 3 clickable tiles (Security, Privacy, Governance) — each opens a modal
- **Summary panel:** Quick summary (unified or consumer format)
- **Layer modals:** One modal per layer, opened when the user clicks the corresponding score card

---

## 2. Layer Modal Structure

Each modal (`LayerModal.jsx`) is built so **one clear decision comes first** (Safe / Needs review / Not safe), then reasons and evidence. Factor rows use **consistent, non-misleading status labels** so they support the verdict instead of conflicting with it.

| Section | Data Source | Display |
|---------|-------------|---------|
| **Header** | `score`, `band`, layer config | Layer title + icon + mini score ring + score (e.g. "84/100") + **verdict badge** (Safe / Needs review / Not safe) |
| **Decision** | `band`, `layerReasons` | **Verdict:** [Safe \| Needs review \| Not safe]. Short caption (e.g. "Some checks need attention before approval."). Up to 2 reasons from the scoring engine when available. |
| **One-liner** | `layerDetails[layer].one_liner` or fallback tagline | Optional plain-English summary of the layer. |
| **Factor breakdown** | `factors` (grouped by category) | Section title "Factor breakdown" + hint: "How each check contributed to the verdict above." Visual cards: factor label, description, severity bar, **status badge** (see below). |

### Factor status labels (per row)

Factor badges use a binary system for maximum clarity across all user backgrounds:

| Severity (0–1) | Badge label | Meaning |
|----------------|-------------|---------|
| ≥ 0.4 | **Issues Found** | Problems detected; needs attention. |
| &lt; 0.4 | **No Issues** | No problems detected for this check. |

The **layer verdict** (Safe / Needs Review / Not Safe) is the single source of truth; factor badges indicate whether each individual check found problems.

---

## 3. LLM Output Format (`layer_details`)

The backend generates `report_view_model.layer_details` via `LayerDetailsGenerator` (LLM) or `LayerHumanizer` (fallback).

### Schema (per layer)

```json
{
  "security": {
    "one_liner": "string (max 150 chars)",
    "key_points": ["string (max 120 chars each)", "..."],
    "what_to_watch": ["string (max 120 chars each)", "..."]
  },
  "privacy": {
    "one_liner": "string (max 150 chars)",
    "key_points": ["string (max 120 chars each)", "..."],
    "what_to_watch": ["string (max 120 chars each)", "..."]
  },
  "governance": {
    "one_liner": "string (max 150 chars)",
    "key_points": ["string (max 120 chars each)", "..."],
    "what_to_watch": ["string (max 120 chars each)", "..."]
  }
}
```

### Constraints

- `one_liner`: max 150 chars, single sentence takeaway
- `key_points`: 0–4 items, max 120 chars each; must reference real findings
- `what_to_watch`: 0–3 items, max 120 chars each; actionable tips
- Empty strings `""` are allowed for bullets with no finding
- All content must be plain English; no technical jargon

---

## 4. Prompt: `layer_details_generation.yaml`

**Location:** `src/extension_shield/llm/prompts/layer_details_generation.yaml`

### Template Variables Injected

| Variable | Source | Description |
|----------|--------|-------------|
| `security_score` | `ScoringResult.security_score` | 0–100 |
| `security_risk_level` | Derived from score (LOW/MEDIUM/HIGH) | 85+ = LOW, 60–84 = MEDIUM, &lt;60 = HIGH |
| `security_factors_json` | `scoring_result.security_layer.factors` | Array of factor objects |
| `security_gates_json` | Filtered `gate_results` for security | CRITICAL_SAST, VT_MALWARE, MANIFEST_POSTURE |
| `privacy_score` | `ScoringResult.privacy_score` | 0–100 |
| `privacy_risk_level` | Same thresholds | |
| `privacy_factors_json` | `scoring_result.privacy_layer.factors` | |
| `privacy_gates_json` | SENSITIVE_EXFIL, CAPTURE_SIGNALS | |
| `governance_score` | `ScoringResult.governance_score` | 0–100 |
| `governance_risk_level` | Same thresholds | |
| `governance_factors_json` | `scoring_result.governance_layer.factors` | |
| `governance_gates_json` | PURPOSE_MISMATCH, TOS_VIOLATION | |
| `permissions_summary_json` | `analysis_results.permissions_analysis` | |
| `host_access_summary_json` | From manifest (ALL_WEBSITES, SINGLE_DOMAIN, etc.) | |
| `sast_result_json` | `analysis_results.javascript_analysis` | |
| `network_evidence_json` | Extracted from SAST/network analysis | |
| `manifest_json` | Parsed manifest.json | |

### Jargon Translation Rules (from prompt)

| Technical Term | Plain English |
|----------------|---------------|
| SAST, static analysis | "security scan" |
| Obfuscation, minification, high entropy | "hidden or hard-to-read code" |
| eval(), new Function(), dynamic execution | "runs code it creates" |
| Exfiltration, data leakage | "sends data to external servers" |
| webRequest, webRequestBlocking | "can see/modify your web traffic" |
| &lt;all_urls&gt;, *://*/* | "runs on all websites" |
| cookies permission | "can read your cookies" |
| tabs permission | "can see your open tabs" |
| history permission | "can see your browsing history" |
| activeTab | "can access the page you're on" |
| content scripts | "runs code on webpages" |
| background script | "runs in the background" |
| manifest | "extension settings" |
| CSP | "security protections" |
| XSS, CSRF, injection | "security vulnerabilities" |
| CRITICAL_SAST | "dangerous code patterns" |
| SENSITIVE_EXFIL | "may leak sensitive data" |
| PURPOSE_MISMATCH | "doesn't match what it claims to do" |
| VT_MALWARE | "flagged by antivirus" |
| TOS_VIOLATION | "breaks store rules" |

---

## 5. Factors (Risk Breakdown)

Factors come from `scoring_v2.security_layer.factors`, `privacy_layer.factors`, and `governance_layer.factors`.

### FactorScore Model (Backend)

```python
# src/extension_shield/scoring/models.py
class FactorScore(BaseModel):
    name: str           # e.g., "SAST", "Obfuscation", "PermissionsBaseline"
    severity: float     # [0, 1] — 0 = no risk, 1 = max risk
    confidence: float   # [0, 1]
    weight: float       # [0, 1] — layer weight
    evidence_ids: List[str]
    details: Dict[str, Any]
    flags: List[str]
```

### Factor Names by Layer

**Security** (`weights.py`):

| Factor | Human Label (FACTOR_HUMAN) | Category | Description |
|--------|---------------------------|----------|-------------|
| SAST | Code Safety | code | Checks the code for security problems |
| VirusTotal | Malware Scan | threat | Checks if antivirus tools flag this extension |
| Obfuscation | Hidden Code | code | Some code is hidden or hard to read |
| Manifest | Extension Config | code | How the extension is set up and configured |
| ChromeStats | Threat Intelligence | threat | Known security issues from Chrome data |
| Webstore | Store Reputation | trust | Ratings and reviews from the Chrome store |
| Maintenance | Update Freshness | trust | When the extension was last updated |

**Privacy**:

| Factor | Human Label | Category | Description |
|--------|-------------|----------|-------------|
| PermissionsBaseline | Permission Risk | access | What the extension can access on your browser |
| PermissionCombos | Dangerous Combos | access | Risky combinations of what it can do |
| NetworkExfil | Data Sharing | data | Can it send your data to external servers? |
| CaptureSignals | Screen / Tab Capture | data | Can record your screen or browser tabs |

**Governance**:

| Factor | Human Label | Category | Description |
|--------|-------------|----------|-------------|
| ToSViolations | Policy Violations | policy | Does it follow Chrome store rules? |
| Consistency | Behavior Match | policy | Does it do what it says it does? |
| DisclosureAlignment | Disclosure Accuracy | policy | Is the privacy policy accurate? |

### Category Labels (for grouping)

| category | CATEGORY_LABELS |
|----------|-----------------|
| code | Code Checks |
| threat | Threat Detection |
| trust | Trust Signals |
| access | What It Can Access |
| data | Data Handling |
| policy | Rules & Policies |

### Severity → Status (Frontend)

| severity | status | color |
|----------|--------|-------|
| ≥ 0.4 | Issues Found | #F59E0B (warn) |
| &lt; 0.4 | No Issues | #10B981 (good) |

---

## 6. Gates (per layer)

Gates are evaluated by the scoring engine; when triggered they affect the score and appear in gate_results.

| Gate ID | Layer | Plain English (GATE_EXPLANATIONS) |
|---------|-------|-----------------------------------|
| CRITICAL_SAST | security | dangerous code pattern found |
| VT_MALWARE | security | flagged by antivirus engines |
| MANIFEST_POSTURE | security | suspicious manifest configuration |
| SENSITIVE_EXFIL | privacy | signals that sensitive data could be sent out |
| CAPTURE_SIGNALS | privacy | may capture user input/data |
| PURPOSE_MISMATCH | governance | behavior doesn't match what it claims |
| TOS_VIOLATION | governance | violates Chrome Web Store policies |

---

## 7. Permissions (“What It Can Do”)

### PermissionsVM Structure (from `buildPermissions()`)

```ts
{
  apiPermissions?: string[];
  hostPermissions?: string[];
  highRiskPermissions?: string[];
  unreasonablePermissions?: string[];
  broadHostPatterns?: string[];
}
```

### buildPermsList() Logic

`buildPermsList()` in `LayerModal.jsx` builds the list from:
- **Security:** `powerfulPermissions` (debugger, webRequestBlocking, nativeMessaging, proxy, broad host patterns)
- **Privacy:** `permissions` (highRiskPermissions, broadHostPatterns, unreasonablePermissions, apiPermissions, hostPermissions)

### humanizePermission() Mapping

| Permission | Plain English |
|------------|---------------|
| tabs | See your open tabs |
| cookies | Read your cookies |
| history | Read your browsing history |
| webNavigation | See every page you visit |
| webRequest | Intercept network requests |
| webRequestBlocking | Block / modify network requests |
| clipboardRead | Read your clipboard |
| storage | Store data locally |
| activeTab | Access the page you are viewing |
| &lt;all_urls&gt; | Access all websites |
| desktopCapture | Record your desktop |
| tabCapture | Record a browser tab |
| identity | Access your Google account info |
| scripting | Run scripts on pages you visit |
| ... | (see `LayerModal.jsx` for full list) |

URL patterns like `https://*/*` are mapped to "Access all websites" or "Access {hostname}".

---

## 8. Data Flow (Backend → Frontend)

```
API GET /api/scan/results/{extension_id}
    ↓
Returns: scan_results (raw) + report_view_model + scoring_v2
    ↓
report_view_model.layer_details = LayerDetailsGenerator.generate()
    OR LayerHumanizer.generate_layer_details_fallback()
    ↓
Frontend: normalizeScanResultSafe(raw)
    ↓
viewModel = { meta, scores, factorsByLayer, keyFindings, permissions, evidenceIndex }
    ↓
ScanResultsPageV2 passes to LayerModal:
    - score: scores.security.score (or privacy, governance)
    - band: scores.security.band (GOOD | WARN | BAD | NA)
    - factors: factorsByLayer.security (or privacy, governance)
    - permissions: permissions (full PermissionsVM)
    - powerfulPermissions: filtered high-risk perms (security only)
    - gateResults: scanResults.scoring_v2.gate_results (filtered by layer)
    - layerDetails: scanResults.report_view_model.layer_details
```

---

## 9. Layer Config (Frontend)

| Layer | Title | Icon | Tagline |
|-------|-------|------|---------|
| security | Security | 🛡️ | Is the extension code safe to run? |
| privacy | Privacy | 🔒 | What can it see and where does your data go? |
| governance | Governance | 📋 | Does it follow the rules and match its claims? |

---

## 10. Score Bands

| Band | Score Range | Label | Color |
|------|-------------|-------|-------|
| GOOD | ≥ 85 | Good | #10B981 |
| WARN | 60–84 | Caution | #F59E0B |
| BAD | 0–59 | Bad | #EF4444 |
| NA | null | (none) | #6B7280 |

---

## 11. Fallback: LayerHumanizer

When the LLM fails, `LayerHumanizer.generate_layer_details_fallback()` produces deterministic layer details using:
- Gate explanations (`GATE_EXPLANATIONS`)
- Factor explanations (`FACTOR_EXPLANATIONS`)
- Permission explanations (`PERMISSION_EXPLANATIONS`)
- Host pattern explanations (`HOST_EXPLANATIONS`)

The output schema matches the LLM schema exactly, so the frontend does not need to change.

---

## 12. Creating LLM Output for This Page

To design or tune an LLM for the layer modals:

1. **Inputs:** Use the same variables as `layer_details_generation` (factors, gates, permissions, host access, SAST, manifest).
2. **Output schema:** Match the `layer_details` schema for each of security, privacy, governance.
3. **Constraints:** Enforce length limits (one_liner ≤ 150 chars, bullets ≤ 120 chars).
4. **Tone:** Align with risk level (LOW = reassuring, MEDIUM = cautious, HIGH = direct warning).
5. **Jargon:** Use the translation table; avoid raw gate IDs, permission names, or technical terms unless explained in plain English.
6. **Grounding:** Every bullet must map to a real finding (factor, gate, or permission); use `""` when there is no finding.

---

## 13. File Reference

| File | Role |
|------|------|
| `frontend/src/pages/scanner/ScanResultsPageV2.jsx` | Results page; passes data to LayerModal |
| `frontend/src/components/report/LayerModal.jsx` | Modal UI; FACTOR_HUMAN, CATEGORY_LABELS, humanizePermission |
| `frontend/src/utils/normalizeScanResult.ts` | Maps raw API → ReportViewModel |
| `frontend/src/utils/reportTypes.ts` | FactorVM, PermissionsVM, RawScoringV2, etc. |
| `src/extension_shield/core/layer_details_generator.py` | LLM-based layer details |
| `src/extension_shield/llm/prompts/layer_details_generation.yaml` | Prompt template |
| `src/extension_shield/scoring/humanize.py` | Deterministic fallback |
| `src/extension_shield/scoring/models.py` | FactorScore, ScoringResult |
| `src/extension_shield/scoring/weights.py` | Factor names per layer |
