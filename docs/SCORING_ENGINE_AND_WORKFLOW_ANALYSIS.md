# ExtensionShield Scoring Engine & Workflow — Complete Analysis

This document is a **complete analysis** of the ExtensionShield `src/extension_shield` codebase: how the **scoring engine** calculates all values and how the **end-to-end workflow** runs from input to final score and decision. It is the single reference for understanding calculations and data flow.

---

## 1. Architecture Overview

### 1.1 Three-Layer Scoring Model

| Layer | Name | Role | Key Components |
|-------|------|------|----------------|
| **Layer 0** | Signal Extraction | Normalize tool outputs into a single structure | `SignalPackBuilder`, tool adapters, `SignalPack` |
| **Layer 1** | Risk Scoring | Compute numeric scores and decision from signals | `ScoringEngine`, normalizers, weights, gates |
| **Layer 2** | Decision / Governance | Rules engine + report (legacy); **decision comes from Layer 1** | Rules engine, report generator; **V2 decision = ScoringEngine** |

**Single source of truth for scores and decision:** `src/extension_shield/scoring/engine.py` — `ScoringEngine.calculate_scores()`. The UI and API consume `scoring_v2` from the governance bundle; no client-side score computation.

### 1.2 High-Level Data Flow

```
Input (URL / ID / CRX)
    → Workflow nodes (download, manifest, analyzers, summary, impact, privacy)
    → analysis_results + manifest + metadata
    → governance_node:
        → Layer 0: SignalPackBuilder.build() → SignalPack
        → Layer 1: ScoringEngine.calculate_scores(signal_pack, manifest) → ScoringResult
        → governance_bundle.scoring_v2 = serialized ScoringResult + explanation + gates
    → cleanup_node → END
```

---

## 2. End-to-End Workflow

### 2.1 Workflow Graph

Defined in `workflow/graph.py`. Nodes and transitions (each node returns `Command(goto=...)`):

| Order | Node | File | Next step(s) |
|-------|------|------|--------------|
| 1 | `extension_path_routing_node` | `workflow/nodes.py` | Extension ID → `chromestats_downloader_node`; CWS URL → `extension_metadata_node`; local CRX → `extension_downloader_node`; else → END (failed) |
| 2 | `extension_metadata_node` | `workflow/nodes.py` | Fetches metadata (and chrome-stats); → `extension_downloader_node` |
| 3 | `chromestats_downloader_node` | `workflow/nodes.py` | Downloads from chrome-stats by ID; extracts CRX; → `manifest_parser_node` |
| 4 | `extension_downloader_node` | `workflow/nodes.py` | Downloads CWS or extracts local CRX; → `manifest_parser_node` |
| 5 | `manifest_parser_node` | `workflow/nodes.py` | Parses `manifest.json`; → `extension_analyzer_node` |
| 6 | `extension_analyzer_node` | `workflow/nodes.py` | Runs `ExtensionAnalyzer.analyze()` (all analyzers); → `summary_generation_node` |
| 7 | `summary_generation_node` | `workflow/nodes.py` | LLM summary from analysis + manifest; → `impact_analysis_node` |
| 8 | `impact_analysis_node` | `workflow/nodes.py` | Impact analysis (LLM); merges into `analysis_results`; → `privacy_compliance_node` |
| 9 | `privacy_compliance_node` | `workflow/nodes.py` | Privacy/compliance snapshot (LLM); merges into `analysis_results`; → `governance_node` |
| 10 | **`governance_node`** | **`workflow/governance_nodes.py`** | **Layer 0 + Layer 1 scoring + legacy stages; → `cleanup_node`** |
| 11 | `cleanup_node` | `workflow/nodes.py` | Collects file list; removes downloaded CRX only; → END |

State is held in `WorkflowState` (`workflow/state.py`): `workflow_id`, `chrome_extension_path`, `extension_dir`, `manifest_data`, `analysis_results`, `executive_summary`, `impact_analysis`, `privacy_compliance`, `governance_bundle`, `governance_verdict`, etc.

### 2.2 Where Scoring Runs

Scoring runs **only** inside **`governance_node`** (`workflow/governance_nodes.py`):

1. **Layer 0:** `SignalPackBuilder().build(scan_id, analysis_results, metadata, manifest, extension_id)` → `SignalPack`.
2. **Layer 1:** `ScoringEngine(weights_version="v1").calculate_scores(signal_pack, manifest_data, user_count)` → `ScoringResult`.
3. Explanation and gate results are taken from the engine; `scoring_v2` is built from `ScoringResult` and attached to `governance_bundle`.

`analysis_results` is produced by **`ExtensionAnalyzer.analyze()`** (`core/extension_analyzer.py`), which runs:

- PermissionsAnalyzer  
- JavaScriptAnalyzer (SAST)  
- WebstoreAnalyzer  
- VirusTotalAnalyzer  
- EntropyAnalyzer  
- ChromeStatsAnalyzer  

These outputs are not yet normalized to severity/confidence; that happens in Layer 0 (adapters → SignalPack) and Layer 1 (normalizers → factors → scores).

---

## 3. Layer 0: Signal Extraction

### 3.1 SignalPackBuilder

**File:** `governance/tool_adapters.py` — class `SignalPackBuilder`.

**Purpose:** Turn `analysis_results`, `metadata`, and `manifest` into one **SignalPack** (Layer 0).

**Process:**

- Instantiates adapters: `SastAdapter`, `VirusTotalAdapter`, `EntropyAdapter`, `WebstoreStatsAdapter`, `WebstoreReviewsAdapter`, `PermissionsAdapter`, `ChromeStatsAdapter`, `NetworkAdapter`.
- Calls `adapter.adapt(...)` for each, mutating a single `SignalPack` (evidence, sast, virustotal, entropy, webstore_stats, permissions, chromestats, network).

**Output:** `SignalPack` (`governance/signal_pack.py`) containing:

- `sast`: `SastSignalPack` (deduped_findings, files_scanned, confidence, etc.)
- `virustotal`: `VirusTotalSignalPack` (malicious_count, suspicious_count, total_engines, enabled, etc.)
- `entropy`: `EntropySignalPack` (obfuscated_count, suspicious_count, files_analyzed, etc.)
- `webstore_stats`: `WebstoreStatsSignalPack` (installs, rating_avg, last_updated, has_privacy_policy, etc.)
- `permissions`: `PermissionsSignalPack` (api_permissions, high_risk_permissions, unreasonable_permissions, has_broad_host_access, etc.)
- `chromestats`: `ChromeStatsSignalPack` (enabled, total_risk_score, risk_indicators, etc.)
- `network`: `NetworkSignalPack` (enabled, domains, suspicious_flags, confidence, etc.)
- `evidence`: list of `ToolEvidence`

This SignalPack is the **only** input to the scoring engine (plus optional manifest and user_count).

---

## 4. Layer 1: Scoring Engine — How Everything Is Calculated

**File:** `scoring/engine.py` — class `ScoringEngine`.

### 4.1 Entry Point and Steps

**Method:** `calculate_scores(signal_pack, manifest=None, user_count=None, permissions_analysis=None)`.

Steps:

1. **Normalize signals to factors** (severity [0,1], confidence [0,1]) for Security, Privacy, Governance.
2. **Compute layer scores** with a confidence-weighted risk formula.
3. **Evaluate hard gates** (can BLOCK/WARN regardless of score).
4. **Apply gate penalties** to layer scores.
5. **Compute overall score** as weighted average of (penalized) layer scores.
6. **Apply coverage cap** (e.g. SAST missing → cap overall at 80, force NEEDS_REVIEW).
7. **Determine decision** (ALLOW / NEEDS_REVIEW / BLOCK) and build explanation.

---

### 4.2 Core Formulas

**Layer risk (per layer):**

\[
R = \frac{\sum_i (w_i \cdot c_i \cdot s_i)}{\sum_i (w_i \cdot c_i)}
\]

- \(w_i\) = weight of factor \(i\)  
- \(c_i\) = confidence in factor \(i\) ∈ [0, 1]  
- \(s_i\) = severity of factor \(i\) ∈ [0, 1]  

**Layer score:**

\[
\text{score} = \text{round}\big(100 \times (1 - R)\big)
\]

So **low risk → high score**; 100 = safest. If \(\sum_i (w_i \cdot c_i) = 0\), layer score = 100.

**Overall score (after gate penalties):**

\[
\text{overall\_score} = \text{security\_score} \times 0.5 + \text{privacy\_score} \times 0.3 + \text{governance\_score} \times 0.2
\]

**Factor contribution (for explainability):**

\[
\text{contribution}_i = s_i \times c_i \times w_i
\]

Implemented in:

- `_calculate_layer_score()` (risk and score per layer)
- `FactorScore.contribution` in `scoring/models.py`

---

### 4.3 Weights

**File:** `scoring/weights.py`.

**Layer → overall (LAYER_WEIGHTS):**

| Layer     | Weight | Role            |
|----------|--------|-----------------|
| Security | 0.50   | Primary         |
| Privacy  | 0.30   | Secondary       |
| Governance | 0.20 | Policy/compliance |

**Security factors (SECURITY_WEIGHTS_V1, sum = 1.0):**

| Factor     | Weight | Description                    |
|------------|--------|---------------------------------|
| SAST       | 0.30   | Static analysis findings        |
| VirusTotal | 0.15   | Malware detection               |
| Obfuscation| 0.15   | Code obfuscation                |
| Manifest   | 0.10   | CSP, MV3, host perms            |
| ChromeStats| 0.10   | Behavioral threat intel        |
| Webstore   | 0.10   | Store reputation                |
| Maintenance| 0.10   | Update freshness (staleness)    |

**Privacy factors (PRIVACY_WEIGHTS_V1, sum = 1.0):**

| Factor              | Weight | Description                    |
|---------------------|--------|---------------------------------|
| PermissionsBaseline | 0.25   | High-risk permission count      |
| PermissionCombos    | 0.25   | Dangerous permission combos     |
| NetworkExfil        | 0.35   | Network exfiltration patterns   |
| CaptureSignals      | 0.15   | Screenshot/tab capture          |

**Governance factors (GOVERNANCE_WEIGHTS_V1, sum = 1.0):**

| Factor               | Weight | Description                    |
|----------------------|--------|---------------------------------|
| ToSViolations        | 0.50   | ToS / policy violations        |
| Consistency          | 0.30   | Claimed vs actual behavior     |
| DisclosureAlignment  | 0.20   | Privacy policy vs data collection |

---

### 4.4 Normalizers (Severity & Confidence)

**File:** `scoring/normalizers.py`. All outputs are factors with **severity** and **confidence** in [0, 1].

**Shared:** Saturation formula `severity = 1 - exp(-k * x)` (diminishing returns). `k` and inputs vary by factor.

**Security factors:**

| Factor | Severity / confidence logic |
|--------|-----------------------------|
| **SAST** | Exclude test files; dedupe by (rule_id, file_path, line). Weighted sum with `SAST_SEVERITY_WEIGHTS` (CRITICAL=15, HIGH=8, ERROR=3, MEDIUM=1.5, WARNING=0.5, INFO/LOW=0.1). `severity = 1 - exp(-0.12 * x)`. Confidence: 1.0 if findings, 0.8 if ran but none, 0.6 if no scan. |
| **VirusTotal** | Malicious count → base severity (0→0, 1→0.3, 2–4→0.6, 5–9→0.8, ≥10→1.0); +suspicious up to +0.2. Confidence: 1.0 if ≥30 engines, 0.7 if &lt;30, 0.4 if 0 engines. |
| **Obfuscation** | `x = 2×obfuscated + 1×suspicious`; `severity = 1 - exp(-0.2*x)`. Confidence reduced by popularity (e.g. ≥1M users → ×0.6, ≥100K → ×0.7). |
| **Manifest** | Missing CSP +0.3, MV2 +0.2, broad host +0.3; cap 1.0. Confidence 1.0 if manifest parsed. |
| **ChromeStats** | `severity = 1 - exp(-0.1 * total_risk_score)`. Confidence 0.8 if enabled, 0.4 if not. |
| **Webstore** | Low rating (&lt;2→+0.4, &lt;3→+0.3, &lt;3.5→+0.15), low users (&lt;100→+0.3, &lt;1K→+0.2, &lt;10K→+0.1), missing privacy policy +0.2; cap 1.0. Confidence from data availability. |
| **Maintenance** | Days since last update: &gt;365→0.8, 180–365→0.6, 90–180→0.4, &lt;90→0.1. Confidence 0.9 if date present, 0.3 otherwise. |

**Privacy factors:**

| Factor | Severity / confidence logic |
|--------|-----------------------------|
| **PermissionsBaseline** | `n = high_risk_permissions + unreasonable_permissions`; `severity = 1 - exp(-0.25*n)`. Confidence 1.0 if permission data, else 0.5. |
| **PermissionCombos** | Dangerous combos (cookies+webRequest, clipboardRead+webRequest, debugger, nativeMessaging, etc.) and broad host → additive severity, cap 1.0. Confidence 1.0 if any permissions. |
| **NetworkExfil** | Domain risk (known good +0.1, analytics +0.6, unknown +0.5) + base for network access + suspicious flags (HTTP, base64, credential exfil, data harvest, etc.); `severity = 1 - exp(-0.25*D)`. Confidence from `network.confidence`. |
| **CaptureSignals** | Capture perms + screenshot analysis; context-aware (disclosed screenshot tool → lower severity, covert capture → higher); cap 1.0. |

**Governance factors:** Computed inside the engine in `_compute_governance_factors()`:

| Factor | Logic |
|--------|--------|
| **ToSViolations** | Prohibited perms (debugger, proxy, nativeMessaging); broad access + VT detection; travel-docs/visa portal automation risk (protected domains + injection/capture/ecosystem). |
| **Consistency** | Benign-claimed but high security/privacy risk; “offline” claim + network access. |
| **DisclosureAlignment** | No privacy policy + data collection or network. |

---

### 4.5 Hard Gates

**File:** `scoring/gates.py` — class `HardGates`. Evaluated **after** layer scores; they can **override decision** and **penalize** layer scores.

**Order:** VT_MALWARE → CRITICAL_SAST → TOS_VIOLATION → PURPOSE_MISMATCH → SENSITIVE_EXFIL.

| Gate ID | Layer | Condition | Decision |
|---------|--------|-----------|----------|
| VT_MALWARE | Security | ≥5 malicious | BLOCK |
| VT_MALWARE | Security | 1–4 malicious | WARN |
| CRITICAL_SAST | Security | ≥1 critical or ≥3 high or critical-high pattern match | BLOCK |
| TOS_VIOLATION | Governance | Prohibited perms or travel-docs automation | BLOCK |
| PURPOSE_MISMATCH | Governance | Credential/tracking vs claimed purpose; benign claim + risky caps | WARN/BLOCK |
| SENSITIVE_EXFIL | Privacy | Sensitive perms + network + no privacy policy (2+ risk factors) | WARN |

**Gate penalties (applied to layer scores in `_apply_gate_penalties`):**

| Gate | Layer | Base penalty | BLOCK multiplier | WARN multiplier |
|------|--------|--------------|------------------|-----------------|
| CRITICAL_SAST | security | 50 | 1.0 | 0.7 |
| VT_MALWARE | security | 45 | 1.0 | 0.7 |
| TOS_VIOLATION | governance | 60 | 1.0 | 0.7 |
| PURPOSE_MISMATCH | governance | 45 | 1.0 | 0.7 |
| SENSITIVE_EXFIL | privacy | 40 | 1.0 | 0.7 |

Adjusted penalty = base × decision_multiplier × gate confidence; layer score = max(0, score - penalty). Only the maximum penalty per layer is applied.

---

### 4.6 Decision Logic

**Method:** `_determine_decision()` in `scoring/engine.py`.

Priority:

1. Any **blocking gate** → **BLOCK**  
2. **Security score &lt; 30** → **BLOCK**  
3. **Overall score &lt; 30** → **BLOCK**  
4. Any **warning gate** → **NEEDS_REVIEW**  
5. **Security score &lt; 60** → **NEEDS_REVIEW**  
6. **Overall score &lt; 60** → **NEEDS_REVIEW** (with optional privacy/governance reasons)  
7. Else → **ALLOW**

If **SAST coverage is missing** (no files scanned and no deduped findings) and overall would be &gt;80, **overall is capped at 80** and decision is set to **NEEDS_REVIEW** (with coverage reason).

---

### 4.7 Coverage Cap

- Condition: `sast_missing_coverage and overall_score > 80`.  
- Action: `overall_score = 80`, `coverage_cap_applied = True`, append coverage reason, and if decision is not BLOCK, set decision to NEEDS_REVIEW.

---

## 5. Output Structures

### 5.1 ScoringResult

**File:** `scoring/models.py`. Returned by `ScoringEngine.calculate_scores()`.

Contains:

- `security_score`, `privacy_score`, `governance_score`, `overall_score` (0–100)
- `decision`: ALLOW | NEEDS_REVIEW | BLOCK
- `reasons`: list of strings
- `security_layer`, `privacy_layer`, `governance_layer`: `LayerScore` (score, risk, factors)
- `hard_gates_triggered`: list of gate IDs
- `base_overall`, `gate_penalty`, `gate_reasons`, `coverage_cap_applied`, `coverage_cap_reason`
- `scoring_version`, `overall_confidence`, `explanation` (summary string)

### 5.2 governance_bundle.scoring_v2

Built in `governance_nodes.py` from `ScoringResult` and engine explanation/gate results. Includes:

- All score and decision fields
- Full layer breakdowns (`security_layer`, `privacy_layer`, `governance_layer`) via `model_dump_for_api()`
- `explanation` (from `ExplanationBuilder`)
- `gate_results` (list of gate_id, decision, triggered, confidence, reasons)

This is what the API and frontend use as the single source of truth for scores and decision.

### 5.3 Explanation Builder

**File:** `scoring/explain.py`. Builds human- and machine-readable explanations from `ScoringResult` and gate results: layers, factors, top contributors, decision rationale, gate summary. Used for API/UI and audit/debug.

---

## 6. Legacy vs V2 Scoring

- **Legacy:** `core/security_scorer.py` — `SecurityScorer.calculate_score(analysis_results)` uses risk points (SAST, permissions, VT, entropy, chromestats, webstore, manifest) and `security_score = 100 - total_risk_points`. This is **not** used for the main UI/API decision; it is legacy.
- **V2 (current):** `ScoringEngine` in `scoring/engine.py` with normalizers, weights, and gates. Output is exposed as `governance_bundle.scoring_v2` and is the **single source of truth** for the scan results page and API.

---

## 7. File Reference

| Concern | Primary file(s) |
|--------|------------------|
| Workflow graph | `workflow/graph.py` |
| Workflow nodes | `workflow/nodes.py`, `workflow/governance_nodes.py` |
| Workflow state | `workflow/state.py` |
| Extension analysis | `core/extension_analyzer.py` |
| Layer 0: SignalPack | `governance/signal_pack.py`, `governance/tool_adapters.py` (SignalPackBuilder + adapters) |
| Layer 1: Scoring engine | `scoring/engine.py` |
| Weights | `scoring/weights.py` |
| Normalizers | `scoring/normalizers.py` |
| Gates | `scoring/gates.py` |
| Models | `scoring/models.py` |
| Explanation | `scoring/explain.py` |
| Legacy security score | `core/security_scorer.py` |

---

## 8. Summary: How Each Number Is Calculated

| Output | Calculation |
|--------|-------------|
| **Security score** | Confidence-weighted risk R from 7 security factors → `round(100*(1-R))`; then minus security gate penalties; floor 0. |
| **Privacy score** | Same formula from 4 privacy factors; then minus privacy gate penalties; floor 0. |
| **Governance score** | Same formula from 3 governance factors; then minus governance gate penalties; floor 0. |
| **Overall score** | 0.5×security + 0.3×privacy + 0.2×governance (after penalties). If SAST missing and overall &gt;80 → cap at 80. |
| **Decision** | By priority: blocking gate → BLOCK; security&lt;30 or overall&lt;30 → BLOCK; warning gate → NEEDS_REVIEW; security&lt;60 or overall&lt;60 → NEEDS_REVIEW; else ALLOW. Coverage cap can force NEEDS_REVIEW. |
| **Factor contribution** | For each factor: `severity × confidence × weight`. |
| **Layer risk** | \(R = \sum(w_i c_i s_i) / \sum(w_i c_i)\) over that layer’s factors. |

This completes the analysis of the scoring engine and workflow in `src/extension_shield`.
