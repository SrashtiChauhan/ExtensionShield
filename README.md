
# Project Atlas

<p align="center">
  <strong>AI-Powered Chrome Extension Compliance Analysis</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start-docker">Quick Start</a> •
  <a href="#installation">Installation</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**Project Atlas** is a comprehensive security analysis tool for Chrome browser extensions. It combines static analysis (SAST), threat intelligence (VirusTotal), and AI-powered assessment to help security researchers, malware analysts, and browser security teams identify malicious behavior in browser extensions.

## Quick Start (Docker)

The fastest way to run Project Atlas is with Docker.

```bash
# 1. Clone the repository
cd Project-Atlas

# 2. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY (required)
# Optionally add VIRUSTOTAL_API_KEY for threat intelligence

# 3. Build and run
docker compose up --build

# 4. Access the application
# Web UI: http://localhost:8007
# API Docs: http://localhost:8007/docs
```

### Supported LLM Providers

| Provider | LLM_PROVIDER | Recommended Models |
|----------|--------------|-------------------|
| OpenAI | `openai` | `gpt-4o`, `gpt-4-turbo` |
| WatsonX (IBM) | `watsonx` | `meta-llama/llama-3-3-70b-instruct` |
| Ollama (Local) | `ollama` | `llama3`, `mistral` |
| RITS (IBM Research) | `rits` | `meta-llama/llama-3-3-70b-instruct` |

### Custom Semgrep Rules

Located in `src/project_atlas/config/custom_semgrep_rules.yaml`:

| Rule ID | Category | Description |
|---------|----------|-------------|
| `banking.form_hijack.submit_intercept` | Form hijacking | Form submit interception |
| `banking.cred_sniff.password_input_hooks` | Credential theft | Password field listeners |
| `banking.ext.webrequest.redirect` | Network hijacking | WebRequest redirect abuse |
| `banking.exfil.generic_channels` | Data exfiltration | sendBeacon/Image.src abuse |
| `banking.obfuscation.eval_newfunc` | Code injection | eval()/Function() execution |

All rules include MITRE ATT&CK mappings and CWE references.

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan/trigger` | POST | Trigger extension scan |
| `/api/scan/status/{id}` | GET | Check scan status |
| `/api/scan/results/{id}` | GET | Get complete results |
| `/api/scan/files/{id}` | GET | List extracted files |
| `/api/scan/file/{id}/{path}` | GET | Get file content |
| `/api/scan/report/{id}` | GET | Generate PDF report |
| `/api/statistics` | GET | Aggregated statistics |
| `/api/history` | GET | Scan history |
| `/health` | GET | Health check |

Full API documentation available at http://localhost:8007/docs

---

## Claude Desktop Integration (MCP)

Project Atlas integrates with Claude Desktop via MCP (Model Context Protocol).

**Setup:**

1. Edit Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "Project Atlas": {
      "command": "uv",
      "args": [
        "--directory",
        "/absolute/path/to/Project-Atlas",
        "run",
        "python",
        "-m",
        "project_atlas.mcp_server.main"
      ]
    }
  }
}
```

2. Restart Claude Desktop

3. Ask Claude: *"Analyze this Chrome extension: https://chromewebstore.google.com/detail/..."*

<p align="center">
  <img src="images/claude.png" alt="Project Atlas Claude" width="800"/>
</p>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Project Atlas                            │
├─────────────────────────────────────────────────────────────┤
│  Interfaces                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │   CLI   │  │ Web UI  │  │   API   │  │   MCP   │         │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
│       └────────────┴────────────┴────────────┘              │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────┐            │
│  │           LangGraph Workflow                │            │
│  │  Download → Parse → Analyze → Summarize     │            │
│  └──────────────────────┬──────────────────────┘            │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────┐            │
│  │              Analyzers                      │            │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────┐ │            │
│  │  │Permissions │ │   SAST     │ │ WebStore │ │            │
│  │  └────────────┘ └────────────┘ └──────────┘ │            │
│  │  ┌────────────┐ ┌────────────┐              │            │
│  │  │VirusTotal  │ │  Entropy   │              │            │
│  │  └────────────┘ └────────────┘              │            │
│  └─────────────────────────────────────────────┘            │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────┐            │
│  │         LLM Summary Generation              │            │
│  │      (OpenAI / WatsonX / Ollama)            │            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Semgrep** - Static analysis engine
- **LangGraph** - Workflow orchestration
- **VirusTotal** - Threat intelligence
- **React + Vite** - Frontend framework

---

<p align="center">
  Built for browser security research and extension threat intelligence
</p>

<p align="center">
  <sub>This tool is intended for legitimate security research, malware analysis, and educational purposes only.</sub>
</p>


---

## Part 2 — Extension Governance Engine (Decisioning Wrapper)

# Extension Governance Engine — Architecture & Implementation Guide

<p align="center">
  <strong>Enterprise Extension Governance: ALLOW/BLOCK/NEEDS_REVIEW Decisioning for IT Admins</strong>
</p>

<p align="center">
  <a href="#strategic-positioning">Strategic Positioning</a> •
  <a href="#competitive-moat">Competitive Moat</a> •
  <a href="#overview">Overview</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#data-flow">Data Flow</a> •
  <a href="#data-contracts">Data Contracts</a> •
  <a href="#implementation">Implementation</a> •
  <a href="#appendix-a-optional-policy-packs-compliance--controls-mapping">Appendix: Policy Packs</a>
</p>

---

> ✅ **STATUS (v1 Focus): Extension Governance is the core product**  
> This system powers **ALLOW/BLOCK/NEEDS_REVIEW** decisioning + evidence bundles for enterprise IT/security workflows.  
> **Compliance packs (DPDP/GDPR/CCPA)** are **optional future add-ons** (policy packs), shipped later as modules.

> ⚠️ **Non-goal**: Automated legal compliance certification.
> Output is governance decisioning + evidence for humans/auditors — not legal advice.

---

## Strategic Positioning

### What We're NOT Building

❌ "We scan extensions" — many tools do this already  
❌ Another security report generator  
❌ LLM-powered vibes-based risk scoring

### What We ARE Building

✅ **Decisioning workflow, not a report**
- Output = `ALLOW` / `BLOCK` / `NEEDS_REVIEW` + rationale + evidence
- Shaped for IT admins who must make policy decisions
- Actionable verdicts, not "47 warnings, good luck"

✅ **Explainable, repeatable, defensible**
- Deterministic rules (OPA/policy-engine style)
- Same input → same output, every time
- Audit trail that holds up to internal security/compliance review

✅ **Continuous governance, not point-in-time**
- Extensions change. Updates break trust.
- Detect "permissions/code/network behavior changed" → trigger re-review
- Moat is **ongoing monitoring**, not one-shot scanning

---

## Competitive Moat

### Why This Beats "Just Another Scanner"

| Dimension | Typical Scanner | Extension Governance Engine |
|-----------|------------------|-----------------------------|
| **Output** | Findings report | `ALLOW/BLOCK/NEEDS_REVIEW` + evidence bundle |
| **Consistency** | LLM-dependent, varies | Deterministic policy rules |
| **Explainability** | "AI says risky" | Rule ID → Evidence → Citation |
| **Updates** | Re-scan manually | Continuous monitoring + auto-alert |
| **Enterprise Fit** | Security reads report | IT admin can enforce allow/block |

### Revenue Expansion via Policy Packs

```
Phase 1 (v1 default): Governance Baseline
├── ENTERPRISE_GOV_BASELINE (high-confidence governance decisions)
└── CWS_LIMITED_USE (Chrome Web Store policy alignment)

Phase 2 (optional add-on): Privacy Indicator Packs ($)
├── GDPR_INDICATORS
├── CCPA_INDICATORS
└── DPDP_RISK_INDICATORS

Phase 3 (optional add-on): Controls Mapping Packs ($$)
├── SOC2_MAPPING
├── ISO27001_MAPPING
└── NIST_MAPPING / CIS_MAPPING
```

> ⚠️ **Important**: Policy packs provide **indicators** and **controls mapping**, not legal compliance certification. They surface evidence for human review, not automated compliance verdicts.

### Timely Market Signal

The recent wave of enterprise-targeting malicious extensions validates the problem space.  
**Do not differentiate on "we noticed it first."** Many have.  
Differentiate on: **repeatable governance workflow** that IT teams can operationalize.

---

## Overview

The **Extension Governance Engine** transforms security findings into **governance verdicts**. It evaluates browser extensions against deterministic policy rulepacks and produces **ALLOW/BLOCK/NEEDS_REVIEW** decisions with full evidence chains and an enforcement-ready export bundle.

### Core Principles

| Principle | What It Means |
|----------|----------------|
| **Decisioning > Reporting** | Output is a decision, not a document |
| **Deterministic > Probabilistic** | Same extension → same verdict, every time |
| **Evidence-First** | Every verdict links to code, manifest, network traces |
| **Chain-of-Custody** | Artifact hash → file hash → line ranges → provenance |
| **Continuous > Point-in-Time** | Monitor changes, re-evaluate automatically |

### Key Features (v1)

- **Deterministic Verdicts**: Policy rules produce consistent ALLOW/BLOCK/NEEDS_REVIEW
- **Evidence Bundles**: Every finding links to code snippets, manifest excerpts, network traces
- **Multi-Pack Evaluation**: Apply multiple rulepacks (Governance baseline + CWS policy; optional packs later)
- **Enforcement-Ready Outputs**: Decision + recommended action + export bundle (ZIP)

### Design Philosophy

1. **Minimal v0 Contracts**: Lock schemas that support 10–15 rules; expand only when needed  
2. **Keep Existing Code**: Security analysis (Project Atlas / ThreatXtension) remains unchanged  
3. **Scan Artifact Directory**: Every scan creates `/scans/{scan_id}/` with all JSONs  
4. **Reuse Endpoints**: Change response format; minimize new endpoints (except bundle export)  
5. **Dataflow is "Nice to Have"**: Ship 2–3 high-confidence correlations, not full taint analysis for MVP  

### Manifest Version Support (MV2 vs MV3)

We must support both Manifest V2 and Manifest V3 patterns in rules/signals:

- **MV3** commonly uses `host_permissions` + `permissions`.
- **MV2** commonly uses `permissions` for host patterns (e.g., `<all_urls>`, `*://*/*`).
- **Both** may declare URL patterns via `content_scripts[].matches`, `externally_connectable.matches`, etc.

**Broad host access detection must consider all of:**
- `manifest.host_permissions` (MV3)
- `manifest.permissions` (MV2 host patterns like `<all_urls>`, `*://*/*`)
- `manifest.content_scripts[].matches`
- `manifest.externally_connectable.matches`

**Recommended (MVP)**: The Facts Builder (Stage 2) SHOULD normalize these into a single derived field:
- `facts.host_access_patterns: string[]`

Rules should then check only:
- `facts.host_access_patterns contains "<all_urls>"`

---

## Architecture

### Two-Pipeline Split

```
┌─────────────────────────────────────────────────────────────┐
│  PIPELINE A: Policy Authoring (Offline, Manual for MVP)    │
│  ────────────────────────────────────────────────────────   │
│  Input:  Manual citations.yaml + rulepack YAML creation    │
│  Output: citations.yaml + rulepack YAML files              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PIPELINE B: Extension Scanning (Online, Automated)        │
│  ────────────────────────────────────────────────────────   │
│  Input:  Web Store URL / CRX / ZIP + Rulepacks             │
│  Output: Governance decision + evidence + export bundle    │
└─────────────────────────────────────────────────────────────┘
```

**MVP Decision**: Pipeline A is manual (`citations.yaml` + rulepack YAML). No PDF parsing.

### System Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface"
        UI[Web UI / CLI / API]
    end
    
    subgraph "API Layer"
        API[FastAPI Endpoints]
    end
    
    subgraph "Workflow Orchestration"
        WG[LangGraph Workflow]
    end
    
    subgraph "Security Analysis Pipeline (Existing)"
        S0[Stage 0: Ingest + Extract]
        S1[Stage 1: Project Atlas / ThreatXtension Scan]
    end
    
    subgraph "Governance Pipeline (New)"
        S2[Stage 2: Facts Builder]
        S3[Stage 3: Evidence Index Builder]
        S4[Stage 4: Signal Extraction]
        S5[Stage 5: Store Listing Extractor<br/>optional fetch; always emits file]
        S6[Stage 6: Context Builder]
        S7[Stage 7: Rules Engine]
        S8[Stage 8: Decision + Report Generator]
    end
    
    subgraph "Data Storage"
        SD[Scan Artifact Directory<br/>/scans/{scan_id}/]
        DB[(SQLite Database)]
    end
    
    subgraph "Policy Authoring (Manual)"
        RP[Rulepack YAML Files]
        CIT[Citations YAML]
    end
    
    UI --> API
    API --> WG
    WG --> S0
    S0 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S6 --> S7
    S7 --> S8
    S8 --> SD
    S8 --> DB
    S7 --> RP
    S7 --> CIT
    S8 --> API
```

### API Endpoint Flow

```mermaid
graph LR
    subgraph "Client"
        WEB[Web UI]
        CLI[CLI]
    end
    
    subgraph "API Endpoints"
        TRIGGER[POST /api/scan/trigger]
        UPLOAD[POST /api/scan/upload]
        STATUS[GET /api/scan/status/{scan_id}]
        RESULTS[GET /api/scan/results/{scan_id}]
        REPORT[GET /api/scan/report/{scan_id}]
        BUNDLE[GET /api/scan/enforcement_bundle/{scan_id}]
    end
    
    subgraph "Backend"
        WORKFLOW[LangGraph Workflow]
        STORAGE[Scan Directory]
        DB[(Database)]
    end
    
    WEB --> TRIGGER
    WEB --> UPLOAD
    CLI --> TRIGGER
    CLI --> UPLOAD
    
    TRIGGER --> WORKFLOW
    UPLOAD --> WORKFLOW
    
    WEB --> STATUS
    CLI --> STATUS
    STATUS --> DB
    
    WEB --> RESULTS
    CLI --> RESULTS
    RESULTS --> STORAGE
    
    WEB --> REPORT
    REPORT --> STORAGE
    
    WEB --> BUNDLE
    BUNDLE --> STORAGE
    
    WORKFLOW --> STORAGE
    WORKFLOW --> DB
```

---

## Data Flow

### Complete Pipeline Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Workflow
    participant S0 as Stage 0: Ingest
    participant S1 as Stage 1: Security Scan
    participant S2 as Stage 2: Facts Builder
    participant S3 as Stage 3: Evidence Index
    participant S4 as Stage 4: Signal Extraction
    participant S5 as Stage 5: Store Listing Extractor
    participant S6 as Stage 6: Context
    participant S7 as Stage 7: Rules Engine
    participant S8 as Stage 8: Decision+Report
    participant Storage

    User->>API: POST /api/scan/trigger
    API->>Workflow: Start workflow
    Workflow->>S0: Extract extension
    S0->>Storage: Save file_inventory.json
    S0->>S1: Pass extracted files
    
    S1->>S1: Run analyzers (SAST, Permissions, VT, etc.)
    S1->>Storage: Save security_findings.json
    S1->>S2: Pass analysis_results
    
    S2->>S2: Normalize to facts.json
    S2->>Storage: Save facts.json
    S2->>S3: Pass facts.json
    
    S3->>S3: Generate evidence_refs
    S3->>Storage: Save evidence_index.json
    S3->>S4: Pass facts + evidence_index
    
    S4->>S4: Extract signals
    S4->>Storage: Save signals.json
    S4->>S5: Pass signals.json
    
    S5->>S5: Extract store listing (fetch optional; file always created)
    S5->>Storage: Save store_listing.json (always, with extraction.status)
    S5->>S6: Pass all data
    
    S6->>S6: Determine rulepacks
    S6->>Storage: Save context.json
    S6->>S7: Pass context + all data
    
    S7->>S7: Load rulepacks, evaluate rules
    S7->>Storage: Save rule_results.json
    S7->>S8: Pass rule_results
    
    S8->>S8: Generate decision + reports
    S8->>Storage: Save report.json, report.html
    S8->>API: Return scan_id
    API->>User: Return scan_id
```

### Stage-by-Stage Data Transformation

```
Input: Web Store URL / CRX / ZIP
  ↓
[Stage 0] Ingest + Extract
  → scan_id (UUID)
  → artifact_hash (SHA256)
  → file_inventory.json
  ↓
[Stage 1] Security Scan (Existing)
  → security_findings.json
  → analysis_results (permissions, SAST, VT, entropy, webstore)
  ↓
[Stage 2] Facts Builder
  → facts.json (canonical contract)
  → Normalizes: manifest, files, security findings, endpoints
  ↓
[Stage 3] Evidence Index Builder
  → evidence_index.json
  → evidence_ref IDs with file_path, sha256, line ranges, snippets, provenance
  ↓
[Stage 4] Signal Extraction
  → signals.json (typed signals + confidence + evidence_refs)
  ↓
[Stage 5] Store Listing Extractor (optional fetch; always emits store_listing.json)
  → store_listing.json (with extraction.status: ok/skipped/failed)
  ↓
[Stage 6] Context Builder
  → context.json (selects rulepacks + basic scope)
  ↓
[Stage 7] Rules Engine
  → rule_results.json (ALLOW/BLOCK/NEEDS_REVIEW per rule)
  ↓
[Stage 8] Decision + Report Generator
→ report.json + report.html (enforcement_bundle.zip generated on-demand via API)
```

---

## Data Contracts

### Scan Artifact Directory Structure

**Canonical Location**: `/scans/{scan_id}/`

```

> 📌 **Note**: `enforcement_bundle.zip` is generated **on-demand** by the API and is **not stored** inside `/scans/{scan_id}/`.
/scans/{scan_id}/
  ├── artifact.zip              # Optional: original extension file
  ├── file_inventory.json       # Stage 0 output
  ├── security_findings.json    # Stage 1 output (existing format)
  ├── facts.json                # Stage 2 output
  ├── evidence_index.json       # Stage 3 output
  ├── signals.json              # Stage 4 output
  ├── store_listing.json        # Stage 5 output (always present, check extraction.status)
  ├── context.json              # Stage 6 output
  ├── rule_results.json         # Stage 7 output
  ├── report.json               # Stage 8 output
  └── report.html               # Stage 8 output
```

### facts.json (Stage 2 Output)

**Purpose**: Canonical contract between security analysis and governance decisioning.

The facts schema is the canonical contract between Atlas and governance decisioning.

**MVP addition (required):**
- `facts.host_access_patterns: string[]` — normalized host access patterns across MV2 + MV3 manifest fields.

This field is produced by Stage 2 by consolidating host access from:
- `manifest.host_permissions` (MV3)
- `manifest.permissions` (MV2 host patterns like `<all_urls>`, `*://*/*`)
- `manifest.content_scripts[].matches`
- `manifest.externally_connectable.matches`

Rulepacks should prefer checking `facts.host_access_patterns` instead of querying multiple manifest paths.

### evidence_index.json (Stage 3 Output)

**Purpose**: Centralized evidence storage with chain-of-custody.

*(Schema unchanged — keep as-is.)*

### signals.json (Stage 4 Output)

**MVP Signal Types** (exactly 4 types for MVP):

- `HOST_PERMS_BROAD`
- `SENSITIVE_API`
- `ENDPOINT_FOUND`
- `DATAFLOW_TRACE`

*(Schema unchanged — keep as-is.)*

### store_listing.json (Stage 5 Output) — CANONICAL SCHEMA

> ⚠️ **Key Invariant**: This file is **ALWAYS created**, even when extraction is skipped or fails.  
> The fetch from Chrome Web Store is optional (may be skipped for local CRX uploads), but the artifact file always exists with an `extraction.status` field.  
> Rules that depend on store listing data MUST check `extraction.status == "ok"` before issuing a BLOCK.

**Purpose**: Store listing declarations (data categories, purposes, etc.) extracted from Chrome Web Store.

**Schema**: Flattened structure — NO nested `store_listing` object.

```json
{
  "extraction": {
    "status": "ok",
    "reason": "",
    "extracted_at": "2026-01-22T10:00:00Z"
  },
  "declared_data_categories": ["user_activity", "personal_communications"],
  "declared_purposes": ["app_functionality"],
  "declared_third_parties": [],
  "privacy_policy_url": "https://example.com/privacy",
  "privacy_policy_hash": "sha256:abc123..."
}
```

**Status Values**:

| Status | Meaning | Rule Behavior |
|--------|---------|---------------|
| `ok` | Extraction succeeded, data is reliable | Rules can evaluate and issue BLOCK if conditions met |
| `skipped` | Stage was intentionally skipped (e.g., local CRX upload, no store URL provided) | Rules MUST fall back to `NEEDS_REVIEW`, never BLOCK |
| `failed` | Extraction attempted but failed (e.g., network error, page changed) | Rules MUST fall back to `NEEDS_REVIEW`, never BLOCK |

**When `status != "ok"`** (arrays empty, policy fields null):

```json
{
  "extraction": {
    "status": "skipped",
    "reason": "Extension uploaded as local CRX, no store listing available",
    "extracted_at": "2026-01-22T10:00:00Z"
  },
  "declared_data_categories": [],
  "declared_purposes": [],
  "declared_third_parties": [],
  "privacy_policy_url": null,
  "privacy_policy_hash": null
}
```

**Failed extraction example**:

```json
{
  "extraction": {
    "status": "failed",
    "reason": "Network error: unable to fetch Chrome Web Store listing",
    "extracted_at": "2026-01-22T10:00:00Z"
  },
  "declared_data_categories": [],
  "declared_purposes": [],
  "declared_third_parties": [],
  "privacy_policy_url": null,
  "privacy_policy_hash": null
}
```

> 💡 **Why this matters**: Without extraction status, a rule like "data transfer detected + no declared categories = BLOCK" would incorrectly BLOCK when we simply couldn't fetch the listing. This creates false positives and erodes trust.

> 📌 **Rule DSL Path Convention**: Rules reference fields directly (`declared_data_categories`), NOT via nested path (`store_listing.declared_data_categories`). The flattened schema ensures the Rule Condition DSL evaluator can access `extraction.status` and `declared_*` fields at the top level.

### context.json (Stage 6 Output)

**Purpose**: Determine which rulepacks apply.

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

**Default (v1)**: 
- `regions_in_scope`: `["GLOBAL"]` (enterprise config can override later)
- `rulepacks`: `["ENTERPRISE_GOV_BASELINE", "CWS_LIMITED_USE"]`

> 📌 **Note**: `regions_in_scope` is a configuration label for selecting policy packs, not legal jurisdiction detection. It does not imply legal compliance or territorial determination.

**Optional add-on**: Privacy Indicator Packs and Controls Mapping Packs (see Appendix)

### rule_results.json (Stage 7 Output) — Governance-first Example

```json
{
  "rule_results": [
    {
      "rule_id": "ENTERPRISE_GOV_BASELINE::R1",
      "rulepack": "ENTERPRISE_GOV_BASELINE",
      "verdict": "NEEDS_REVIEW",
      "confidence": 0.90,
      "evidence_refs": ["ev_002"],
      "citations": ["ENTERPRISE_GOV_BASELINE::GUIDE_1"],
      "explanation": "Extension requests wildcard host permissions (<all_urls>). This is high-risk and requires business justification.",
      "recommended_action": "Require justification and security review before allowing"
    },
    {
      "rule_id": "CWS_LIMITED_USE::R2",
      "rulepack": "CWS_LIMITED_USE",
      "verdict": "BLOCK",
      "confidence": 0.90,
      "evidence_refs": ["ev_001", "ev_003"],
      "citations": ["CWS_LIMITED_USE::SECTION_5"],
      "explanation": "Data transfer to external endpoint detected. extraction.status == 'ok' and declared_data_categories is empty.",
      "recommended_action": "Block installation org-wide"
    }
  ]
}
```

### report.json (Stage 8 Output)

**Purpose**: Complete governance decision with evidence bundle.

**Decision Aggregation (MVP)**:
- If **any** rule verdict is `BLOCK` → `decision.verdict = "BLOCK"`
- Else if **any** rule verdict is `NEEDS_REVIEW` → `decision.verdict = "NEEDS_REVIEW"`
- Else → `decision.verdict = "ALLOW"`

**decision.rationale (MVP)**:
- Use the first `BLOCK` rule (by rule order); if none, use the first `NEEDS_REVIEW` rule; else `"No triggered rules"`.

The `store_listing` field embeds the **entire flattened store_listing.json** (including `extraction.status`), enabling consumers to verify extraction status and declared data in one place.

```json
{
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-22T10:00:00Z",
  "extension": {
    "id": "abcdefghijklmnopqrstuvwxyz",
    "name": "Example Extension",
    "version": "1.0.0"
  },
  "decision": {
    "verdict": "BLOCK",
    "rationale": "Data transfer behavior detected with no matching store listing declarations",
    "action_required": "Block org-wide / remove from approved list"
  },
  "facts": { "...": "..." },
  "evidence_index": { "...": "..." },
  "signals": { "...": "..." },
  "context": { "...": "..." },
  "store_listing": {
    "extraction": {
      "status": "ok",
      "reason": "",
      "extracted_at": "2026-01-22T10:00:00Z"
    },
    "declared_data_categories": [],
    "declared_purposes": [],
    "declared_third_parties": [],
    "privacy_policy_url": "https://example.com/privacy",
    "privacy_policy_hash": "sha256:abc123..."
  },
  "rule_results": { "...": "..." },
  "summary": {
    "total_rules_evaluated": 15,
    "allow_count": 8,
    "block_count": 2,
    "needs_review_count": 5,
    "rulepacks_applied": [
      { "rulepack_id": "ENTERPRISE_GOV_BASELINE", "version": "1.0.0" },
      { "rulepack_id": "CWS_LIMITED_USE", "version": "1.0.0" }
    ]
  }
}
```

> 📌 **Note**: The `store_listing` object in `report.json` is an exact copy of the `store_listing.json` file content. The enforcement bundle ZIP also includes `store_listing.json` for standalone consumption.

---

## Rule Condition DSL

### Evaluation Context

The Rules Engine provides a **unified evaluation context** to the DSL. Fields from `store_listing.json` are accessible at the **top level** (no nesting required):

| Source File | DSL Path | Example |
|-------------|----------|---------|
| `store_listing.json` → `extraction.status` | `extraction.status` | `extraction.status == "ok"` |
| `store_listing.json` → `declared_data_categories` | `declared_data_categories` | `declared_data_categories is empty` |
| `store_listing.json` → `declared_purposes` | `declared_purposes` | `declared_purposes contains "analytics"` |
| `store_listing.json` → `declared_third_parties` | `declared_third_parties` | `declared_third_parties is not empty` |
| `signals.json` → signals array | `signals` | `signals contains type="DATAFLOW_TRACE"` |
| `facts.json` → manifest | `manifest.permissions` | `manifest.permissions contains "tabs"` |
| `facts.json` → host_access_patterns | `facts.host_access_patterns` | `facts.host_access_patterns contains "<all_urls>"` |

> 📌 **Note**: If `store_listing.json` is missing (should not happen in normal operation), the Rules Engine creates a fallback context with `extraction.status = "failed"`, `reason = "missing store_listing.json"`, and all `declared_*` arrays empty.

### Supported Operators

| Operator | Syntax | Description | Example |
|----------|--------|-------------|---------|
| **Equality** | `==`, `!=` | Value comparison | `extraction.status == "ok"` |
| **Contains** | `contains` | Check if array/string contains value | `manifest.permissions contains "storage"` |
| **Not Contains** | `not contains` | Check if array/string does not contain value | `manifest.permissions not contains "tabs"` |
| **Is Empty** | `is empty` | Check if array/object/string is empty | `declared_data_categories is empty` |
| **Is Not Empty** | `is not empty` | Check if array/object/string is not empty | `signals is not empty` |
| **Logical AND** | `AND` | Both conditions must be true | `condition1 AND condition2` |
| **Logical OR** | `OR` | Either condition must be true | `condition1 OR condition2` |
| **Logical NOT** | `NOT` | Negate condition | `NOT (condition)` |
| **Type Check** | `type="..."` | Check signal type (for signals array) | `signals contains type="SENSITIVE_API"` |

### Missing Fields Handling

> ⚠️ **Critical for avoiding false BLOCKs**

| Field Type | Missing/Null Treated As |
|------------|------------------------|
| Arrays | `[]` (empty array) |
| Objects | `{}` (empty object) |
| Strings | `""` (empty string) |
| Numbers | `0` |
| Booleans | `false` |

**However**: For BLOCK rules that depend on store listing data, you MUST explicitly check `extraction.status == "ok"` first. See examples below.

### Safety Guardrail for Listing-Dependent BLOCK Rules

> ⚠️ **Mandatory Constraint**:  
> BLOCK rules that reference `declared_*` fields (e.g., `declared_data_categories`, `declared_purposes`, `declared_third_parties`) **MUST** include `extraction.status == "ok"` in the condition.  
>  
> **Recommended**: The Rules Engine SHOULD validate this constraint at rulepack load time and reject non-compliant BLOCK rules with a clear error message.

### BLOCK vs NEEDS_REVIEW Standard (Rule-writing guideline)

| Verdict | When to Use | Evidence Required |
|---------|-------------|-------------------|
| **BLOCK** | Strong, directly attributable evidence | Explicit endpoint + sensitive permission + correlated code path, OR a confirmed dataflow trace. **For listing-dependent rules**: `extraction.status == "ok"` required. |
| **NEEDS_REVIEW** | Plausible risk indicator, cannot prove behavior | Broad host perms, endpoints present, risky APIs — but no proof of intent. Also: when `extraction.status != "ok"`. |
| **ALLOW** | Condition not met, no policy violation | Extension passes all applicable rules |

> 💡 **Key Principle**: "Explainable, repeatable, defensible" beats "LLM vibes."  
> Every BLOCK must have a clear evidence chain an IT admin can show to their CISO.

### Rule Examples — Correct Patterns

**✅ CORRECT: BLOCK rule with extraction status check**

```yaml
- rule_id: "CWS_LIMITED_USE::R3"
  name: "Data Transfer Without Declaration"
  description: "Data transfer detected but store listing declares no data categories"
  condition: |
    extraction.status == "ok" AND
    signals contains type="DATAFLOW_TRACE" AND
    declared_data_categories is empty
  verdict: "BLOCK"
  recommended_action: "Block installation — data transfer behavior with no store declaration"
  citations: ["CWS_LIMITED_USE::SECTION_5"]
```

**✅ CORRECT: Fallback to NEEDS_REVIEW when extraction unavailable**

```yaml
- rule_id: "CWS_LIMITED_USE::R3_FALLBACK"
  name: "Data Transfer — Declaration Status Unknown"
  description: "Data transfer detected but store listing unavailable for verification"
  condition: |
    extraction.status != "ok" AND
    signals contains type="DATAFLOW_TRACE"
  verdict: "NEEDS_REVIEW"
  recommended_action: "Review manually — store listing unavailable, cannot verify declarations"
  citations: ["CWS_LIMITED_USE::SECTION_5"]
```

**❌ WRONG: BLOCK without checking extraction status (creates false positives)**

```yaml
# DON'T DO THIS
- rule_id: "BAD_RULE"
  condition: |
    signals contains type="DATAFLOW_TRACE" AND
    declared_data_categories is empty
  verdict: "BLOCK"  # ← Will incorrectly BLOCK when extraction simply failed!
```

---

## Implementation

### File Structure

**Recommendation**: Put governance code under `src/project_atlas/governance/`.

If your repo already uses `src/project_atlas/compliance/`, you can keep it for MVP and rename later. The architecture stays the same.

```
src/project_atlas/
├── governance/                    # NEW: Governance pipeline (Stages 2–8)
│   ├── __init__.py
│   ├── schemas.py
│   ├── scan_artifact.py
│   ├── facts_builder.py
│   ├── evidence_index_builder.py
│   ├── signal_extractor_legacy.py
│   ├── store_listing_extractor.py  # Renamed from disclosure_extractor
│   ├── context_builder.py
│   ├── rules_engine.py
│   ├── report_generator.py
│   ├── citations.yaml
│   └── rulepacks/
│       ├── ENTERPRISE_GOV_BASELINE.yaml
│       └── CWS_LIMITED_USE.yaml
├── workflow/
│   ├── nodes.py
│   ├── graph.py
│   └── state.py
└── api/
    └── main.py
```

### Build Order (Recommended)

1. Lock Schemas (`schemas.py`, `scan_artifact.py`)
2. Citations & Rulepacks (`citations.yaml`, `rulepacks/*.yaml`)
3. Facts Builder
4. Evidence Index Builder
5. Signal Extractor
6. **Store Listing Extractor** (always writes `store_listing.json`)
7. Context Builder
8. Rules Engine (Rule Condition DSL)
9. Decision + Report Generator
10. Workflow Integration
11. API Updates + Bundle Export

### Store Listing Extractor (Stage 5) — Implementation Requirements

The `store_listing_extractor.py` module MUST always produce `/scans/{scan_id}/store_listing.json` with the flattened schema:

| Scenario | `extraction.status` | `declared_*` arrays | `privacy_policy_url/hash` |
|----------|---------------------|---------------------|---------------------------|
| Extraction succeeded | `"ok"` | Populated from store | URL + hash (or null if none) |
| Local CRX/ZIP upload (no store URL) | `"skipped"` | `[]` | `null` |
| Store URL provided but fetch failed | `"failed"` | `[]` | `null` |

**Behavioral contract**:

1. **Always create the file** — even if extraction is skipped or fails.
2. **Status must be explicit** — use exactly one of: `"ok"`, `"skipped"`, `"failed"`.
3. **Reason is required for non-ok status** — explains why extraction didn't succeed.
4. **Flattened schema only** — NO nested `store_listing` object inside the JSON.
5. **Empty arrays when unavailable** — never omit the `declared_*` fields.

### Rulepack Format (YAML) — Governance-first

```yaml
rulepack_id: "ENTERPRISE_GOV_BASELINE"
version: "1.0.0"
name: "Enterprise Governance Baseline"
description: "High-confidence rules to drive ALLOW/BLOCK/REVIEW decisions for IT admins"

rules:
  - rule_id: "ENTERPRISE_GOV_BASELINE::R1"
    name: "Excessive Host Permissions"
    description: "Wildcard host permissions require strong justification"
    condition: |
      facts.host_access_patterns contains "<all_urls>" OR
      facts.host_access_patterns contains "*://*/*"
    verdict: "NEEDS_REVIEW"
    recommended_action: "Require justification + security review before allowing"
    citations: ["ENTERPRISE_GOV_BASELINE::GUIDE_1"]

  - rule_id: "ENTERPRISE_GOV_BASELINE::R2"
    name: "High-Confidence Malicious Pattern"
    description: "Confirmed data exfiltration pattern with verified store listing"
    condition: |
      extraction.status == "ok" AND
      signals contains type="DATAFLOW_TRACE" AND
      declared_data_categories is empty
    verdict: "BLOCK"
    recommended_action: "Block org-wide — confirmed data transfer with no declaration"
    citations: ["ENTERPRISE_GOV_BASELINE::GUIDE_2"]
```

**MVP Rulepacks**:
- `ENTERPRISE_GOV_BASELINE.yaml` (10-ish rules)
- `CWS_LIMITED_USE.yaml` (10-ish rules)
- Optional add-on packs later (Appendix)

### Citations Format (YAML)

```yaml
citations:
  - citation_id: "CWS_LIMITED_USE::SECTION_3"
    title: "Chrome Web Store Limited Use Policy - Permissions"
    short_snippet: "Extensions must request only the minimum permissions necessary..."
    source_url: "https://developer.chrome.com/docs/webstore/program-policies/limited-use/"
    retrieved_at: "2026-01-22T10:00:00Z"

  - citation_id: "ENTERPRISE_GOV_BASELINE::GUIDE_1"
    title: "Enterprise Extension Governance Guidance"
    short_snippet: "Broad host permissions increase risk and must be justified and reviewed."
    source_url: "internal://enterprise_gov_baseline"
    retrieved_at: "2026-01-22T10:00:00Z"
```

---

## API Reference

### Modified Endpoints

**`GET /api/scan/results/{scan_id}`**  
Returns structured `report.json`.

**`GET /api/scan/report/{scan_id}`**  
Returns HTML report.

### New Endpoint

**`GET /api/scan/enforcement_bundle/{scan_id}`**  
Generates and exports complete enforcement bundle (ZIP) **on-demand** (not stored in the scan directory).

**Bundle Contents**:

```
enforcement_bundle.zip
├── report.json             # Full governance report (includes embedded store_listing)
├── report.html             # Human-readable HTML report
├── store_listing.json      # Standalone store listing (flattened schema)
├── facts.json              # Canonical facts
├── evidence_index.json     # Evidence references
├── signals.json            # Extracted signals
├── context.json            # Evaluation context
├── rule_results.json       # Individual rule verdicts
├── rulepacks_applied.json  # Rulepack metadata (id, version, content_hash)
└── citations_resolved.yaml # Citations referenced by triggered rules
```

**rulepacks_applied.json** (for reproducibility):

```json
{
  "rulepacks": [
    {
      "rulepack_id": "ENTERPRISE_GOV_BASELINE",
      "version": "1.0.0",
      "content_hash": "sha256:abc123..."
    },
    {
      "rulepack_id": "CWS_LIMITED_USE",
      "version": "1.0.0",
      "content_hash": "sha256:def456..."
    }
  ],
  "evaluated_at": "2026-01-22T10:00:00Z"
}
```

> 📌 `store_listing.json` is included both embedded in `report.json` AND as a standalone file for consumers who need only the store listing data.  
> 📌 `rulepacks_applied.json` enables audit reproducibility — re-run the same rulepacks to verify the decision.

---

## Key Architecture Decisions

1. **Keep existing security analyzers unchanged**
2. **Minimal v0 schemas**
3. **Scan artifact directory per scan**
4. **Reuse endpoints; add only bundle export**
5. **Dataflow minimal correlations** (2–3 strong traces)
6. **Manual citations for MVP**
7. **Default rulepacks (v1)**: `ENTERPRISE_GOV_BASELINE` + `CWS_LIMITED_USE`
8. **Store listing extractor**: fetch is optional, but `store_listing.json` is **always created** with `extraction.status` (ok/skipped/failed)
9. **Flattened store_listing.json schema**: NO nested `store_listing` object; `declared_*` fields and `extraction` are top-level
10. **Rule DSL paths reference top-level fields**: `extraction.status`, `declared_data_categories`, etc. (not `store_listing.declared_*`)
11. **BLOCK rules MUST check `extraction.status == "ok"`** for listing-dependent conditions
12. **Rules Engine validates BLOCK rules** at load time: reject rules referencing `declared_*` without `extraction.status == "ok"`
13. **report.json embeds full store_listing** object including `extraction.status`
14. **Enforcement bundle includes `rulepacks_applied.json`** with version + content_hash for reproducibility

---

## MVP Definition (Clean Finish Line)

🎯 **MVP Goal**: An IT admin can paste an extension URL and get an ALLOW/BLOCK/NEEDS_REVIEW decision with evidence they can act on.

### MVP Complete When

- ✅ facts/evidence/signals/context/rules all generated into `/scans/{scan_id}/`
- ✅ deterministic Rules Engine + tested DSL
- ✅ `report.json` with top-level decision
- ✅ `report.html` that drills Decision → Rule → Evidence → Citation
- ✅ enforcement bundle ZIP endpoint
- ✅ default rulepacks: `ENTERPRISE_GOV_BASELINE` + `CWS_LIMITED_USE`
- ✅ `store_listing.json` always present with flattened schema (no nested `store_listing` object)
- ✅ `store_listing.json` includes `extraction.status` (ok/skipped/failed) in all cases
- ✅ Rule DSL paths use top-level fields: `declared_data_categories`, not `store_listing.declared_*`
- ✅ `report.json` embeds full store_listing object including `extraction.status`
- ✅ BLOCK rules check `extraction.status == "ok"` before issuing verdict

### Required Unit Tests

**1. store_listing_extractor tests** (`tests/governance/test_store_listing_extractor.py`):

| Test Case | Expected Behavior |
|-----------|-------------------|
| `test_extraction_ok` | When extraction succeeds: `status == "ok"`, `extracted_at` is non-null, `declared_*` arrays populated |
| `test_extraction_skipped` | When source is local CRX/ZIP: `status == "skipped"`, `declared_*` arrays empty, `privacy_policy_url` is `null` |
| `test_extraction_failed` | When fetch fails: `status == "failed"`, `declared_*` arrays empty, `privacy_policy_url` is `null`, `reason` is populated |
| `test_schema_is_flattened` | Output has NO nested `store_listing` object; `declared_data_categories` is at top level |

**2. Rules Engine DSL tests** (`tests/governance/test_rules_engine.py`):

| Test Case | Expected Behavior |
|-----------|-------------------|
| `test_block_requires_extraction_ok` | If `extraction.status != "ok"`, listing-dependent rule MUST NOT produce `BLOCK` |
| `test_fallback_to_needs_review` | If `extraction.status == "skipped"` and DATAFLOW_TRACE present, fallback rule produces `NEEDS_REVIEW` |
| `test_block_when_ok_and_empty_categories` | If `extraction.status == "ok"` AND `declared_data_categories` is empty AND DATAFLOW_TRACE present, BLOCK triggers |
| `test_dsl_accesses_top_level_fields` | DSL condition `declared_data_categories is empty` evaluates correctly (no `store_listing.` prefix needed) |

### Everything Else is Phase 2

- Continuous monitoring (moat)
- Full taint analysis
- Bulk auditing + dashboards
- Admin console integrations
- Policy packs (Appendix)

---

## Questions & Answers

**Q: Should we refactor existing security analyzers?**  
✅ No. Treat them as the signal source.

**Q: Why ALLOW/BLOCK instead of PASS/FAIL?**  
✅ IT admins enforce allow/block policy. Use their language.

**Q: What rulepacks ship in v1?**  
✅ `ENTERPRISE_GOV_BASELINE` + `CWS_LIMITED_USE`.

**Q: Where do DPDP/GDPR/CCPA fit?**  
✅ Optional add-on packs (Appendix), after initial traction/pilots.

**Q: What if store listing extraction fails?**  
✅ `store_listing.json` is created with `extraction.status: "failed"`. Rules that depend on store listing data fall back to `NEEDS_REVIEW`, never `BLOCK`.

**Q: Why not just use "empty" to mean "unavailable"?**  
✅ Because `empty` is ambiguous — it could mean "we fetched and found nothing declared" (legitimate BLOCK trigger) vs. "we couldn't fetch at all" (should NOT trigger BLOCK). The `extraction.status` field disambiguates.

---

<p align="center">
  <strong>TL;DR: We're building a governance workflow, not a scanner.</strong>
</p>

---

## Appendix A: Optional Policy Packs (Compliance + Controls Mapping)

These packs are **not the v1 default**. They are modules you can enable per customer or region once governance v1 is working and you have early traction.

### A1) When to Enable Policy Packs

Enable only when:

- Customer explicitly requests compliance/controls mapping
- Customer is in regulated procurement/audit flow
- You already have high-confidence evidence/signal coverage (avoid false-positive claims)

### A2) DPDP Pack Example (India) — Optional

**context.json (when DPDP pack enabled)**:

```json
{
  "context": {
    "regions_in_scope": ["IN"],
    "rulepacks": ["ENTERPRISE_GOV_BASELINE", "CWS_LIMITED_USE", "DPDP_RISK_INDICATORS"],
    "domain_categories": ["general"],
    "cross_border_risk": true
  }
}
```

> 📌 `regions_in_scope: ["IN"]` is a configuration label to select India-relevant policy packs, not a legal jurisdiction determination.

**DPDP rule_results example (only when pack enabled)**:

```json
{
  "rule_id": "DPDP_RISK_INDICATORS::R1",
  "rulepack": "DPDP_RISK_INDICATORS",
  "verdict": "NEEDS_REVIEW",
  "confidence": 0.85,
  "evidence_refs": ["ev_001"],
  "citations": ["IN_DPDP_ACT_2023::S5"],
  "explanation": "Potential personal-data transfer indicator detected via external endpoint. Verify lawful basis and required declarations.",
  "recommended_action": "Escalate to legal/compliance for DPDP posture review"
}
```

**DPDP citations.yaml entry (placeholder)**:

```yaml
- citation_id: "IN_DPDP_ACT_2023::S5"
  title: "DPDP Act 2023 - Section 5"
  short_snippet: "Process personal data only for lawful purposes..."
  source_url: "https://..."
  retrieved_at: "2026-01-22T10:00:00Z"
```

### A3) Policy Pack Taxonomy (Complete)

**Phase 2: Privacy Indicator Packs** (optional add-on):

| Pack ID | Purpose |
|---------|---------|
| `GDPR_INDICATORS` | GDPR-relevant risk indicators |
| `CCPA_INDICATORS` | CCPA-relevant risk indicators |
| `DPDP_RISK_INDICATORS` | India DPDP-relevant risk indicators |

**Phase 3: Controls Mapping Packs** (optional add-on):

| Pack ID | Purpose |
|---------|---------|
| `SOC2_MAPPING` | SOC 2 control evidence mapping |
| `ISO27001_MAPPING` | ISO 27001 control evidence mapping |
| `NIST_MAPPING` | NIST framework control mapping |
| `CIS_MAPPING` | CIS Controls mapping |

> ⚠️ **Important**: These packs provide **indicators** and **controls mapping**, not automatic legal compliance or certification. They surface evidence for human review and audit trails.

---

<p align="center">
  <sub>
    Output = ALLOW/BLOCK + rationale + evidence, shaped for IT admins.<br/>
    Deterministic rules. Continuous monitoring. Policy packs for revenue expansion.<br/>
    "Explainable, repeatable, defensible" beats "LLM vibes."
  </sub>
</p>
