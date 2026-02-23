# Magic Link: Supabase + Resend Checklist

Use this when **Resend works** (Step 1 of debug passes) but **Supabase returns 500** (Step 2 fails). The magic link email is sent by **Supabase** using **Resend via SMTP** — so Supabase must have the correct SMTP and sender.

## Set SMTP from CLI (optional)

If you have a **Supabase Personal Access Token** (create at [Account → Tokens](https://supabase.com/dashboard/account/tokens)):

1. Add to root `.env`: `SUPABASE_ACCESS_TOKEN=sbp_xxxx`
2. Run: `node scripts/supabase-set-smtp.mjs`

This PATCHes the project's auth config with Resend SMTP (host, port, user, password, sender) using `RESEND_API_KEY` and sender `noreply@extensionshield.com` from the script. Then run the debug again.

---

## 1. Supabase → Authentication → **Providers** → **Email**

- [ ] **Enable Email provider** is **ON**.
- [ ] (Optional) **Confirm email** can be ON or OFF; magic link works either way.

---

## 2. Supabase → Authentication → **Emails** → **SMTP Settings** tab

- [ ] **Enable Custom SMTP** is **ON** (toggle on).
- [ ] **Sender email:** `noreply@extensionshield.com` (must be from a **verified** domain in Resend).
- [ ] **Sender name:** e.g. `ExtensionShield`.
- [ ] **Host:** `smtp.resend.com` (exactly).
- [ ] **Port:** `465` (number, not 587).
- [ ] **Username:** `resend` (lowercase).
- [ ] **Password:** Your Resend API key (e.g. `re_FpP8icvm_...` — same as in root `.env`). No spaces; copy-paste.
- [ ] Click **Save** and wait for “Settings saved” or similar.

**Common mistakes:** Wrong port (use 465), wrong username (must be `resend`), sender from `onboarding@resend.dev` (use your verified domain), typo in API key.

---

## 3. Supabase → Authentication → **URL Configuration**

- [ ] **Redirect URLs** includes:
  - `http://localhost:5174/**`
  - `http://localhost:5174/`
  - For prod: `https://extensionshield.com/**` and `https://extensionshield.com/auth/callback`
- [ ] **Site URL:** For local testing use `http://localhost:5174` (no trailing slash). For prod use `https://extensionshield.com`.

---

## 4. Supabase → Authentication → **Emails** → **Templates** tab

- [ ] Open the **Magic link** template.
- [ ] Ensure it has a valid confirmation URL variable (e.g. `{{ .ConfirmationURL }}` or what Supabase shows). No broken or unclosed `{{ }}`.
- [ ] If you edited it, try **Restore default** and save, then test again.

---

## 5. Get the exact error (Auth logs)

After triggering a magic link (from the app or `node scripts/check-magic-link.mjs snorzang65@gmail.com http://localhost:5174/`):

1. **Supabase** → **Logs** → **Log Explorer** (or **Auth** logs).
2. Set time range to **last 5–10 minutes**.
3. Filter by **path** containing `otp` or **status** `500` or level **error**.
4. Open the log entry for the failed request — the **message** will say whether it’s SMTP connection, auth failure, or invalid sender.

Use that message to fix the SMTP or template step above.

---

## Quick test (from project root)

```bash
node scripts/debug-magic-link.mjs snorzang65@gmail.com http://localhost:5174/
```

- **Step 1 (Resend):** Should pass — you receive a test email.
- **Step 2 (Supabase):** Should pass after SMTP/sender/URL/template are correct — then check inbox for the magic link.

---

## Summary

| Where              | What to check |
|--------------------|----------------|
| **Resend**         | Domain verified, API key works (Step 1 passes). |
| **Supabase SMTP**  | Custom SMTP ON, Host/Port/User/Password correct, **Sender = noreply@extensionshield.com**. |
| **Supabase URLs**  | Redirect URLs include your app URL; Site URL matches environment. |
| **Supabase template** | Magic link template has valid confirmation URL variable. |
| **Auth logs**      | After a failed attempt, read the 500/error log for the exact cause. |
