# ExtensionShield Documentation

This directory contains documentation for the ExtensionShield project.

## Documentation index

### Architecture & design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – High-level architecture
- **[SOFTWARE_DOCUMENTATION.md](./SOFTWARE_DOCUMENTATION.md)** – Full software documentation: stack, structure, workflows, environment
- **[design/color-palette.md](./design/color-palette.md)** – Color palette and theme

### Scoring & scan results

- **[SCAN_RESULTS_ARCHITECTURE.md](./SCAN_RESULTS_ARCHITECTURE.md)** – Scan results architecture
- **[SCAN_RESULTS_AND_SCORING_ENGINE.md](./SCAN_RESULTS_AND_SCORING_ENGINE.md)** – Scan results and scoring engine
- **[SCAN_RESULTS_MODAL_DATA_SPEC.md](./SCAN_RESULTS_MODAL_DATA_SPEC.md)** – Modal data spec for scan results
- **[SCORING_ENGINE_AND_WORKFLOW_ANALYSIS.md](./SCORING_ENGINE_AND_WORKFLOW_ANALYSIS.md)** – Scoring engine and workflow analysis
- **[SCORING_WEIGHTS_AND_ANALYSIS.md](./SCORING_WEIGHTS_AND_ANALYSIS.md)** – Scoring weights and analysis
- **[qa_scoring_overrides_and_gates.md](./qa_scoring_overrides_and_gates.md)** – QA scoring overrides and gates
- **[qa_crxplorer_comparison.md](./qa_crxplorer_comparison.md)** – Comparison with Crxplorer

### Security

- **[SECURITY.md](./SECURITY.md)** – Reporting vulnerabilities and secrets best practices

### Other

- **[TYPOGRAPHY.md](./TYPOGRAPHY.md)** – Typography and font tokens
- **[YC_OVERVIEW.md](./YC_OVERVIEW.md)** – YC overview and acknowledgments

### Examples and templates

- **[email-templates/SUPABASE_MAGIC_LINK_BODY.txt](./email-templates/SUPABASE_MAGIC_LINK_BODY.txt)** – Magic link email template for Supabase
- **[ui_payload_examples/](./ui_payload_examples/)** – Example report payloads (e.g. `report_single_domain.json`, `report_all_websites.json`)

---

## Quick reference

- **Setup and run:** See the root [README](../README.md) for quick start, Docker, and frontend configuration.
- **Secrets:** Use `.env.example` and `env.production.template` as templates only; put real keys in `.env` (never committed). See [SECURITY.md](./SECURITY.md).
- **Scoring:** Start with [SCAN_RESULTS_AND_SCORING_ENGINE.md](./SCAN_RESULTS_AND_SCORING_ENGINE.md) and [SCORING_ENGINE_AND_WORKFLOW_ANALYSIS.md](./SCORING_ENGINE_AND_WORKFLOW_ANALYSIS.md).
