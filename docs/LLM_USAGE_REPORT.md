# LLM Usage Report - ExtensionShield

This report documents where LLMs are currently used to generate text, how prompts are managed, and what data is fed into LLM calls. It also highlights gaps and the best places to plug in a future chatbot that needs rich context while keeping the UI minimal.

## Executive Summary
- LLM text generation is server-side only, used in 4 places: permissions analysis, webstore reputation analysis, SAST summary, and executive summary.
- Prompts are defined in YAML files under `src/extension_shield/llm/prompts` and loaded via a small prompt loader (`get_prompts`).
- Provider selection + fallback is centralized in `src/extension_shield/llm/clients` and `src/extension_shield/llm/clients/fallback.py`.
- The frontend contains a GPT-OSS service stub, but the backend does **not** implement the referenced API endpoints.
- For a future chatbot, the richest structured context already exists in the governance pipeline (`FactsBuilder` + `SignalPackBuilder`) and can be used to build a compact, UI-friendly prompt input.

## 1. LLM Entry Points (Text Generation)

### 1.1 Permissions Analysis (Per-Permission Reasonableness)
- **File**: `src/extension_shield/core/analyzers/permissions.py`
- **Prompt**: `src/extension_shield/llm/prompts/permission_analysis.yaml`
- **Output**: JSON (permission_name, justification_reasoning, is_reasonable)
- **Provider**: `get_chat_llm_client()` (no fallback chain used here)
- **Model**: `LLM_MODEL` (default: `rits/openai/gpt-oss-20b`)
- **Context fed in**:
  - Extension name + description
  - Permission name, description, capabilities
  - Permissions DB entries from `src/extension_shield/data/permissions_db.json`

### 1.2 Webstore Reputation Risk (LLM Summary)
- **File**: `src/extension_shield/core/analyzers/webstore.py`
- **Prompt**: `src/extension_shield/llm/prompts/webstore_analysis.yaml`
- **Output**: JSON (risk_summary, risk_level), then formatted to a human-readable string
- **Provider**: `invoke_with_fallback()` (multi-provider chain)
- **Model**: `LLM_MODEL` (default: `rits/openai/gpt-oss-20b`)
- **Context fed in**:
  - Chrome Web Store metadata (users, rating, last updated, developer info, badges)
  - Heuristic red flags computed from metadata

### 1.3 SAST Findings Summary (LLM Text)
- **File**: `src/extension_shield/core/analyzers/sast.py`
- **Prompt**: `src/extension_shield/llm/prompts/sast_analysis.yaml`
- **Output**: Freeform text summary starting with `[RISK: LOW/MEDIUM/HIGH]`
- **Provider**: `invoke_with_fallback()`
- **Model**: `LLM_MODEL` (default: `meta-llama/llama-3-3-70b-instruct`)
- **Context fed in**:
  - Finding counts by severity
  - Top N formatted findings (file, line, severity, category)
  - Files scanned + files with findings

### 1.4 Executive Summary (LLM JSON)
- **File**: `src/extension_shield/core/summary_generator.py`
- **Prompt**: `src/extension_shield/llm/prompts/summary_generation.yaml`
- **Output**: JSON (summary, overall_risk_level, key_findings, recommendations)
- **Provider**: `invoke_with_fallback()`
- **Model**: `LLM_MODEL` (default: `rits/openai/gpt-oss-120b`)
- **Context fed in**:
  - Permissions analysis (string summary + host permissions summary)
  - Webstore analysis (LLM output from 1.2)
  - SAST analysis (LLM output from 1.3)
  - Manifest info: name, description, version

### 1.5 Downstream Use of LLM Text (Non-generation)
- **File**: `src/extension_shield/governance/facts_builder.py`
- **Behavior**: If `sast_risk_level` is missing, it parses the LLM SAST summary text for `[RISK: ...]` tags.
- **Impact**: LLM output subtly affects governance facts if structured fields are missing.

## 2. Prompt "Service" and Templates

### 2.1 Prompt Storage
- **Directory**: `src/extension_shield/llm/prompts/`
- **Files**:
  - `permission_analysis.yaml`
  - `webstore_analysis.yaml`
  - `sast_analysis.yaml`
  - `summary_generation.yaml`

### 2.2 Prompt Loader
- **File**: `src/extension_shield/llm/prompts/__init__.py`
- **Function**: `get_prompts(prompt_file: str | None) -> Dict[str, Any]`
- **Behavior**:
  - Loads one YAML file when `prompt_file` is provided.
  - Loads all YAML prompts when called without an argument.

### 2.3 Prompt Template Contract
- **File**: `contracts/llm_prompt_template.yaml`
- **Purpose**: A template contract for writing new prompts with structured outputs.
- **Note**: The README references `docs/LLM_CONFIGURATION.md`, but this file is currently missing.

## 3. Provider Selection + Fallback (LLM Runtime)

### 3.1 Provider Types
- **File**: `src/extension_shield/llm/clients/provider_type.py`
- **Supported**: `watsonx` (default), `openai`, `rits`

### 3.2 Client Factory
- **File**: `src/extension_shield/llm/clients/__init__.py`
- **Function**: `get_chat_llm_client()`
- **LangChain Clients**:
  - `ChatWatsonx` (WatsonX / IBM) - Default
  - `ChatOpenAI` (OpenAI + RITS)

### 3.3 Fallback Chain
- **File**: `src/extension_shield/llm/clients/fallback.py`
- **Function**: `invoke_with_fallback()` tries providers in `LLM_FALLBACK_CHAIN`
- **Defaults**:
  - If no chain/provider is set, defaults to `watsonx,openai`
  - Timeout is `LLM_TIMEOUT_SECONDS` (default 25s)
  - Retries per provider: `LLM_MAX_RETRIES_PER_PROVIDER` (default 1)

### 3.4 Environment Configuration
- **Template**: `env.production.template`
- **Variables**:
  - `LLM_PROVIDER`, `LLM_PROVIDER_PRIMARY`
  - `LLM_FALLBACK_CHAIN` (default: `watsonx,openai`)
  - `LLM_MODEL`
  - Provider-specific keys (WatsonX, OpenAI, RITS)

## 4. Frontend LLM Hooks (Not Wired End-to-End)

### 4.1 GPT-OSS Service Stub
- **File**: `frontend/src/services/gptOssService.js`
- **Expected Endpoints**:
  - `/api/analyze/file`
  - `/api/upload/file`
  - `/api/providers/status`
  - `/api/config`
- **Current Status**: No matching backend endpoints exist in `src/extension_shield/api/main.py`.
- **UI Usage**:
  - `ScanResultsPage.jsx` and `DashboardPage.jsx` show alert placeholders for “AI Analysis”

## 5. Data Points Available for a Future Chatbot

If you want a visual, low-clutter prompt input that still uses deep context, the best source of structured context is already built:

### 5.1 Canonical Facts (Great for Chat Context)
- **File**: `src/extension_shield/governance/facts_builder.py`
- **Contains**:
  - Manifest facts (permissions, host access, content scripts, CSP, etc.)
  - Host access patterns (consolidated)
  - File inventory
  - Security findings (SAST, VirusTotal, entropy)
  - Extension metadata (store info)

### 5.2 Normalized Signal Pack (Compact + Evidence)
- **File**: `src/extension_shield/governance/tool_adapters.py`
- **Builder**: `SignalPackBuilder` used in API pipeline
- **Normalizes**:
  - SAST findings, VirusTotal results, entropy analysis
  - Webstore stats + reviews
  - Permissions analysis
  - ChromeStats behavioral data
  - Network signals + evidence references

### 5.3 Executive Summary (User-Friendly Text)
- **File**: `src/extension_shield/core/summary_generator.py`
- **Output**: JSON summary + key findings + recommendations, ready for a simplified UI

## 6. Gaps to Address Before Chatbot Integration

1. **Backend API endpoints for GPT-OSS are missing**  
   The frontend expects `/api/analyze/file` and `/api/providers/status`, but the API does not expose them yet.

2. **No dedicated prompt orchestration service**  
   Prompts are YAML files loaded inline in each analyzer. There is no centralized prompt registry or versioning system.

3. **Missing LLM configuration doc**  
   `docs/README.md` references `docs/LLM_CONFIGURATION.md`, which is currently absent.

## 7. Recommended Insertion Points for a Minimal, Visual Prompt UI

If your UI needs a small prompt box but rich context:

1. **Build a “Chat Context” payload** from:
   - `facts.json` (FactsBuilder)
   - `signal_pack` (SignalPackBuilder)
   - `executive_summary`

2. **Expose a single API endpoint** like `/api/chat/context/{extension_id}`  
   It can return:
   - A compact summary for UI display
   - A full context block for LLM prompt injection

3. **Keep the UI simple**:
   - Prompt input field
   - “Context attached” indicator
   - Optional collapsible “Context Preview” (advanced view only)


