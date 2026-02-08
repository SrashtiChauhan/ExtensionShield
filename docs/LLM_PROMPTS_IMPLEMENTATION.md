# LLM Prompts Implementation Report

## Overview

This document details the implementation of three LLM-powered analysis prompts for ExtensionShield:
1. **Summary Generation (v4)** - Executive summary aligned to score + host access scope
2. **Impact Analysis (v2)** - User-facing impact buckets driven by capability flags
3. **Privacy + Compliance (v1)** - Privacy/governance snapshot driven by scope + capability flags + evidence

All prompts use structured JSON output with strict schemas and are integrated into the extension analysis workflow.

---

## 1. Summary Generation Prompt (v4)

### Location
- **Prompt File**: `src/extension_shield/llm/prompts/summary_generation.yaml`
- **Generator**: `src/extension_shield/core/summary_generator.py`
- **Workflow Integration**: `src/extension_shield/workflow/nodes.py` → `summary_generation_node()`

### Prompt Structure

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
```

### Input Variables (Jinja2 Template)

The prompt receives the following context:

1. **`score`** (int): Overall security score [0-100] from `ScoringEngine`
2. **`score_label`** (str): Risk label - `"LOW RISK"`, `"MEDIUM RISK"`, or `"HIGH RISK"`
3. **`host_access_summary_json`** (str): Authoritative host access scope summary
4. **`manifest_json`** (str): Full manifest.json as formatted JSON
5. **`permissions_summary_json`** (str): Permissions analysis results as JSON
6. **`webstore_result_json`** (str): WebStore reputation analysis as JSON
7. **`sast_result_json`** (str): SAST/JavaScript analysis findings as JSON

### Host Access Scope Computation

`host_access_summary_json` is computed deterministically from manifest host permissions:

- **`host_scope_label`**: `ALL_WEBSITES` | `MULTI_DOMAIN` | `SINGLE_DOMAIN` | `NONE`
- **`patterns_count`**: Total number of host permission patterns
- **`domains`**: Top 10 unique domains (if applicable)
- **`has_all_urls`**: `true` only if `<all_urls>` is explicitly present

This field is treated as authoritative in the prompt to prevent hallucinated scope claims.

### Output Schema

```json
{
  "one_liner": "string - 1 sentence executive summary",
  "why_this_score": [
    "string - exactly 3 bullets explaining the score",
    "string",
    "string"
  ],
  "what_to_watch": [
    "string - up to 2 bullets (must mention ALL_WEBSITES when applicable)",
    "string (optional)"
  ],
  "confidence": "LOW" | "MEDIUM" | "HIGH"
}
```

### Score Computation

The `SummaryGenerator._compute_score_context()` method:

1. Builds a `SignalPack` from analysis results using `SignalPackBuilder`
2. Computes scores via `ScoringEngine.calculate_scores()` (v2 scoring architecture)
3. Maps internal `RiskLevel` enum to prompt labels:
   - `critical` / `high` → `"HIGH RISK"`
   - `medium` → `"MEDIUM RISK"`
   - `low` / `none` → `"LOW RISK"`

**Fallback Behavior**: If scoring fails, defaults to `score=0` and `score_label="HIGH RISK"` (safe default).

### Backward Compatibility

The generator maps new fields to legacy fields for existing UI consumers:

```python
summary.setdefault("summary", summary.get("one_liner"))
summary.setdefault("key_findings", summary.get("why_this_score", []))
summary.setdefault("recommendations", summary.get("what_to_watch", []))
summary.setdefault("overall_risk_level", self._normalize_label_to_level(score_label))
summary.setdefault("overall_security_score", score)
```

This ensures:
- Frontend components expecting `summary.summary` still work
- `key_findings` and `recommendations` arrays are populated
- Legacy risk level strings (`"low"`, `"medium"`, `"high"`) are available

### Integration Points

1. **Workflow Node**: `summary_generation_node()` in `workflow/nodes.py`
   - Called after all analyzers complete
   - Passes `metadata`, `scan_id`, `extension_id` to generator
   - Stores result in `state["executive_summary"]`

2. **API Response**: Results appear in `/api/scan/results/{extension_id}` under:
   - `summary` (legacy field)
   - `executive_summary` (new structured field)

3. **LLM Provider**: Uses `invoke_with_fallback()` with:
   - Model: `LLM_MODEL` env var (default: `"rits/openai/gpt-oss-120b"`)
   - Temperature: `0.05` (low for consistency)
   - Max tokens: `4096`
   - Fallback order is controlled by `LLM_FALLBACK_CHAIN` env var

---

## 2. Impact Analysis Prompt (v2)

### Location
- **Prompt File**: `src/extension_shield/llm/prompts/impact_analysis.yaml`
- **Status**: ✅ Integrated into workflow (`impact_analysis_node`)

### Prompt Structure

```yaml
name: impact_analysis
version: 2
output_format: json

system: |
  You are ExtensionShield. Translate capabilities into user impact.
  Rules:
  - Use ONLY provided inputs.
  - If something is only a capability, use "could" / "may".
  - Never claim malicious intent.
  - Bullets must be specific and <= 12 words.
  - If inputs are missing/empty, use UNKNOWN and empty lists.
  - Output ONLY valid JSON.
```

### Input Variables (Jinja2 Template)

1. **`extension_id`** (str): Chrome extension ID
2. **`extension_name`** (str): Extension name from manifest
3. **`extension_description`** (str): Extension description
4. **`host_access_summary_json`** (str): Authoritative host scope summary
5. **`capability_flags_json`** (str): Deterministic capability booleans
6. **`external_domains_json`** (str, optional): Detected external domains
7. **`content_scripts_json`** (str, optional): Content scripts configuration
8. **`web_accessible_resources_json`** (str, optional): Web-accessible resources

### Capability Flags Computation

`capability_flags_json` is computed deterministically from manifest + analyzer outputs and only contains booleans. Examples:

- `can_read_all_sites`, `can_read_specific_sites`, `can_read_page_content`
- `can_read_cookies`, `can_read_history`, `can_read_clipboard`
- `can_modify_page_content`, `can_inject_scripts`
- `can_block_or_modify_network`, `can_manage_extensions`, `can_control_proxy`
- `can_connect_external_domains`, `has_external_domains`
- `has_externally_connectable`, `has_web_accessible_resources`

These flags are the authoritative basis for `risk_level` in each bucket.

### Output Schema

```json
{
  "data_access": {
    "risk_level": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
    "bullets": [
      "string - max 12 words each, 0-3 items"
    ],
    "mitigations": [
      "string - max 12 words each, 0-2 items"
    ]
  },
  "browser_control": {
    "risk_level": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
    "bullets": ["..."],
    "mitigations": ["..."]
  },
  "external_sharing": {
    "risk_level": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
    "bullets": ["..."],
    "mitigations": ["..."]
  }
}
```

### Purpose

This prompt translates extension capabilities into user-facing impact buckets:

1. **`data_access`**: What information the extension could read
   - Examples: cookies, browsing history, form data, clipboard
   
2. **`browser_control`**: What the extension could change/control
   - Examples: modify page content, inject scripts, redirect requests
   
3. **`external_sharing`**: Where data could be sent
   - Examples: third-party APIs, analytics endpoints, developer servers

Each bucket includes:
- **`risk_level`**: Overall risk for that category (derived from capability flags)
- **`bullets`**: 0-3 specific capabilities (max 12 words each)
- **`mitigations`**: Up to 2 user actions to reduce risk (max 12 words each)

### Integration Status

✅ **Integrated**. Implementation includes:

1. `ImpactAnalyzer` class in `core/impact_analyzer.py`
2. `impact_analysis_node()` in the workflow graph
3. Deterministic `capability_flags_json` + `host_access_summary_json`
4. LLM invocation via `invoke_with_fallback()`
5. Stored in `analysis_results["impact_analysis"]` for API and file output

Note: Database persistence for `impact_analysis` is not yet added in SQLite/Supabase schemas.

---

## 3. Privacy + Compliance Prompt (v1)

### Location
- **Prompt File**: `src/extension_shield/llm/prompts/privacy_compliance.yaml`
- **Analyzer**: `src/extension_shield/core/privacy_compliance_analyzer.py`
- **Workflow Integration**: `src/extension_shield/workflow/nodes.py` → `privacy_compliance_node()`

### Prompt Structure

```yaml
name: privacy_compliance
version: 1
output_format: json

system: |
  You are ExtensionShield producing a privacy + compliance snapshot.
  Rules:
  - Do NOT claim actual data collection or sharing unless evidence is explicitly provided.
  - Use "could/may" when capability-based.
  - Keep it concise, user-facing, and non-alarmist.
  - Output ONLY valid JSON.
```

### Input Variables (Jinja2 Template)

1. **`host_access_summary_json`** (str): Authoritative host scope summary
2. **`capability_flags_json`** (str): Deterministic capability booleans
3. **`external_domains_json`** (str, optional): Detected external domains (may be empty)
4. **`network_evidence_json`** (str, optional): Evidence objects (may be empty; default `[]`)
5. **`storage_usage_json`** (str, optional): Evidence for storage API usage (may be empty)
6. **`cookies_usage_json`** (str, optional): Evidence for cookies API usage (may be empty)
7. **`webstore_metadata_json`** (str, optional): Store/publisher metadata (may be empty)

### Output Schema

```json
{
  "privacy_snapshot": "string - 1 sentence",
  "data_categories": ["string - up to 6 categories"],
  "governance_checks": [
    {
      "check": "string",
      "status": "PASS" | "WARN" | "FAIL" | "UNKNOWN",
      "note": "string"
    }
  ],
  "compliance_notes": [
    {
      "framework": "string",
      "status": "PASS" | "WARN" | "FAIL" | "UNKNOWN",
      "note": "string"
    }
  ]
}
```

### Integration Status

✅ **Integrated**. Implementation includes:

1. `PrivacyComplianceAnalyzer` class in `core/privacy_compliance_analyzer.py`
2. `privacy_compliance_node()` in the workflow graph (after impact analysis)
3. Deterministic `host_access_summary_json` + `capability_flags_json` truth anchors
4. Best-effort evidence extraction (SAST network evidence + optional code string scans)
5. Stored in `analysis_results["privacy_compliance"]` and included in API responses
6. Deterministic fallback output when LLM invocation fails (no N/A tiles)

Note: Database persistence for `privacy_compliance` is not yet added in SQLite/Supabase schemas.

---

## 4. Data Flow

### Summary Generation Flow

```
Workflow State
    ↓
summary_generation_node()
    ↓
SummaryGenerator.generate()
    ↓
_compute_score_context()
    ├─→ SignalPackBuilder.build()
    ├─→ ScoringEngine.calculate_scores()
    └─→ Map RiskLevel → score_label
    ↓
_get_summary_prompt_template()
    ├─→ Load prompt from YAML
    ├─→ Serialize inputs to JSON
    └─→ Create Jinja2 PromptTemplate
    ↓
invoke_with_fallback()
    ├─→ Try primary LLM provider
    ├─→ Fallback to secondary if needed
    └─→ Return LLM response
    ↓
JsonOutputParser.parse()
    ↓
Backward compatibility mapping
    ↓
Return structured summary dict
```

### Impact Analysis Flow

```
Workflow State
    ↓
impact_analysis_node()
    ↓
ImpactAnalyzer.generate()
    ↓
_classify_host_access_scope() + _compute_capability_flags()
    ↓
_get_prompt_template()
    ├─→ Load impact_analysis.yaml
    ├─→ Serialize authoritative inputs to JSON
    └─→ Create Jinja2 PromptTemplate
    ↓
invoke_with_fallback()
    └─→ Return LLM response
    ↓
JsonOutputParser.parse()
    ↓
analysis_results["impact_analysis"]
```

### Privacy + Compliance Flow

```
Workflow State
    ↓
privacy_compliance_node()
    ↓
PrivacyComplianceAnalyzer.generate()
    ↓
_classify_host_access_scope() + _compute_capability_flags()
    ↓
Evidence extraction (best-effort)
    ├─→ SAST network evidence + domains (if present)
    └─→ Optional code string scans (storage/cookies)
    ↓
_get_prompt_template()
    ├─→ Load privacy_compliance.yaml
    ├─→ Serialize authoritative inputs to JSON
    └─→ Create Jinja2 PromptTemplate
    ↓
invoke_with_fallback()
    └─→ Return LLM response
    ↓
JsonOutputParser.parse()
    ↓
analysis_results["privacy_compliance"]
```

### Key Components

1. **`SignalPackBuilder`**: Normalizes all analyzer outputs into unified signals
2. **`ScoringEngine`**: Computes security/privacy/governance scores (v2 architecture)
3. **`invoke_with_fallback()`**: Multi-provider LLM invocation with automatic failover
4. **`JsonOutputParser`**: Parses LLM JSON response into Python dict

---

## 5. Configuration

### Environment Variables

```bash
# LLM Provider (single provider mode)
LLM_PROVIDER=watsonx|openai|rits

# OR Multi-provider fallback chain (default: watsonx,openai)
LLM_FALLBACK_CHAIN=watsonx,openai

# Model selection
LLM_MODEL=meta-llama/llama-3-3-70b-instruct|gpt-4o|rits/openai/gpt-oss-120b

# Provider-specific configs
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...
WATSONX_API_ENDPOINT=https://us-south.ml.cloud.ibm.com
OPENAI_API_KEY=sk-...

# Timeout and retries
LLM_TIMEOUT_SECONDS=25
LLM_MAX_RETRIES_PER_PROVIDER=1
```

### Prompt Loading

Prompts are loaded via `extension_shield.llm.prompts.get_prompts()`:

```python
from extension_shield.llm.prompts import get_prompts

# Load specific prompt file
prompts = get_prompts("summary_generation.yaml")
template_str = prompts.get("summary_generation")
```

The loader:
- Searches `src/extension_shield/llm/prompts/*.yaml`
- Returns dict with prompt name as key
- Handles YAML parsing errors gracefully

---

## 6. Output Examples

### Summary Generation Output

```json
{
  "one_liner": "Overall risk is low, but access scope is broad.",
  "why_this_score": [
    "No critical code findings were detected in the scan",
    "Web Store signals appear stable and consistent",
    "Most permissions align with the stated functionality"
  ],
  "what_to_watch": [
    "Runs on all websites (broad host access increases impact)",
    "Watch for updates that add new permissions"
  ],
  "confidence": "MEDIUM",
  "score": 85,
  "score_label": "LOW RISK",
  "summary": "...",  // Legacy field (same as one_liner)
  "key_findings": [...],  // Legacy field (same as why_this_score)
  "recommendations": [...],  // Legacy field (same as what_to_watch)
  "overall_risk_level": "low",  // Legacy field
  "overall_security_score": 85  // Legacy field
}
```

**Note**: `score` and `score_label` are appended by the generator (post-LLM) for API/UI convenience; they are not produced by the LLM schema.

### Impact Analysis Output

```json
{
  "data_access": {
    "risk_level": "MEDIUM",
    "bullets": [
      "Could read cookies for specific domains",
      "May access form data on matching websites"
    ],
    "mitigations": [
      "Review cookie permissions in extension settings",
      "Use separate browser profile for sensitive sites"
    ]
  },
  "browser_control": {
    "risk_level": "LOW",
    "bullets": [
      "Can inject content scripts on matching pages"
    ],
    "mitigations": [
      "Monitor browser behavior after installation"
    ]
  },
  "external_sharing": {
    "risk_level": "UNKNOWN",
    "bullets": [],
    "mitigations": []
  }
}
```

---

## 7. Error Handling

### Summary Generation

1. **Scoring Failure**: Falls back to `score=0`, `score_label="HIGH RISK"` (safe default)
2. **LLM Failure**: Returns `None`, workflow continues without summary
3. **JSON Parse Failure**: Logs exception, returns `None`
4. **Missing Inputs**: Uses empty dicts `{}` for missing analyzer outputs

### Impact Analysis

- Missing inputs → `risk_level="UNKNOWN"`, empty bullets
- LLM failure → Return `None` or empty structure
- Invalid JSON → Log error, return `None`

---

## 8. Testing

### Manual Testing

1. **Test Summary Generation**:
   ```bash
   # Run full scan workflow
   python -m extension_shield.cli.main scan "https://chrome.google.com/webstore/detail/..."
   
   # Check executive_summary in results
   ```

2. **Test Prompt Loading**:
   ```python
   from extension_shield.llm.prompts import get_prompts
   prompts = get_prompts("summary_generation.yaml")
   assert "summary_generation" in prompts
   ```

3. **Test Score Computation**:
   ```python
   from extension_shield.core.summary_generator import SummaryGenerator
   generator = SummaryGenerator()
   score, label = generator._compute_score_context(...)
   assert score >= 0 and score <= 100
   assert label in ["LOW RISK", "MEDIUM RISK", "HIGH RISK"]
   ```

---

## 9. Future Enhancements

### Impact Analysis Enhancements

1. Expand capability flags with additional signals (e.g., native messaging)
2. Improve external domain detection from network analysis payloads
3. Add confidence scoring per bucket based on evidence density

### Prompt Improvements

1. **Versioning**: Add prompt version tracking in output
2. **Caching**: Cache LLM responses for identical inputs
3. **A/B Testing**: Support multiple prompt versions for comparison
4. **Validation**: Add JSON schema validation before returning results

### UI Integration

1. **Summary Display**: Update frontend to show new `one_liner`, `why_this_score`, `what_to_watch` fields
2. **Impact Buckets**: Create UI component for `data_access`, `browser_control`, `external_sharing`
3. **Confidence Indicators**: Display confidence levels visually

---

## 10. Files Modified/Created

### Modified Files

1. **`src/extension_shield/llm/prompts/summary_generation.yaml`**
   - Updated to version 4 with host access scope rules
   - Added authoritative `host_access_summary_json` input
   - Enforces scope-aligned wording in summaries

2. **`src/extension_shield/core/summary_generator.py`**
   - Added deterministic host access scope computation
   - Injects `host_access_summary_json` into the prompt
   - Maintains backward compatibility mapping for legacy fields

3. **`src/extension_shield/workflow/nodes.py`**
   - Added `impact_analysis_node()` and `privacy_compliance_node()`
   - Wired chain: summary → impact → privacy_compliance → governance

4. **`src/extension_shield/workflow/graph.py`**
   - Added `impact_analysis_node` and `privacy_compliance_node` to the workflow graph

5. **`src/extension_shield/workflow/node_types.py`**
   - Added `IMPACT_ANALYSIS_NODE` and `PRIVACY_COMPLIANCE_NODE` constants

6. **`src/extension_shield/workflow/state.py`**
   - Added `impact_analysis` and `privacy_compliance` to workflow state

7. **`src/extension_shield/api/main.py`**
   - Includes `impact_analysis` and `privacy_compliance` in scan results payload

### Created Files

1. **`src/extension_shield/llm/prompts/impact_analysis.yaml`**
   - Updated to version 2 (capability flags + authoritative scope)

2. **`src/extension_shield/core/impact_analyzer.py`**
   - New ImpactAnalyzer (capability flags + LLM generation)

3. **`src/extension_shield/llm/prompts/privacy_compliance.yaml`**
   - New prompt file (v1) for privacy + compliance snapshot

4. **`src/extension_shield/core/privacy_compliance_analyzer.py`**
   - New PrivacyComplianceAnalyzer (truth anchors + evidence → snapshot)

---

## 11. Summary

### ✅ Completed

- Summary Generation prompt updated to v4 with host access scope anchor
- Score computation integrated using SignalPackBuilder + ScoringEngine
- Backward compatibility maintained for existing UI consumers
- Impact Analysis v2 prompt integrated into workflow with capability flags
- Privacy + Compliance v1 prompt integrated into workflow with truth anchors + evidence defaults

### ⚠️ Pending

- Frontend UI updates for new summary fields
- Impact buckets UI component

### 📝 Notes

- All prompts use strict JSON schemas for reliable parsing
- LLM provider fallback ensures high availability
- Score computation uses v2 scoring architecture (SignalPack + ScoringEngine)
- All prompts follow "capability-based" language (use "could"/"may", not "steals"/"malicious")

---

**Last Updated**: 2026-02-07  
**Prompt Versions**: Summary Generation v4, Impact Analysis v2, Privacy + Compliance v1

