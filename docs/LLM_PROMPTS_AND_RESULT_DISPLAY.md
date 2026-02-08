# LLM Prompts and Result Display Documentation

## Table of Contents

1. [Overview](#overview)
2. [LLM Prompt Architecture](#llm-prompt-architecture)
3. [All LLM Prompts](#all-llm-prompts)
4. [Result Display Pipeline](#result-display-pipeline)
5. [Data Flow](#data-flow)
6. [Frontend Integration](#frontend-integration)

---

## Overview

ExtensionShield uses **6 LLM prompts** to generate human-readable summaries and analysis from technical scan data. All prompts use structured JSON output with strict schemas and are integrated into the extension analysis workflow.

### LLM Usage Summary

| Prompt | Version | Output Format | Used By | Location |
|--------|---------|---------------|---------|----------|
| **Summary Generation** | v4 | JSON | `SummaryGenerator` | `src/extension_shield/core/summary_generator.py` |
| **Impact Analysis** | v2.1 | JSON | `ImpactAnalyzer` | `src/extension_shield/core/impact_analyzer.py` |
| **Privacy Compliance** | v1.1 | JSON | `PrivacyComplianceAnalyzer` | `src/extension_shield/core/privacy_compliance_analyzer.py` |
| **Permission Analysis** | v1 | JSON | `PermissionsAnalyzer` | `src/extension_shield/core/analyzers/permissions.py` |
| **Webstore Analysis** | v1 | JSON | `WebstoreAnalyzer` | `src/extension_shield/core/analyzers/webstore.py` |
| **SAST Analysis** | v1 | Text | `JavaScriptAnalyzer` | `src/extension_shield/core/analyzers/sast.py` |

---

## LLM Prompt Architecture

### Prompt Storage

All prompts are stored as YAML files in:
```
src/extension_shield/llm/prompts/
├── summary_generation.yaml
├── impact_analysis.yaml
├── privacy_compliance.yaml
├── permission_analysis.yaml
├── webstore_analysis.yaml
└── sast_analysis.yaml
```

### Prompt Loading

Prompts are loaded via `get_prompts()` function:
```python
from extension_shield.llm.prompts import get_prompts

template_str = get_prompts("summary_generation")
```

### LLM Provider Chain

All LLM calls use a fallback chain via `invoke_with_fallback()`:
```python
from extension_shield.llm.clients.fallback import invoke_with_fallback

response = invoke_with_fallback(
    messages=messages,
    model_name=model_name,
    model_parameters={"temperature": 0.05, "max_tokens": 4096},
)
```

**Fallback Order:**
1. Primary provider (from `LLM_MODEL` env var)
2. Fallback providers (from `LLM_FALLBACK_CHAIN` env var)
3. Deterministic fallback (no LLM, uses capability flags)

---

## All LLM Prompts

### 1. Summary Generation (v4)

**File:** `src/extension_shield/llm/prompts/summary_generation.yaml`  
**Generator:** `SummaryGenerator.generate()`  
**Workflow Node:** `summary_generation_node()`

#### Prompt Structure

```yaml
name: summary_generation
version: 4
output_format: json

system: |
  You are ExtensionShield generating a report summary that MUST match the provided risk label AND the provided host access scope.
  Rules:
  - If score_label is LOW RISK, do NOT say "high risk" or "critical risk".
  - Do not invent facts. Only use provided inputs.
  - Host access scope is authoritative:
    - If host_scope_label is ALL_WEBSITES, you MUST NOT claim "limited to specific domains".
    - If host_scope_label is SINGLE_DOMAIN or MULTI_DOMAIN, you MAY say "limited".
  - Use calm, factual language.
  - Output ONLY valid JSON.

user: |
  Source of truth (do not override):
  - score: {{ score }}
  - score_label: {{ score_label }}   # LOW RISK / MEDIUM RISK / HIGH RISK

  Host access (authoritative):
  {{ host_access_summary_json }}

  Manifest:
  {{ manifest_json }}

  Analyzer outputs:
  - permissions_summary: {{ permissions_summary_json }}
  - webstore: {{ webstore_result_json }}
  - sast: {{ sast_result_json }}

  Output:
  - one_liner: 1 sentence
  - why_this_score: exactly 3 short bullets
  - what_to_watch: up to 2 short bullets (host_scope_label ALL_WEBSITES must be mentioned here)
  - confidence: LOW/MEDIUM/HIGH
```

#### Input Variables

1. **`score`** (int): Overall security score [0-100] from `ScoringEngine`
2. **`score_label`** (str): Risk label - `"LOW RISK"`, `"MEDIUM RISK"`, or `"HIGH RISK"`
3. **`host_access_summary_json`** (str): Authoritative host access scope summary
4. **`manifest_json`** (str): Full manifest.json as formatted JSON
5. **`permissions_summary_json`** (str): Permissions analysis results as JSON
6. **`webstore_result_json`** (str): WebStore reputation analysis as JSON
7. **`sast_result_json`** (str): SAST analysis results as JSON

#### Output Schema

```json
{
  "one_liner": "string",
  "why_this_score": ["string", "string", "string"],  // exactly 3
  "what_to_watch": ["string", "string"],  // 0-2 items
  "confidence": "LOW" | "MEDIUM" | "HIGH"
}
```

#### Usage in Code

```python
from extension_shield.core.summary_generator import SummaryGenerator

generator = SummaryGenerator()
summary = generator.generate(
    analysis_results=analysis_results,
    manifest=manifest,
    metadata=metadata,
    scan_id=scan_id,
    extension_id=extension_id,
)
```

#### Display Location

- **Frontend:** `report_view_model.scorecard.one_liner`
- **Frontend:** `report_view_model.highlights.why_this_score` (3 bullets)
- **Frontend:** `report_view_model.highlights.what_to_watch` (0-2 bullets)

---

### 2. Impact Analysis (v2.1)

**File:** `src/extension_shield/llm/prompts/impact_analysis.yaml`  
**Generator:** `ImpactAnalyzer.generate()`  
**Workflow Node:** `impact_analysis_node()`

#### Prompt Structure

```yaml
name: impact_analysis
version: 2.1
output_format: json

system: |
  You are ExtensionShield. Translate capabilities into user impact.
  Rules:
  - Use ONLY provided inputs.
  - If something is only a capability, use "could" / "may".
  - Never claim malicious intent.
  - Bullets must be specific and <= 12 words.
  - If inputs are missing/empty, use UNKNOWN and empty lists.
  - Do NOT mention cookies unless capability_flags indicate cookie access.
  - Do NOT mention history unless capability_flags indicate history access.
  - Do NOT mention script injection/page modification unless capability_flags indicate it.
  - For external_sharing:
    - If has_external_domains is false AND network_evidence is empty, set risk_level UNKNOWN and keep bullets empty.
  - Output ONLY valid JSON.

user: |
  Extension:
  - id: {{ extension_id }}
  - name: {{ extension_name }}
  - description: {{ extension_description }}

  Authoritative scope:
  {{ host_access_summary_json }}

  Capability flags (authoritative booleans):
  {{ capability_flags_json }}

  Optional evidence (may be empty):
  - external_domains: {{ external_domains_json }}
  - network_evidence: {{ network_evidence_json }}
  - content_scripts: {{ content_scripts_json }}
  - web_accessible_resources: {{ web_accessible_resources_json }}

  Create 3 buckets:
  1) data_access: what it could read
  2) browser_control: what it could change/control
  3) external_sharing: where data could be sent

  For each bucket:
  - risk_level: LOW/MEDIUM/HIGH/UNKNOWN (based on capability_flags)
  - bullets: 0-3 bullets, <= 12 words
  - mitigations: 0-2 bullets, <= 12 words
```

#### Input Variables

1. **`extension_id`** (str): Extension identifier
2. **`extension_name`** (str): Extension name from manifest
3. **`extension_description`** (str): Extension description
4. **`host_access_summary_json`** (str): Host access scope classification
5. **`capability_flags_json`** (str): Deterministic capability flags (authoritative booleans)
6. **`external_domains_json`** (str): List of external domains (optional)
7. **`network_evidence_json`** (str): Network-related evidence from SAST (optional)
8. **`content_scripts_json`** (str): Content scripts from manifest (optional)
9. **`web_accessible_resources_json`** (str): Web accessible resources (optional)

#### Output Schema

```json
{
  "data_access": {
    "risk_level": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
    "bullets": ["string", ...],  // 0-3 items, <= 12 words each
    "mitigations": ["string", ...]  // 0-2 items, <= 12 words each
  },
  "browser_control": {
    "risk_level": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
    "bullets": ["string", ...],
    "mitigations": ["string", ...]
  },
  "external_sharing": {
    "risk_level": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
    "bullets": ["string", ...],
    "mitigations": ["string", ...]
  }
}
```

#### Capability Flags

The prompt receives deterministic capability flags computed from manifest and analysis:

```python
{
  # Data access
  "can_read_all_sites": bool,
  "can_read_specific_sites": bool,
  "can_read_page_content": bool,
  "can_read_cookies": bool,
  "can_read_history": bool,
  "can_read_clipboard": bool,
  "can_read_downloads": bool,
  "can_read_tabs": bool,
  "can_capture_screenshots": bool,
  
  # Browser control
  "can_modify_page_content": bool,
  "can_inject_scripts": bool,
  "can_block_or_modify_network": bool,
  "can_manage_extensions": bool,
  "can_control_proxy": bool,
  "can_debugger": bool,
  
  # External sharing
  "can_connect_external_domains": bool,
  "has_external_domains": bool,
  "has_externally_connectable": bool,
  "has_web_accessible_resources": bool,
}
```

#### Usage in Code

```python
from extension_shield.core.impact_analyzer import ImpactAnalyzer

analyzer = ImpactAnalyzer()
impact = analyzer.generate(
    analysis_results=analysis_results,
    manifest=manifest,
    extension_id=extension_id,
)
```

#### Display Location

- **Frontend:** `report_view_model.impact_cards[]` - Array of 3 cards:
  - `data_access` → "Data Access" card
  - `browser_control` → "Browser Control" card
  - `external_sharing` → "External Sharing" card

Each card displays:
- Risk level badge
- Bullets (0-3 items)
- Mitigations (0-2 items)

---

### 3. Privacy Compliance (v1.1)

**File:** `src/extension_shield/llm/prompts/privacy_compliance.yaml`  
**Generator:** `PrivacyComplianceAnalyzer.generate()`  
**Workflow Node:** `privacy_compliance_node()`

#### Prompt Structure

```yaml
name: privacy_compliance
version: 1.1
output_format: json

system: |
  You are ExtensionShield producing a privacy + compliance snapshot.
  Rules:
  - Do NOT claim actual data collection or sharing unless evidence is explicitly provided.
  - Use "could/may" when capability-based.
  - Keep it concise, user-facing, and non-alarmist.
  - Do NOT claim external sharing unless external_domains or network_evidence is non-empty.
  - Prefer UNKNOWN over guessing.
  - If host_scope_label is ALL_WEBSITES, governance_checks must include a WARN about broad access.
  - Output ONLY valid JSON.

user: |
  Authoritative scope:
  {{ host_access_summary_json }}

  Capability flags (authoritative booleans):
  {{ capability_flags_json }}

  Optional evidence (may be empty):
  - external_domains: {{ external_domains_json }}
  - network_evidence: {{ network_evidence_json }}
  - storage_usage: {{ storage_usage_json }}
  - cookies_usage: {{ cookies_usage_json }}

  Store / publisher metadata (may be empty):
  {{ webstore_metadata_json }}

  Produce:
  1) privacy_snapshot: 1 sentence summary
  2) data_categories: up to 6 categories this extension could access (capability-based)
  3) governance_checks: 4-6 checks with PASS/WARN/FAIL/UNKNOWN
  4) compliance_notes: up to 4 framework notes (GDPR/CCPA/SOC2 readiness), capability-based
```

#### Input Variables

1. **`host_access_summary_json`** (str): Host access scope classification
2. **`capability_flags_json`** (str): Deterministic capability flags
3. **`external_domains_json`** (str): External domains (optional)
4. **`network_evidence_json`** (str): Network evidence (optional)
5. **`storage_usage_json`** (str): Storage API usage scan results (optional)
6. **`cookies_usage_json`** (str): Cookies API usage scan results (optional)
7. **`webstore_metadata_json`** (str): Webstore metadata (optional)

#### Output Schema

```json
{
  "privacy_snapshot": "string",  // 1 sentence
  "data_categories": ["string", ...],  // max 6
  "governance_checks": [
    {
      "check": "string",
      "status": "PASS" | "WARN" | "FAIL" | "UNKNOWN",
      "note": "string"
    },
    ...
  ],  // 4-6 items
  "compliance_notes": [
    {
      "framework": "string",  // e.g., "GDPR", "CCPA", "SOC2"
      "status": "PASS" | "WARN" | "FAIL" | "UNKNOWN",
      "note": "string"
    },
    ...
  ]  // max 4 items
}
```

#### Usage in Code

```python
from extension_shield.core.privacy_compliance_analyzer import PrivacyComplianceAnalyzer

analyzer = PrivacyComplianceAnalyzer()
privacy = analyzer.generate(
    analysis_results=analysis_results,
    manifest=manifest,
    extension_dir=extension_dir,
    webstore_metadata=metadata,
)
```

#### Display Location

- **Frontend:** `report_view_model.privacy_snapshot.privacy_snapshot` - 1 sentence summary
- **Frontend:** `report_view_model.privacy_snapshot.data_categories[]` - List of data categories
- **Frontend:** `report_view_model.privacy_snapshot.governance_checks[]` - Array of checks with status badges
- **Frontend:** `report_view_model.privacy_snapshot.compliance_notes[]` - Array of compliance framework notes

---

### 4. Permission Analysis (v1)

**File:** `src/extension_shield/llm/prompts/permission_analysis.yaml`  
**Generator:** `PermissionsAnalyzer.analyze()` (per-permission)  
**Workflow Node:** `extension_analyzer_node()`

#### Prompt Structure

```yaml
permission_analysis: |
  You are a cybersecurity expert specializing in browser extension security analysis.
  Your task is to evaluate whether a specific permission request is justified for the given chrome extension.

  <chrome_extension>
    <name>{extension_name}</name>
    <description>{extension_description}</description>
  </chrome_extension>

  <permission_requested>
    <name>{permission_name}</name>
    <description>{permission_description}</description>
    <capabilities>{permission_capabilities}</capabilities>
  </permission_requested>

  You MUST respond with a valid JSON object with the following structure:
  {
    "permission_name": "<name of the permission requested>",
    "justification_reasoning": "Brief explanation of why the permission is or isn't justified",
    "is_reasonable": <true|false>,
  }

  Your response must be valid JSON only, no markdown, no additional text.
```

#### Input Variables

1. **`extension_name`** (str): Extension name from manifest
2. **`extension_description`** (str): Extension description
3. **`permission_name`** (str): Permission name (e.g., "cookies", "webRequest")
4. **`permission_description`** (str): Permission description from permissions DB
5. **`permission_capabilities`** (str): What the permission allows

#### Output Schema

```json
{
  "permission_name": "string",
  "justification_reasoning": "string",
  "is_reasonable": true | false
}
```

#### Usage in Code

```python
from extension_shield.core.analyzers.permissions import PermissionsAnalyzer

analyzer = PermissionsAnalyzer()
permissions_analysis = analyzer.analyze(
    extension_dir=extension_dir,
    manifest=manifest,
)
```

#### Display Location

- **Frontend:** `permissions_analysis.permissions_details[permission_name]` - Per-permission analysis
- Used to identify "unreasonable permissions" in the UI

---

### 5. Webstore Analysis (v1)

**File:** `src/extension_shield/llm/prompts/webstore_analysis.yaml`  
**Generator:** `WebstoreAnalyzer.analyze()`  
**Workflow Node:** `extension_analyzer_node()`

#### Prompt Structure

```yaml
webstore_analysis: |
  You are a cybersecurity expert specializing in browser extension security analysis.
  Your task is to evaluate the reputation risk of a Chrome extension based on its Chrome Web Store metadata.

  <chrome_extension_metadata>
    <name>{extension_name}</name>
    <category>{category}</category>
    <user_count>{user_count}</user_count>
    <rating>{rating}</rating>
    <ratings_count>{ratings_count}</ratings_count>
    <last_updated>{last_updated}</last_updated>
    <version>{version}</version>
    <developer_name>{developer_name}</developer_name>
    <developer_email>{developer_email}</developer_email>
    <developer_website>{developer_website}</developer_website>
    <follows_best_practices>{follows_best_practices}</follows_best_practices>
    <is_featured>{is_featured}</is_featured>
    <has_privacy_policy>{has_privacy_policy}</has_privacy_policy>
  </chrome_extension_metadata>

  <detected_red_flags>
    {red_flags}
  </detected_red_flags>

  Based on the metadata and detected red flags, evaluate the reputation risk level of this extension.

  Guidelines for risk_level:
  - **low**: No significant red flags, or red flags have clear legitimate explanations
  - **medium**: Some concerning patterns (e.g., missing developer info OR low adoption OR few reviews)
  - **high**: Multiple concerning patterns together or critical single issues

  You MUST respond with a valid JSON object with the following structure:
  {
    "risk_summary": "A 2-3 sentence explanation of the overall reputation risk",
    "risk_level": "low|medium|high",
  }

  Your response must be valid JSON only, no markdown, no additional text.
```

#### Input Variables

1. **`extension_name`** (str): Extension name
2. **`category`** (str): Extension category
3. **`user_count`** (str): Number of users
4. **`rating`** (str): Average rating
5. **`ratings_count`** (str): Number of ratings
6. **`last_updated`** (str): Last update date
7. **`version`** (str): Extension version
8. **`developer_name`** (str): Developer name
9. **`developer_email`** (str): Developer email
10. **`developer_website`** (str): Developer website
11. **`follows_best_practices`** (str): Best practices badge
12. **`is_featured`** (str): Featured badge
13. **`has_privacy_policy`** (str): Privacy policy presence
14. **`red_flags`** (str): Detected red flags from heuristics

#### Output Schema

```json
{
  "risk_summary": "string",  // 2-3 sentences
  "risk_level": "low" | "medium" | "high"
}
```

#### Usage in Code

```python
from extension_shield.core.analyzers.webstore import WebstoreAnalyzer

analyzer = WebstoreAnalyzer()
webstore_analysis = analyzer.analyze(
    extension_dir=extension_dir,
    manifest=manifest,
    metadata=metadata,
)
```

#### Display Location

- **Frontend:** `webstore_analysis.risk_summary` - Text summary
- **Frontend:** `webstore_analysis.risk_level` - Risk level badge
- Used in summary generation prompt as input

---

### 6. SAST Analysis (v1)

**File:** `src/extension_shield/llm/prompts/sast_analysis.yaml`  
**Generator:** `JavaScriptAnalyzer.analyze()`  
**Workflow Node:** `extension_analyzer_node()`

#### Prompt Structure

```yaml
sast_analysis_prompt: |
  Analyze SAST (Semgrep) security findings from a Chrome extension's JavaScript files.

  Extension: {extension_name}
  Files Scanned: {files_scanned}
  Files with Findings: {files_with_findings}

  Findings by Severity:
  - CRITICAL: {critical_count}
  - ERROR: {error_count}
  - WARNING: {warning_count}
  - INFO: {info_count}

  Top Findings:
  {findings_details}

  Provide a concise security risk summary (2-4 sentences).
  Start with risk level in this exact format: [RISK: LOW/MEDIUM/HIGH]
  Then summarize the key security findings and their implications.

  Risk Level Guidelines:
  - LOW: Only INFO findings, no security impact
  - MEDIUM: WARNING findings indicating potential security issues
  - HIGH: ERROR or CRITICAL findings indicating exploitable vulnerabilities

  Focus on actionable security insights, not just listing findings.
```

#### Input Variables

1. **`extension_name`** (str): Extension name
2. **`files_scanned`** (int): Number of files scanned
3. **`files_with_findings`** (int): Number of files with findings
4. **`critical_count`** (int): Number of CRITICAL findings
5. **`error_count`** (int): Number of ERROR findings
6. **`warning_count`** (int): Number of WARNING findings
7. **`info_count`** (int): Number of INFO findings
8. **`findings_details`** (str): Formatted top findings (file, line, severity, category)

#### Output Format

**Freeform text** (not JSON), starting with `[RISK: LOW/MEDIUM/HIGH]`

Example:
```
[RISK: MEDIUM]
Found 12 security findings across 5 files. Most concerning are 2 HIGH severity issues related to insecure data handling in background.js. The extension uses eval() which could allow code injection. Review and sanitize user inputs before processing.
```

#### Usage in Code

```python
from extension_shield.core.analyzers.sast import JavaScriptAnalyzer

analyzer = JavaScriptAnalyzer()
sast_analysis = analyzer.analyze(
    extension_dir=extension_dir,
    manifest=manifest,
)
```

#### Display Location

- **Frontend:** `javascript_analysis.sast_analysis` - Text summary
- Used in summary generation prompt as input
- Risk level is parsed from `[RISK: ...]` tag for governance facts

---

## Result Display Pipeline

### Backend → Frontend Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Backend: Workflow Execution                                 │
│                                                             │
│ 1. Extension Analysis                                       │
│    → PermissionsAnalyzer (uses permission_analysis prompt) │
│    → WebstoreAnalyzer (uses webstore_analysis prompt)       │
│    → JavaScriptAnalyzer (uses sast_analysis prompt)        │
│                                                             │
│ 2. LLM Generation                                            │
│    → SummaryGenerator (uses summary_generation prompt)      │
│    → ImpactAnalyzer (uses impact_analysis prompt)           │
│    → PrivacyComplianceAnalyzer (uses privacy_compliance)    │
│                                                             │
│ 3. Report View Model                                        │
│    → build_report_view_model()                              │
│    → Combines LLM outputs + scoring + evidence              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ API Response: /api/scan/results/{extension_id}              │
│                                                             │
│ {                                                           │
│   "report_view_model": {                                    │
│     "scorecard": { ... },                                   │
│     "highlights": { ... },                                  │
│     "impact_cards": [ ... ],                                │
│     "privacy_snapshot": { ... },                            │
│     "evidence": { ... }                                     │
│   },                                                        │
│   "scoring_v2": { ... },                                    │
│   "permissions_analysis": { ... },                          │
│   ...                                                       │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: normalizeScanResult()                            │
│                                                             │
│ → Extracts scoring_v2 data                                  │
│ → Builds ReportViewModel                                    │
│ → Maps LLM outputs to UI components                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend: ScanResultsPageV2                                 │
│                                                             │
│ → Displays RiskDial (overall score)                         │
│ → Displays ReportScoreCard (one_liner)                      │
│ → Displays WhyThisScore (3 bullets)                         │
│ → Displays ImpactCards (3 cards)                            │
│ → Displays PrivacySnapshot (governance checks)               │
│ → Displays PermissionsPanel                                  │
│ → Displays KeyFindings (from scoring_v2 factors)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. LLM Outputs → report_view_model

**Location:** `src/extension_shield/core/report_view_model.py::build_report_view_model()`

```python
# Executive Summary (from summary_generation prompt)
executive_summary = SummaryGenerator().generate(...)
report_view_model = {
    "scorecard": {
        "one_liner": executive_summary.get("one_liner"),
        "confidence": executive_summary.get("confidence"),
    },
    "highlights": {
        "why_this_score": executive_summary.get("why_this_score"),  # 3 bullets
        "what_to_watch": executive_summary.get("what_to_watch"),      # 0-2 bullets
    },
    # ...
}

# Impact Analysis (from impact_analysis prompt)
impact_analysis = ImpactAnalyzer().generate(...)
report_view_model["impact_cards"] = [
    {
        "id": "data_access",
        "risk_level": impact_analysis["data_access"]["risk_level"],
        "bullets": impact_analysis["data_access"]["bullets"],
        "mitigations": impact_analysis["data_access"]["mitigations"],
    },
    # ... browser_control, external_sharing
]

# Privacy Compliance (from privacy_compliance prompt)
privacy_compliance = PrivacyComplianceAnalyzer().generate(...)
report_view_model["privacy_snapshot"] = {
    "privacy_snapshot": privacy_compliance["privacy_snapshot"],
    "data_categories": privacy_compliance["data_categories"],
    "governance_checks": privacy_compliance["governance_checks"],
    "compliance_notes": privacy_compliance["compliance_notes"],
}
```

### 2. report_view_model → Frontend Normalization

**Location:** `frontend/src/utils/normalizeScanResult.ts`

```typescript
// Extract from report_view_model
const reportViewModel = raw.report_view_model;

// Map to ReportViewModel
const viewModel: ReportViewModel = {
  meta: { ... },
  scores: { ... },  // From scoring_v2
  factorsByLayer: { ... },  // From scoring_v2
  keyFindings: buildKeyFindings(scoringV2, raw),
  permissions: buildPermissions(raw),
  evidenceIndex: buildEvidenceIndex(raw),
};
```

### 3. Frontend Display Components

**Location:** `frontend/src/pages/scanner/ScanResultsPageV2.jsx`

```jsx
// Executive Summary
<ReportScoreCard
  oneLiner={reportViewModel?.scorecard?.one_liner}
  confidence={reportViewModel?.scorecard?.confidence}
/>

// Why This Score (3 bullets)
<WhyThisScore
  bullets={reportViewModel?.highlights?.why_this_score}
/>

// Impact Cards (3 cards)
{reportViewModel?.impact_cards?.map(card => (
  <ImpactCard
    title={card.title}
    riskLevel={card.risk_level}
    bullets={card.bullets}
    mitigations={card.mitigations}
  />
))}

// Privacy Snapshot
<PrivacySnapshot
  snapshot={reportViewModel?.privacy_snapshot?.privacy_snapshot}
  dataCategories={reportViewModel?.privacy_snapshot?.data_categories}
  governanceChecks={reportViewModel?.privacy_snapshot?.governance_checks}
  complianceNotes={reportViewModel?.privacy_snapshot?.compliance_notes}
/>
```

---

## Frontend Integration

### Component Mapping

| LLM Output | Frontend Component | Location |
|------------|-------------------|----------|
| `summary_generation.one_liner` | `ReportScoreCard` | Top of results page |
| `summary_generation.why_this_score` | `WhyThisScore` | 3 bullets below scorecard |
| `summary_generation.what_to_watch` | `WhyThisScore` | 0-2 bullets in "What to Watch" section |
| `impact_analysis.data_access` | `ImpactCard` | "Data Access" card |
| `impact_analysis.browser_control` | `ImpactCard` | "Browser Control" card |
| `impact_analysis.external_sharing` | `ImpactCard` | "External Sharing" card |
| `privacy_compliance.privacy_snapshot` | `PrivacySnapshot` | Privacy section |
| `privacy_compliance.data_categories` | `PrivacySnapshot` | Data categories list |
| `privacy_compliance.governance_checks` | `PrivacySnapshot` | Governance checks table |
| `privacy_compliance.compliance_notes` | `PrivacySnapshot` | Compliance framework notes |

### Key Frontend Files

1. **Results Page:**
   - `frontend/src/pages/scanner/ScanResultsPageV2.jsx` - Main results page
   - `frontend/src/pages/scanner/ScanResultsPageV2.scss` - Styling

2. **Components:**
   - `frontend/src/components/report/ReportScoreCard.jsx` - Scorecard with one_liner
   - `frontend/src/components/report/WhyThisScore.jsx` - Why this score bullets
   - `frontend/src/components/report/ImpactCard.jsx` - Impact buckets
   - `frontend/src/components/report/PrivacySnapshot.jsx` - Privacy/compliance section

3. **Data Normalization:**
   - `frontend/src/utils/normalizeScanResult.ts` - Maps API response to UI model
   - `frontend/src/utils/reportTypes.ts` - TypeScript types

### Fallback Behavior

All LLM generators have **deterministic fallbacks** that use capability flags when LLM is unavailable:

1. **Summary Generator:** `_fallback_executive_summary()` - Uses score + host scope
2. **Impact Analyzer:** `_fallback_impact_from_capability_flags()` - Uses capability flags
3. **Privacy Compliance:** `_fallback_result()` - Uses capability flags + evidence

This ensures the UI always has data to display, even if LLM calls fail.

---

## Summary

This documentation covers:

1. ✅ **All 6 LLM prompts** - Complete prompt structures, inputs, and outputs
2. ✅ **Result display pipeline** - How LLM outputs flow to the frontend
3. ✅ **Data flow** - Backend → API → Frontend normalization → UI components
4. ✅ **Frontend integration** - Component mapping and file locations
5. ✅ **Fallback behavior** - Deterministic fallbacks when LLM is unavailable

All prompts use structured JSON output (except SAST which uses freeform text with `[RISK: ...]` tags) and are designed to be deterministic and evidence-based, avoiding speculation or false claims.

