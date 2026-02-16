# ExtensionShield Documentation

This directory contains comprehensive documentation for the ExtensionShield project.

## 📚 Documentation Index

### Software & Architecture

- **[SOFTWARE_DOCUMENTATION.md](./SOFTWARE_DOCUMENTATION.md)** - **Full software documentation** ⭐
  - How ExtensionShield is built end-to-end
  - Technology stack (uv, FastAPI, React, Vite, Supabase, Docker)
  - Project structure and key components
  - Build tools, development workflow, deployment
  - Environment configuration

### Authentication & Security

- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Complete authentication guide
  - OAuth flows (Google, GitHub)
  - Email/password authentication
  - Session management
  - Security hardening (production safety, tab isolation, input validation)
  - Testing and diagnostics
  - Supabase configuration
  - Troubleshooting

### Security

- **[SECURITY.md](./SECURITY.md)** - Security operations guide
  - Environment variables management
  - Secrets handling
  - Key rotation procedures
  - Git history cleanup

- **[SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)** - Security audit findings
  - Security posture assessment
  - Vulnerability analysis
  - Recommendations and fixes
  - Quick wins checklist

- **[COMPREHENSIVE_SECURITY_REPORT.md](./COMPREHENSIVE_SECURITY_REPORT.md)** - Security fixes completion status
  - Audit completion tracking
  - Fixes applied and verified
  - Production hardening checklist
  - Security rating progression

- **[CSP_SECURITY_GUIDE.md](./CSP_SECURITY_GUIDE.md)** - Content Security Policy guide
  - CSP implementation details
  - Production CSP configuration
  - Troubleshooting CSP violations
  - Deployment and verification steps

### Core Systems

- **[scoring_v2_design.md](./scoring_v2_design.md)** - Scoring V2 architecture design ⭐
  - **IMPORTANT:** Core scoring engine design document
  - Three-layer architecture (Signals → Scoring → Governance)
  - Security, Privacy, and Governance scores
  - Implementation plan and migration strategy
  - Current state analysis

- **[LLM_CONFIGURATION.md](./LLM_CONFIGURATION.md)** - LLM Provider Configuration Guide ⭐
  - Complete guide for configuring LLM providers
  - Currently supported: WatsonX (default), OpenAI, RITS
  - Step-by-step setup instructions for each provider
  - How to add new LLM providers (Anthropic, Gemini, etc.)
  - Troubleshooting and migration guides

- **[WATSONX_SETUP_GUIDE.md](./WATSONX_SETUP_GUIDE.md)** - WatsonX Setup & Troubleshooting ⚠️
  - **IMPORTANT**: Detailed guide for WatsonX configuration
  - What's implemented vs what's missing
  - Step-by-step IBM Cloud setup (more complex than OpenAI)
  - Common errors and fixes
  - Testing and verification steps
  - Comparison with OpenAI setup (why WatsonX needs extra steps)

### Development & CI

- **[pre-push-checks.md](./pre-push-checks.md)** – Pre-push and CI checks
  - Run `npm run ci:check` in `frontend/` to match Security Audit + SEO Smoke Test
  - Commands for build, audit, and SEO tests

### Design & theme

- **[design/color-palette.md](./design/color-palette.md)** – Color palette and theme
  - Green theme and extension logo (ShieldLogo)
  - Whether we introduce many colors (controlled palette)
  - Current background and optional lighter dark (`data-theme="dark-lighter"`)
  - Concept palettes and accessibility notes

### Database & API

- **[DATABASE_README.md](./DATABASE_README.md)** - Database schema, SQLite ↔ Postgres mapping, API routes
  - Single source of truth: `supabase/migrations/` for Postgres
  - Schema mapping (timestamp → scanned_at, icon_path, risk_level, etc.)
  - Which API routes use which tables
  - Env vars for dev / staging / prod

- **[API_AND_SUPABASE_IMPLEMENTATION.md](./API_AND_SUPABASE_IMPLEMENTATION.md)** - What is implemented on prod (Supabase config, Task 1: User login & Get Two scans, full API list, data flow)

---

## Quick Reference

### For Authentication Setup
1. Read [AUTHENTICATION.md](./AUTHENTICATION.md) - Complete guide covering flows, security, testing, and configuration

### For Security Hardening
1. Review [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md) for audit findings
2. Check [COMPREHENSIVE_SECURITY_REPORT.md](./COMPREHENSIVE_SECURITY_REPORT.md) for fixes status
3. Follow [SECURITY.md](./SECURITY.md) for operational security
4. Review [CSP_SECURITY_GUIDE.md](./CSP_SECURITY_GUIDE.md) for CSP configuration
5. Check [AUTH_SECURITY_HARDENING.md](./AUTH_SECURITY_HARDENING.md) for auth-specific hardening

### For Scoring System
1. **Read [scoring_v2_design.md](./scoring_v2_design.md)** - Core architecture document
2. Understand the three-layer scoring system
3. Review implementation plan and migration strategy

### For LLM Configuration
1. **Read [LLM_CONFIGURATION.md](./LLM_CONFIGURATION.md)** - Complete LLM setup guide
2. **For WatsonX specifically**: Read [WATSONX_SETUP_GUIDE.md](./WATSONX_SETUP_GUIDE.md) - Detailed WatsonX setup (more complex than OpenAI)
3. Choose a provider (WatsonX is default, or OpenAI, RITS)
4. Configure environment variables
5. See troubleshooting section if issues arise

---

## Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| AUTHENTICATION.md | ✅ Complete | Consolidated (all auth docs) |
| SECURITY.md | ✅ Complete | Current |
| SECURITY_AUDIT_REPORT.md | ✅ Complete | 2025-01-30 |
| COMPREHENSIVE_SECURITY_REPORT.md | ✅ Complete | Current |
| CSP_SECURITY_GUIDE.md | ✅ Complete | Current |
| scoring_v2_design.md | ✅ Complete | 2026-02-03 |
| LLM_CONFIGURATION.md | ✅ Complete | 2025-01-30 |
| WATSONX_SETUP_GUIDE.md | ✅ Complete | 2025-01-30 |

---

## Notes

- **scoring_v2_design.md** is a critical document for understanding the scoring architecture
- **AUTHENTICATION.md** is a consolidated guide covering all authentication topics (flows, security, testing, diagnostics)
- **SECURITY_AUDIT_REPORT.md** contains audit findings and recommendations
- **COMPREHENSIVE_SECURITY_REPORT.md** tracks completion status of security fixes
- **CSP_SECURITY_GUIDE.md** provides detailed CSP implementation and troubleshooting
- **LLM_CONFIGURATION.md** provides comprehensive guide for configuring and switching between LLM providers
- **WATSONX_SETUP_GUIDE.md** provides detailed setup instructions for WatsonX (more complex than OpenAI, requires IBM Cloud account and service setup)
- Database schema and migrations are documented in [DATABASE_README.md](./DATABASE_README.md); Postgres migrations live in `supabase/migrations/`

