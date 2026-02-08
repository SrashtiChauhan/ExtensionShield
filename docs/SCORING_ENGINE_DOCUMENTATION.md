# ExtensionShield Scoring Engine Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Pipeline Flow](#pipeline-flow)
4. [Scoring Engine (V2.0.0)](#scoring-engine-v200)
5. [Scoring Criteria](#scoring-criteria)
6. [Layer Breakdown](#layer-breakdown)
7. [Hard Gates](#hard-gates)
8. [API Response Structure](#api-response-structure)
9. [Frontend Integration](#frontend-integration)

---

## Overview

ExtensionShield uses a **3-Layer Scoring Architecture** to evaluate Chrome extensions:

- **Layer 0: Signal Extraction** - Collects and normalizes signals from all analysis tools
- **Layer 1: Risk Scoring** - Calculates security, privacy, and governance scores
- **Layer 2: Decision** - Applies hard gates and determines final verdict (ALLOW/BLOCK/NEEDS_REVIEW)

The scoring engine (V2.0.0) uses **confidence-weighted aggregation** to account for uncertainty in each factor, providing explainable and transparent risk assessments.

---

## Architecture

### 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: Signal Extraction                                  │
│ - SignalPackBuilder collects tool outputs                   │
│ - Normalizes to SignalPack structure                        │
│ - Generates evidence items with stable IDs                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Risk Scoring (ScoringEngine)                      │
│ - Normalizes signals to severity [0,1] + confidence [0,1] │
│ - Calculates layer scores (Security, Privacy, Governance)  │
│ - Applies weights and confidence-weighted aggregation      │
│ - Computes overall score                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Decision (Hard Gates)                             │
│ - Evaluates hard gates (VT_MALWARE, CRITICAL_SAST, etc.)    │
│ - Determines final decision: ALLOW/BLOCK/NEEDS_REVIEW       │
│ - Generates explanation payload                             │
└─────────────────────────────────────────────────────────────┘
```

### Mathematical Foundation

**Layer Risk Formula:**
```
R = Σ(w_i × c_i × s_i) / Σ(w_i × c_i)
```

**Layer Score:**
```
score = round(100 × (1 - R))
```

**Overall Score:**
```
overall = security_score × 0.5 + privacy_score × 0.3 + governance_score × 0.2
```

Where:
- `w_i` = weight of factor i
- `c_i` = confidence in factor i [0,1]
- `s_i` = severity of factor i [0,1]

---

## Pipeline Flow

### Complete Workflow

1. **Extension Download/Extraction**
   - Downloads extension from Chrome Web Store or chrome-stats.com
   - Extracts CRX/ZIP to temporary directory

2. **Manifest Parsing**
   - Parses `manifest.json` to extract permissions, CSP, version, etc.

3. **Extension Analysis** (`ExtensionAnalyzer`)
   - **Permissions Analysis** - Analyzes requested permissions
   - **SAST Analysis** - Static code analysis using Semgrep
   - **VirusTotal Analysis** - Malware detection via VirusTotal API
   - **Entropy Analysis** - Detects obfuscation/minification
   - **ChromeStats Analysis** - Behavioral threat intelligence
   - **Webstore Analysis** - Extracts metadata from Chrome Web Store

4. **Signal Extraction** (`SignalPackBuilder`)
   - Builds normalized `SignalPack` from all tool outputs
   - Creates evidence items with stable IDs
   - Normalizes all signals to consistent format

5. **Scoring** (`ScoringEngine`)
   - Normalizes signals to severity [0,1] and confidence [0,1]
   - Calculates Security, Privacy, and Governance layer scores
   - Evaluates hard gates
   - Determines final decision

6. **Report Generation**
   - Generates executive summary
   - Builds impact analysis
   - Creates privacy compliance snapshot
   - Generates governance report

### Workflow Nodes

The workflow is implemented as a LangGraph with the following nodes:

1. `extension_path_routing_node` - Routes based on input type (URL, ID, file)
2. `extension_metadata_node` - Extracts metadata from Chrome Web Store
3. `chromestats_downloader_node` - Downloads extension from chrome-stats.com
4. `extension_downloader_node` - Downloads/extracts extension files
5. `manifest_parser_node` - Parses manifest.json
6. `extension_analyzer_node` - Runs all analyzers (SAST, VT, permissions, etc.)
7. `summary_generation_node` - Generates executive summary
8. `impact_analysis_node` - Analyzes impact buckets
9. `privacy_compliance_node` - Generates privacy compliance snapshot
10. `governance_node` - Runs governance pipeline (Layer 0-2)
11. `cleanup_node` - Cleans up temporary files

---

## Scoring Engine (V2.0.0)

### Main Entry Point

**Class:** `ScoringEngine`  
**Location:** `src/extension_shield/scoring/engine.py`

**Usage:**
```python
from extension_shield.scoring.engine import ScoringEngine
from extension_shield.governance.signal_pack import SignalPack

engine = ScoringEngine(weights_version="v1")
result = engine.calculate_scores(
    signal_pack=signal_pack,
    manifest=manifest,
    user_count=user_count,
    permissions_analysis=permissions_analysis,
)

# Access results
print(result.overall_score)  # 0-100
print(result.decision)  # ALLOW, BLOCK, or NEEDS_REVIEW
print(result.security_score)
print(result.privacy_score)
print(result.governance_score)

# Get explanation
explanation = engine.get_explanation()
```

### ScoringResult Structure

```python
class ScoringResult:
    scan_id: str
    extension_id: str
    security_score: int  # 0-100
    privacy_score: int  # 0-100
    governance_score: int  # 0-100
    overall_score: int  # 0-100 (weighted average)
    overall_confidence: float  # 0-1
    decision: Decision  # ALLOW, BLOCK, NEEDS_REVIEW
    reasons: List[str]  # Human-readable reasons
    explanation: str  # Summary explanation
    security_layer: LayerScore  # Detailed breakdown
    privacy_layer: LayerScore  # Detailed breakdown
    governance_layer: LayerScore  # Detailed breakdown
    hard_gates_triggered: List[str]  # Gate IDs that triggered
    scoring_version: str  # "2.0.0"
```

### Decision Logic

Decision priority (in order):

1. **Any blocking gate triggered** → `BLOCK`
2. **Security score < 30** → `BLOCK`
3. **Overall score < 30** → `BLOCK`
4. **Any warning gate triggered** → `NEEDS_REVIEW`
5. **Security score < 60** → `NEEDS_REVIEW`
6. **Overall score < 60** → `NEEDS_REVIEW`
7. **All pass** → `ALLOW`

---

## Scoring Criteria

### Security Layer

The Security layer evaluates technical security vulnerabilities and threats.

#### Factors and Weights (V1)

| Factor | Weight | Description |
|--------|--------|-------------|
| **SAST** | 0.30 | Static analysis findings (highest impact) |
| **VirusTotal** | 0.15 | Malware detection consensus |
| **Obfuscation** | 0.15 | Code obfuscation detection |
| **Manifest** | 0.10 | Manifest security configuration |
| **ChromeStats** | 0.10 | Behavioral threat intelligence |
| **Webstore** | 0.10 | Webstore reputation signals |
| **Maintenance** | 0.10 | Maintenance health (staleness) |

**Total:** 1.0

#### 1. SAST (Static Analysis)

**Normalizer:** `normalize_sast()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Excludes test files
- Deduplicates by (rule_id, file_path, line)
- Weights: CRITICAL/HIGH=4.0, MEDIUM/ERROR=2.0, WARNING=0.5, INFO=0.1
- `x = sum(weights)` after dedup
- `severity = 1 - exp(-0.08 × x)` (saturating exponential)
- `confidence = 1.0` if findings exist, `0.6` if analyzer missing, `0.8` if partial

**Severity Breakdown:**
- **CRITICAL** findings: weight 4.0
- **HIGH/ERROR** findings: weight 2.0
- **MEDIUM** findings: weight 2.0
- **WARNING** findings: weight 0.5
- **INFO/LOW** findings: weight 0.1

**Evidence IDs:** `sast:{check_id}:{file_path}`

#### 2. VirusTotal

**Normalizer:** `normalize_virustotal()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Malicious count mapping:
  - 0 → 0.0 severity
  - 1 → 0.3 severity
  - 2-4 → 0.6 severity
  - 5-9 → 0.8 severity
  - ≥10 → 1.0 severity
- Suspicious: +0.05 each (up to +0.2)
- Confidence: 1.0 if full scan (≥30 engines), 0.7 if partial, 0.4 if missing

**Evidence IDs:** `vt:detection:{malicious_count}`

**Flags:**
- `malware_detected` - If malicious_count > 0
- `high_detection_consensus` - If malicious_count ≥ 5

#### 3. Obfuscation

**Normalizer:** `normalize_entropy()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- `x = 2 × obfuscated_files + 1 × suspicious_files`
- `severity = 1 - exp(-0.2 × x)`
- Confidence adjustment for popularity:
  - Users ≥ 1M: confidence × 0.6 (popular = likely legitimate minification)
  - Users ≥ 100K: confidence × 0.7
  - Else: confidence = 0.9

**Note:** Popularity affects **confidence**, not severity. Popular extensions may use legitimate build tools (webpack, etc.).

**Evidence IDs:** `entropy:file:{file_path}`

**Flags:**
- `obfuscation_detected` - If obfuscated files found
- `high_risk_patterns` - If high-risk patterns detected

#### 4. Manifest Posture

**Normalizer:** `normalize_manifest_posture()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Missing CSP → +0.3 severity
- MV2 legacy (manifest_version < 3) → +0.2 severity
- Broad host permissions → +0.3 severity
- Cap at 1.0
- Confidence = 1.0 if manifest parsed

**Evidence IDs:** `manifest:issue:{issue_type}`

**Flags:**
- `missing_csp` - No Content Security Policy
- `mv2_legacy` - Using deprecated Manifest V2
- `broad_host_access` - Has `<all_urls>` or equivalent

#### 5. ChromeStats

**Normalizer:** `normalize_chromestats()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Uses pre-calculated risk score from ChromeStats
- `severity = 1 - exp(-0.1 × raw_score)`
- Confidence = 0.8 (generally reliable)

**Evidence IDs:** `chromestats:{indicator}`

**Flags:**
- `chromestats_high` - High risk level
- `chromestats_critical` - Critical risk level

#### 6. Webstore Trust

**Normalizer:** `normalize_webstore_trust()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Rating-based:
  - < 2.0 → +0.4 severity
  - < 3.0 → +0.3 severity
  - < 3.5 → +0.15 severity
  - Missing → +0.1 severity
- User count-based:
  - < 100 → +0.3 severity
  - < 1,000 → +0.2 severity
  - < 10,000 → +0.1 severity
  - Missing → +0.15 severity
- Missing privacy policy → +0.2 severity
- Cap at 1.0
- Confidence: 0.9 if both rating and users available, 0.6 if one, 0.3 if none

**Evidence IDs:** `webstore:issue:{issue_type}`

**Flags:**
- `very_low_rating` - Rating < 2.0
- `low_rating` - Rating < 3.0
- `very_low_users` - Users < 100
- `no_privacy_policy` - Missing privacy policy

#### 7. Maintenance Health

**Normalizer:** `normalize_maintenance_health()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Days since last update:
  - > 365 days → 0.8 severity
  - 180-365 days → 0.6 severity
  - 90-180 days → 0.4 severity
  - < 90 days → 0.1 severity
- Confidence: 0.9 if date available, 0.3 if missing

**Evidence IDs:** `maintenance:days:{days_since_update}`

**Flags:**
- `stale_extension` - Not updated in > 365 days
- `aging_extension` - Not updated in 180-365 days
- `needs_update` - Not updated in 90-180 days

---

### Privacy Layer

The Privacy layer evaluates data collection, permissions, and exfiltration risk.

#### Factors and Weights (V1)

| Factor | Weight | Description |
|--------|--------|-------------|
| **PermissionsBaseline** | 0.25 | Individual permission risk assessment |
| **PermissionCombos** | 0.25 | Dangerous permission combinations |
| **NetworkExfil** | 0.35 | Network exfiltration patterns (highest impact) |
| **CaptureSignals** | 0.15 | Screenshot/tab capture detection |

**Total:** 1.0

#### 1. Permissions Baseline

**Normalizer:** `normalize_permissions_baseline()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- `n = count(high_risk_permissions) + count(unreasonable_permissions)`
- `severity = 1 - exp(-0.25 × n)`
- Confidence = 1.0 if manifest parsed

**Evidence IDs:** `perm:high_risk:{permission_name}`

**Flags:**
- `high_risk_permissions` - If n ≥ 3

**High-Risk Permissions:**
- `cookies` - Can access all cookies
- `webRequest` - Can intercept/modify network requests
- `webRequestBlocking` - Can block network requests
- `history` - Can access browsing history
- `browsingData` - Can delete browsing data
- `clipboardRead` - Can read clipboard
- `tabs` - Can access all tabs
- `debugger` - Can attach debugger
- `nativeMessaging` - Can bypass browser sandbox

#### 2. Permission Combinations

**Normalizer:** `normalize_permission_combos()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Checks for dangerous combinations:
  - `cookies + webRequest` → +0.5 severity
  - `cookies + webRequestBlocking` → +0.6 severity
  - `clipboardRead + webRequest` → +0.4 severity
  - `clipboardRead + <all_urls>` → +0.4 severity
  - `debugger + tabs` → +0.7 severity
  - `nativeMessaging` → +0.7 severity
  - `debugger` alone → +0.5 severity
- Broad host access (`<all_urls>`) → +0.5 severity
- Cap at 1.0
- Confidence = 1.0 (deterministic)

**Evidence IDs:** `combo:{permission_combo}`

**Flags:**
- `dangerous_permission_combo` - If any combo triggered

#### 3. Network Exfiltration

**Normalizer:** `normalize_network_exfil()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Base risk for network access: +0.2
- Domain classification:
  - Known good (CDNs, Google APIs) → +0.1 per domain
  - Analytics (GA, Mixpanel, etc.) → +0.6 per domain
  - Unknown external → +0.5 per domain
- Suspicious patterns:
  - HTTP unencrypted → +0.2
  - Base64-encoded URLs → +0.3
  - High-entropy payload → +0.2
  - Dynamic URL construction → +0.2
  - Credential exfil pattern → +0.5
  - Data harvest pattern → +0.4
- Runtime URL construction → +0.3
- Data sending patterns → +0.15 each
- `severity = 1 - exp(-0.25 × D)` where D = sum of all risks
- Confidence from NetworkSignalPack (0.5 if no analysis)

**Evidence IDs:** `exfil:{pattern_type}`

**Flags:**
- `potential_exfiltration` - If severity > 0.4

**Known Good Domains:**
- `googleapis.com`, `google.com`, `gstatic.com`
- `cloudflare.com`, `cdnjs.cloudflare.com`
- `unpkg.com`, `jsdelivr.net`

**Analytics Domains:**
- `google-analytics.com`, `googletagmanager.com`
- `mixpanel.com`, `segment.io`, `amplitude.com`
- `hotjar.com`

#### 4. Capture Signals

**Normalizer:** `normalize_capture_signals()`  
**Location:** `src/extension_shield/scoring/normalizers.py`

**Formula:**
- Capture permissions: `tabCapture`, `desktopCapture`, `activeTab` → +0.2 each
- Screenshot detection from permissions analyzer → +0.3
- Context-aware adjustment:
  - **Disclosed screenshot tool** (name/desc contains "screenshot", "capture", etc.):
    - Severity × 0.3 (legitimate use case)
  - **Covert capture** (not disclosed):
    - Severity × 1.5 (concerning)
- Capture + network access → +0.3 severity
- Cap at 1.0
- Confidence = 0.9

**Evidence IDs:** `capture:{signal_type}`

**Flags:**
- `capture_capability` - If any capture signals found
- `disclosed_screenshot_tool` - Legitimate screenshot tool
- `covert_capture_capability` - Undisclosed capture
- `capture_with_network` - Capture + network access combo

---

### Governance Layer

The Governance layer evaluates policy compliance and organizational requirements.

#### Factors and Weights (V1)

| Factor | Weight | Description |
|--------|--------|-------------|
| **ToSViolations** | 0.50 | Terms of service violations (highest impact) |
| **Consistency** | 0.30 | Consistency between claimed and actual behavior |
| **DisclosureAlignment** | 0.20 | Privacy policy and disclosure alignment |

**Total:** 1.0

#### 1. ToS Violations

**Normalizer:** `_compute_governance_factors()` (ToS factor)  
**Location:** `src/extension_shield/scoring/engine.py`

**Formula:**
- Prohibited permissions: `debugger`, `proxy`, `nativeMessaging` → +0.5 each
- Broad host access + VirusTotal detection → +0.4 severity
- Cap at 1.0
- Confidence = 0.9

**Evidence IDs:** `tos:{violation_type}`

**Flags:**
- `prohibited_perm:{permission}` - Prohibited permission found
- `broad_access_with_vt_detection` - Broad access + malware detection

#### 2. Consistency

**Normalizer:** `_compute_governance_factors()` (Consistency factor)  
**Location:** `src/extension_shield/scoring/engine.py`

**Formula:**
- Checks if claimed purpose matches actual behavior
- Benign claims: "theme", "color", "font", "wallpaper", "new tab"
- If benign claimed + high security/privacy risk → 0.6 severity
- Offline claimed + network access → 0.4 severity
- Confidence = 0.8

**Evidence IDs:** `consistency:{flag}`

**Flags:**
- `benign_claim_risky_behavior` - Claims benign but has risky behavior
- `offline_claim_network_access` - Claims offline but has network access

#### 3. Disclosure Alignment

**Normalizer:** `_compute_governance_factors()` (Disclosure factor)  
**Location:** `src/extension_shield/scoring/engine.py`

**Formula:**
- Missing privacy policy + data collection → 0.5 severity
- Missing privacy policy + network access → 0.3 severity
- Confidence = 0.85

**Evidence IDs:** `disclosure:{flag}`

**Flags:**
- `no_privacy_policy_with_data_collection` - No policy but collects data
- `no_privacy_policy_with_network` - No policy but has network access

---

## Hard Gates

Hard gates can **BLOCK** or **WARN** regardless of computed scores. They are evaluated in priority order.

### Gate Priority Order

1. **VT_MALWARE** - VirusTotal malware detection
2. **CRITICAL_SAST** - Critical SAST findings
3. **TOS_VIOLATION** - Terms of Service violations
4. **PURPOSE_MISMATCH** - Claimed purpose vs actual behavior
5. **SENSITIVE_EXFIL** - Sensitive data exfiltration risk

### Gate Details

#### 1. VT_MALWARE

**Location:** `src/extension_shield/scoring/gates.py::evaluate_vt_malware()`

**Thresholds:**
- **≥5 malicious detections:** `BLOCK`
- **1-4 malicious detections:** `WARN`
- **0 malicious:** No gate (ALLOW)

**Confidence:**
- ≥50 engines: 0.98
- ≥30 engines: 0.95
- <30 engines: 0.85

**Reasons:**
- "VirusTotal detected malware: {count}/{total} engines flagged malicious"
- "Threat level: {threat_level}"

#### 2. CRITICAL_SAST

**Location:** `src/extension_shield/scoring/gates.py::evaluate_critical_sast()`

**Thresholds:**
- **≥1 CRITICAL finding:** `BLOCK`
- **≥3 HIGH/ERROR findings:** `BLOCK`
- Requires confidence ≥ 0.7

**Reasons:**
- "{count} critical SAST finding(s) detected"
- "{count} high-severity SAST finding(s) detected"

#### 3. TOS_VIOLATION

**Location:** `src/extension_shield/scoring/gates.py::evaluate_tos_violation()`

**Checks:**
- Prohibited permissions: `debugger`, `proxy`, `nativeMessaging`
- `externally_connectable` with wildcards (`<all_urls>`)

**Decision:** `BLOCK` if any violation found

**Confidence:** 0.95

**Reasons:**
- "Prohibited permission: {permission}"
- "externally_connectable allows all URLs"

#### 4. PURPOSE_MISMATCH

**Location:** `src/extension_shield/scoring/gates.py::evaluate_purpose_mismatch()`

**Checks:**
- Credential capture patterns in code (password, credential, login, keylog, etc.)
- Tracking patterns (track, analytics, beacon, pixel, fingerprint)
- Benign-claimed extension with concerning capabilities:
  - Network + clipboard access
  - Capture capabilities
  - Tracking patterns

**Decision:**
- **≥2 credential signals:** `BLOCK`
- **1 credential signal:** `WARN`
- **Benign + concerning capabilities:** `WARN`

**Confidence:** 0.8-0.85

**Reasons:**
- "Multiple credential capture patterns detected: {count}"
- "Credential capture pattern detected"
- "'{name}' claims benign purpose but has network + clipboard access"

#### 5. SENSITIVE_EXFIL

**Location:** `src/extension_shield/scoring/gates.py::evaluate_sensitive_exfil()`

**Checks:**
- Sensitive permissions: `cookies`, `webRequest`, `webRequestBlocking`, `history`, `browsingData`, `clipboardRead`, `tabs`
- Network access or network patterns in code
- Missing privacy policy

**Decision:** `WARN` if 2+ risk factors

**Risk Factors:**
1. Has sensitive permissions
2. Has network access or network patterns
3. Missing privacy policy

**Confidence:** 0.7

**Reasons:**
- "Sensitive permissions: {list}"
- "Has broad network access"
- "Network patterns in code: {count} findings"
- "Missing privacy policy"

---

## API Response Structure

### Main Results Endpoint

**Endpoint:** `GET /api/scan/results/{extension_id}`

**Response Structure:**
```json
{
  "extension_id": "oligonmocnihangdjlloenpndnniikol",
  "extension_name": "edpuzzle",
  "url": "https://chromewebstore.google.com/...",
  "timestamp": "2026-02-07T...",
  "status": "completed",
  
  // V2 Scoring (Primary)
  "security_score": 68,
  "privacy_score": 75,
  "governance_score": 80,
  "overall_score": 72,
  "overall_confidence": 0.85,
  "decision_v2": "NEEDS_REVIEW",
  "decision_reasons_v2": [
    "Overall score 72/100 below ALLOW threshold (60)"
  ],
  "overall_risk": "medium",
  
  // Full V2 Scoring Payload
  "scoring_v2": {
    "scoring_version": "v2",
    "weights_version": "v1",
    "security_score": 68,
    "privacy_score": 75,
    "governance_score": 80,
    "overall_score": 72,
    "overall_confidence": 0.85,
    "decision": "NEEDS_REVIEW",
    "decision_reasons": ["..."],
    "hard_gates_triggered": [],
    "risk_level": "medium",
    "explanation": "Overall: 72/100 (NEEDS_REVIEW) | Security: 68/100 | ...",
    
    // Layer Breakdowns (if available)
    "security_layer": {
      "layer_name": "security",
      "score": 68,
      "risk": 0.32,
      "risk_level": "medium",
      "confidence": 0.9,
      "factors": [
        {
          "name": "SAST",
          "severity": 0.45,
          "confidence": 1.0,
          "weight": 0.30,
          "contribution": 0.135,
          "risk_level": "medium",
          "flags": ["sast_issues_found"],
          "details": {
            "deduped_findings": 12,
            "severity_breakdown": {"HIGH": 2, "MEDIUM": 5, "WARNING": 5}
          }
        },
        // ... more factors
      ]
    },
    "privacy_layer": { /* ... */ },
    "governance_layer": { /* ... */ },
    
    // Explanation Payload
    "explanation": {
      "scan_id": "...",
      "extension_id": "...",
      "overall_score": 72,
      "decision": "NEEDS_REVIEW",
      "decision_rationale": "...",
      "layers": {
        "security": { /* ... */ },
        "privacy": { /* ... */ },
        "governance": { /* ... */ }
      },
      "hard_gates": {
        "total_gates": 5,
        "triggered_count": 0,
        "blocking_count": 0,
        "warning_count": 0
      }
    }
  },
  
  // Raw Analysis Results
  "permissions_analysis": { /* ... */ },
  "sast_results": { /* ... */ },
  "webstore_analysis": { /* ... */ },
  "virustotal_analysis": { /* ... */ },
  "entropy_analysis": { /* ... */ },
  "chromestats_analysis": { /* ... */ },
  
  // UI View Model
  "report_view_model": {
    "extension_name": "edpuzzle",
    "extension_id": "...",
    "overall_risk": "MEDIUM",
    "risk_score": 68,
    "permissions_summary": { /* ... */ },
    "capability_flags": [ /* ... */ ],
    "external_domains": [ /* ... */ ],
    "network_evidence": [ /* ... */ ]
  },
  
  // Governance Bundle (if available)
  "governance_bundle": {
    "signal_pack": { /* Layer 0 signals */ },
    "scoring_v2": { /* Same as above */ },
    "security_scorecard": { /* Legacy */ },
    "governance_scorecard": { /* Legacy */ },
    "decision": {
      "verdict": "NEEDS_REVIEW",
      "v2_decision": "NEEDS_REVIEW",
      "v2_overall_score": 72
    }
  }
}
```

### Key Fields for Frontend

**For Interactive Results Display:**

1. **Scores:**
   - `security_score`, `privacy_score`, `governance_score` (0-100)
   - `overall_score` (0-100)
   - `overall_confidence` (0-1)

2. **Decision:**
   - `decision_v2` ("ALLOW", "BLOCK", "NEEDS_REVIEW")
   - `decision_reasons_v2` (array of reason strings)
   - `overall_risk` ("critical", "high", "medium", "low", "none")

3. **Layer Breakdowns:**
   - `scoring_v2.security_layer.factors` - All security factors with severity, confidence, contribution
   - `scoring_v2.privacy_layer.factors` - All privacy factors
   - `scoring_v2.governance_layer.factors` - All governance factors

4. **Hard Gates:**
   - `scoring_v2.hard_gates_triggered` - List of triggered gate IDs
   - `scoring_v2.explanation.hard_gates` - Full gate summary

5. **Permissions:**
   - `permissions_analysis` - Detailed permission analysis
   - `report_view_model.permissions_summary` - UI-friendly summary

6. **SAST Findings:**
   - `sast_results` - Raw SAST findings
   - `scoring_v2.security_layer.factors` (SAST factor) - Normalized SAST score

7. **VirusTotal:**
   - `virustotal_analysis` - Raw VirusTotal results
   - `scoring_v2.security_layer.factors` (VirusTotal factor) - Normalized VT score

---

## Frontend Integration

### Recommended Data Structure for Results Page

For the interactive results page at `/scan/results/{extension_id}`, use the following structure:

```javascript
// Main scores (display prominently)
{
  overallScore: 72,
  overallRisk: "medium", // "critical" | "high" | "medium" | "low" | "none"
  decision: "NEEDS_REVIEW", // "ALLOW" | "BLOCK" | "NEEDS_REVIEW"
  decisionReasons: ["Overall score 72/100 below ALLOW threshold (60)"],
  confidence: 0.85,
  
  // Layer scores
  security: {
    score: 68,
    risk: "medium",
    factors: [
      {
        name: "SAST",
        severity: 0.45, // 0-1
        confidence: 1.0, // 0-1
        contribution: 0.135, // weighted contribution
        riskLevel: "medium",
        flags: ["sast_issues_found"],
        details: {
          dedupedFindings: 12,
          severityBreakdown: { HIGH: 2, MEDIUM: 5, WARNING: 5 }
        }
      },
      // ... more factors
    ]
  },
  
  privacy: {
    score: 75,
    risk: "medium",
    factors: [ /* ... */ ]
  },
  
  governance: {
    score: 80,
    risk: "low",
    factors: [ /* ... */ ]
  },
  
  // Hard gates
  hardGates: {
    triggered: false,
    triggeredGates: [],
    blockingCount: 0,
    warningCount: 0
  },
  
  // Permissions breakdown
  permissions: {
    highRisk: 1,
    potentiallyUnreasonable: 1,
    broadHostAccess: 1,
    apiPermissions: 5,
    // ... from permissions_analysis
  }
}
```

### Key UI Components to Display

1. **Risk Meter** - Circular gauge showing overall score (0-100)
2. **Layer Scores** - Three cards showing Security, Privacy, Governance scores
3. **Decision Badge** - ALLOW (green), NEEDS_REVIEW (orange), BLOCK (red)
4. **Top Risk Factors** - List of top contributing factors (sorted by contribution)
5. **Permissions Breakdown** - Counts of high-risk, unreasonable, broad access permissions
6. **SAST Findings** - Summary of static analysis findings
7. **VirusTotal Status** - Malware detection status
8. **Hard Gates** - If any gates triggered, show which ones and why

### Example: Extracting Data from API Response

```javascript
function formatResultsForUI(apiResponse) {
  const scoring = apiResponse.scoring_v2;
  
  return {
    overallScore: scoring.overall_score,
    overallRisk: scoring.risk_level,
    decision: scoring.decision,
    decisionReasons: scoring.decision_reasons,
    confidence: scoring.overall_confidence,
    
    security: {
      score: scoring.security_score,
      risk: scoring.security_layer?.risk_level || "unknown",
      factors: scoring.security_layer?.factors || []
    },
    
    privacy: {
      score: scoring.privacy_score,
      risk: scoring.privacy_layer?.risk_level || "unknown",
      factors: scoring.privacy_layer?.factors || []
    },
    
    governance: {
      score: scoring.governance_score,
      risk: scoring.governance_layer?.risk_level || "unknown",
      factors: scoring.governance_layer?.factors || []
    },
    
    hardGates: {
      triggered: scoring.hard_gates_triggered.length > 0,
      triggeredGates: scoring.hard_gates_triggered,
      ...scoring.explanation?.hard_gates
    },
    
    permissions: extractPermissionsSummary(apiResponse.permissions_analysis)
  };
}
```

---

## Summary

This documentation covers:

1. ✅ **Complete pipeline flow** - From extension download to final decision
2. ✅ **All scoring functions** - Every normalizer and factor calculation
3. ✅ **All scoring criteria** - Detailed formulas and thresholds
4. ✅ **Hard gates** - All 5 gates with their logic
5. ✅ **API response structure** - What data is available for frontend
6. ✅ **Frontend integration guide** - How to display results interactively

The scoring engine is the **single source of truth** for extension risk assessment. All scores are explainable with factor-level breakdowns, confidence values, and evidence links.

For questions or clarifications, refer to:
- `src/extension_shield/scoring/engine.py` - Main scoring engine
- `src/extension_shield/scoring/normalizers.py` - All normalizer functions
- `src/extension_shield/scoring/gates.py` - Hard gate logic
- `src/extension_shield/governance/signal_pack.py` - Signal pack structure

