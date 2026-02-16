# ExtensionShield Software Documentation

> **Enterprise Chrome Extension Security & Governance Platform**

This document provides comprehensive documentation on how ExtensionShield is built, the technologies used, development workflows, and system architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Backend (Python)](#backend-python)
5. [Frontend (React)](#frontend-react)
6. [Database & Auth](#database--auth)
7. [Build & Development Tools](#build--development-tools)
8. [Docker & Deployment](#docker--deployment)
9. [Key Workflows](#key-workflows)
10. [Environment & Configuration](#environment--configuration)

---

## Overview

ExtensionShield is an enterprise-grade platform for Chrome extension security analysis and governance. It:

- **Analyzes** Chrome extensions from Chrome Web Store URLs or local CRX/ZIP files
- **Scans** for security issues (permissions, SAST, entropy, VirusTotal)
- **Scores** extensions on Security, Privacy, and Governance using a three-layer architecture
- **Reports** detailed findings with consumer insights and compliance status
- **Stores** scan results in SQLite (local) or Supabase Postgres (production)

The project is built on top of [ThreatXtension](https://github.com/barvhaim/ThreatXtension) with significant enhancements.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend Runtime** | Python 3.11+ | Core API, analysis pipeline, workflow orchestration |
| **Package Manager (Python)** | **uv** | Fast, reliable Python dependency management |
| **API Framework** | FastAPI | REST API with OpenAPI docs, async support |
| **ASGI Server** | Uvicorn | Production ASGI server |
| **Frontend Framework** | React 18 | UI components and pages |
| **Build Tool (Frontend)** | Vite 7 | Fast builds, HMR, dev server |
| **Styling** | Tailwind CSS 4, SASS | Utility-first CSS, custom styles |
| **Database (Local)** | SQLite | Local dev and single-instance deployments |
| **Database (Production)** | Supabase (Postgres) | Auth, user data, scan results |
| **Auth** | Supabase Auth | OAuth (Google, GitHub), email/password |
| **Container** | Docker | Multi-stage builds, Railway deployment |
| **Deployment** | Railway | Production hosting |
| **LLM Integration** | LangChain, LangGraph | AI-powered analysis (WatsonX, OpenAI, Ollama) |
| **Static Analysis** | Semgrep | SAST scanning |
| **Threat Intel** | VirusTotal (vt-py) | Malware detection |

---

## Project Structure

```
ExtensionShield/
├── src/                          # Python backend source
│   └── extension_shield/
│       ├── api/                  # FastAPI routes, database, auth
│       │   ├── main.py           # Main API app (~3900 lines)
│       │   ├── database.py       # DB abstraction (SQLite + Supabase)
│       │   └── supabase_auth.py  # JWT validation, user context
│       ├── cli/                  # Command-line interface
│       │   └── main.py           # extension-shield analyze, serve
│       ├── core/                 # Analysis engine
│       │   ├── extension_analyzer.py
│       │   ├── analyzers/        # SAST, permissions, entropy, VirusTotal
│       │   └── report_generator.py
│       ├── scoring/              # Scoring engine (Security, Privacy, Governance)
│       │   ├── engine.py
│       │   ├── gates.py
│       │   └── explain.py
│       ├── workflow/             # LangGraph analysis pipeline
│       │   ├── graph.py
│       │   ├── nodes.py
│       │   └── governance_nodes.py
│       ├── llm/                  # LLM clients (WatsonX, OpenAI, Ollama)
│       └── governance/           # Governance rules, store listing
├── frontend/                     # React application
│   ├── src/
│   │   ├── components/           # Reusable UI (scan, dashboard, hero, etc.)
│   │   ├── pages/                # Route pages (scanner, reports, auth)
│   │   ├── services/             # API clients, Supabase
│   │   ├── context/              # React context (auth, etc.)
│   │   └── lib/                  # Utilities
│   ├── vite.config.js
│   └── package.json
├── supabase/                     # Supabase schema & migrations
│   └── migrations/
├── scripts/                      # Utility scripts (migrations, deploy)
├── tests/                        # Pytest tests
├── docs/                         # Documentation
├── pyproject.toml                # Python deps (uv)
├── uv.lock                       # Locked Python deps
├── Makefile                      # Dev commands
├── Dockerfile                    # Multi-stage Docker build
└── docker-compose.yml
```

---

## Backend (Python)

### uv – Python Package Manager

ExtensionShield uses **uv** (by Astral) for Python dependency management. uv is a fast, Rust-based tool that replaces pip/poetry for installs and virtual environments.

**Key commands:**
```bash
uv sync              # Install deps from pyproject.toml + uv.lock
uv run <command>     # Run command in project venv
```

**Used in Makefile for:**
- `make install` → `uv sync`
- `make api` → `uv run extension-shield serve --reload`
- `make format` → `uv run black .`
- `make lint` → `uv run pylint src/`
- `make test` → `uv run pytest`

**Why uv?**
- Much faster than pip
- Deterministic installs via `uv.lock`
- Compatible with `pyproject.toml` (PEP 517/518)
- Used in Docker builds for reproducible images

### Python Dependencies (pyproject.toml)

| Package | Purpose |
|---------|---------|
| **fastapi** | REST API framework |
| **uvicorn** | ASGI server |
| **langchain**, **langgraph** | LLM orchestration, workflow graphs |
| **langchain-openai**, **langchain-ibm**, **langchain-ollama** | LLM providers |
| **semgrep** | Static analysis (SAST) |
| **vt-py** | VirusTotal API |
| **supabase** | Supabase client |
| **reportlab** | PDF report generation |
| **beautifulsoup4** | HTML/XML parsing |
| **sentry-sdk** | Error monitoring |
| **slowapi** | Rate limiting |
| **fastmcp** | MCP server support |
| **psycopg** | Postgres driver for migrations |

### Backend Entry Points

1. **CLI** (`extension-shield`): Defined in `pyproject.toml`:
   ```toml
   [project.scripts]
   extension-shield = "extension_shield.cli.main:main"
   ```

2. **API Server**: `extension_shield serve` or `uvicorn extension_shield.api.main:app`

3. **Workflow**: LangGraph pipeline in `workflow/graph.py` orchestrates:
   - Download extension
   - Extract & parse manifest
   - Run analyzers (SAST, permissions, entropy, VirusTotal)
   - LLM-based analysis
   - Scoring (Security, Privacy, Governance)
   - Report generation

---

## Frontend (React)

### Stack

- **React 18** – UI
- **Vite 7** – Build tool, dev server, HMR
- **React Router 7** – Client-side routing
- **Tailwind CSS 4** – Styling
- **Radix UI** – Accessible components (Dialog, Dropdown, Select, Tabs, Tooltip)
- **Framer Motion** – Animations
- **Recharts** – Charts
- **Axios** – HTTP
- **@supabase/supabase-js** – Auth and Supabase client

### Structure

```
frontend/src/
├── components/       # Reusable components
│   ├── scan/         # Scanner UI
│   ├── dashboard/    # Dashboard widgets
│   ├── report/       # Report display
│   ├── hero/         # Landing hero
│   └── ui/           # Base UI (Radix primitives)
├── pages/            # Route pages
│   ├── scanner/      # ScannerPage.jsx
│   ├── reports/      # Report views
│   ├── auth/         # Login/signup
│   └── research/     # Research content
├── services/         # API calls, Supabase
├── context/          # Auth context
├── routes/           # Route definitions
└── lib/              # Utils
```

### Vite Configuration

- Proxy `/api` to `http://localhost:8007` in dev
- CSP injection for security
- Sitemap generation on build
- SEO scripts for production checks

### Scripts (package.json)

```bash
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build
npm run test         # Vitest
npm run test:visual  # Playwright visual tests
npm run lint         # ESLint
npm run format       # Prettier
```

---

## Database & Auth

### Storage Backends

| Mode | Backend | Use Case |
|------|---------|----------|
| Local | SQLite | Dev, single-user, Docker demo |
| Production | Supabase (Postgres) | Multi-user, auth, persistence |

Set via `DB_BACKEND=supabase` and Supabase env vars.

### Supabase

- **Auth**: OAuth (Google, GitHub), email/password
- **Postgres**: `scan_results`, user-linked data
- **Migrations**: `supabase/migrations/` + `scripts/run_supabase_migrations.py`

### Auth Flow

1. Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Supabase Auth handles login/signup
3. API validates JWT via `supabase_auth.get_current_user_id`
4. Scans are associated with authenticated users when available

---

## Build & Development Tools

### Makefile

| Command | Action |
|---------|--------|
| `make help` | List all commands |
| `make install` | `uv sync` for Python |
| `make api` | Start FastAPI (port 8007) |
| `make frontend` | Start Vite dev (port 5173) |
| `make build-and-serve` | Build frontend, serve from API |
| `make test` | Pytest |
| `make format` | Black |
| `make lint` | Pylint |
| `make analyze URL=...` | CLI analyze from URL |
| `make docker-build` | Build Docker image |
| `make docker-up` | Run Docker Compose |
| `make migrate` | Run Supabase migrations |
| `make deploy` | Deploy to Railway |

### Pre-commit

- Black, Pylint
- Run with: `make precommit` or `pre-commit run --all-files`

### Node / Root package.json

- Supabase CLI
- Deploy script
- Resend email testing
- DB commands: `db:diff`, `db:push`, `db:pull`, etc.

---

## Docker & Deployment

### Dockerfile (Multi-Stage)

**Stage 1 – Frontend (Node 20):**
- Install frontend deps
- Build Vite bundle
- Output: `frontend/dist`

**Stage 2 – Backend (Python 3.11):**
- Install uv from `ghcr.io/astral-sh/uv`
- `uv sync --frozen --no-dev`
- Copy frontend `dist` to `static/`
- Run `scripts/start_api.sh` (migrations + uvicorn)

### Docker Compose

- Single service: `extension-shield`
- Port 8007
- Volumes: `extensions_storage`, `data`
- Env: `LLM_PROVIDER`, `OPENAI_API_KEY`, `VIRUSTOTAL_API_KEY`, etc.

### Railway Deployment

- `railway up` or `make deploy`
- Env vars set in Railway dashboard
- Build uses Dockerfile

---

## Key Workflows

### Extension Scan Flow

1. User submits Chrome Web Store URL or uploads CRX/ZIP
2. API downloads/extracts extension
3. Workflow runs: manifest parse → analyzers (SAST, permissions, entropy, VirusTotal)
4. LLM analysis (optional, configurable)
5. Scoring engine computes Security, Privacy, Governance scores
6. Report view model + consumer insights generated
7. Results stored in DB and returned to frontend

### Scoring (V2)

- **Signals** – Raw findings (e.g. permission risks, SAST issues)
- **Scoring** – Maps signals to Security, Privacy, Governance scores
- **Governance** – Policy gates (e.g. “block if score < threshold”)

See `docs/SCORING_WEIGHTS_AND_ANALYSIS.md` for weights and analysis.

### LLM Configuration

- Providers: WatsonX (default), OpenAI, Ollama, RITS
- Env vars: `LLM_PROVIDER`, `OPENAI_API_KEY`, etc.
- See `docs/LLM_CONFIGURATION.md` (if present) for setup

---

## Environment & Configuration

### Backend (.env)

```bash
# Required for scans
OPENAI_API_KEY=...           # If using OpenAI
LLM_PROVIDER=openai          # openai | watsonx | ollama | rits

# Optional
VIRUSTOTAL_API_KEY=...       # VirusTotal integration
DB_BACKEND=supabase          # Use Supabase (default: sqlite)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

### Frontend (frontend/.env)

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=...        # Optional, for prod API URL
```

### Ports

| Port | Service |
|------|---------|
| 8007 | FastAPI API (+ static in production) |
| 5173 | Vite dev server |

---

## Quick Reference

### Local Development

```bash
make install                    # Python deps (uv)
cd frontend && npm install      # Frontend deps
# Configure frontend/.env with Supabase
make api                        # Terminal 1
make frontend                   # Terminal 2
# App: http://localhost:5173
# API: http://localhost:8007
```

### Production-like Local

```bash
make build-and-serve
# Full app at http://localhost:8007
```

### Docker

```bash
cp env.production.template .env
# Edit .env (OPENAI_API_KEY, etc.)
docker compose up --build
# http://localhost:8007
```

---

## Additional Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](README.md) | Documentation index |
| [docs/SECURITY.md](SECURITY.md) | Security operations |
| [docs/AUTHENTICATION.md](AUTHENTICATION.md) | Auth setup |
| [docs/SCORING_WEIGHTS_AND_ANALYSIS.md](SCORING_WEIGHTS_AND_ANALYSIS.md) | Scoring design |
| [docs/PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) | Deployment guide |
| [AGENTS.md](../AGENTS.md) | AI/agent coding guidelines |
| http://localhost:8007/docs | API docs (when running) |

---

*Last updated: February 2025*
