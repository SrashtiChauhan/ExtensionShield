# Security

## Reporting vulnerabilities

If you discover a security vulnerability in ExtensionShield, please report it responsibly:

- **Do not** open a public GitHub issue for security vulnerabilities.
- Email the maintainer (see [README](../README.md) for contact) with a description and steps to reproduce, or open a private security advisory on GitHub if the repo supports it.

We will acknowledge receipt and work on a fix. Thank you for helping keep the project secure.

---

## Best practices for contributors and deployers

- **Never commit secrets.** Do not put API keys, passwords, or tokens in the repository. Use `.env` for local development and set environment variables in your hosting dashboard for production. `.env` and `.env.*` are in `.gitignore`; only `.env.example` and `env.production.template` (with placeholders) are committed.
- **Use the example files as templates.** Copy `.env.example` or `env.production.template` to `.env`, then fill in real values only in `.env`. Never paste real keys into the example/template files.
- **Rotate keys if exposed.** If you accidentally commit or expose a key, rotate it immediately in the provider’s dashboard and ensure the exposed key is removed from history (e.g. with `git filter-repo` or BFG Repo-Cleaner) before pushing again.
- **Frontend env:** The frontend uses `VITE_*` variables; create `frontend/.env` from `frontend/.env.example` and add your Supabase URL and anon key there. Do not commit `frontend/.env`.
