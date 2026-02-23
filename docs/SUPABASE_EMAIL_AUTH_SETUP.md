# Supabase Email Auth: Why Confirmation Emails Don't Arrive & How to Fix

If you sign up with email and see "Please check your email to confirm your account" but **never receive the email in Gmail** (or any inbox), this guide explains the cause and how to fix it.

---

## Email sign-in checklist (Supabase Dashboard)

To make sure users can **sign up and sign in with email** correctly:

| # | Where in Supabase | What to check |
|---|-------------------|----------------|
| 1 | **Authentication** → **Providers** → **Email** | **Enable Email provider** = ON. **Confirm email** = ON (so new users must click the link before signing in). |
| 2 | **Authentication** → **Emails** → **SMTP Settings** tab | **Custom SMTP** enabled and filled (e.g. Resend: host `smtp.resend.com`, port `465`, username `resend`, password = Resend API key, sender = verified address). Without this, confirmation emails do not reach Gmail. |
| 3 | **Authentication** → **Emails** → **Templates** | The **Confirm sign up** template is the one used for new sign-ups. You can leave the default or edit the text; no need to enable/disable it. |
| 4 | **Authentication** → **URL Configuration** | **Site URL** = your app URL (e.g. `https://extensionshield.com`). **Redirect URLs** includes e.g. `https://extensionshield.com/**` and `https://extensionshield.com/auth/callback`. |

The **Security** notifications (e.g. "Password changed", "Email address changed") under Emails are optional. They do **not** affect sign-up or sign-in; they only notify users after a change. You can leave them off.

---

## Root Cause: Supabase's Default Email Provider

Supabase's **built-in SMTP is for demonstration only** and has strict limits:

| Limitation | Details |
|-----------|---------|
| **Pre-authorized only** | Without custom SMTP, Supabase sends emails **only** to addresses in your [ organization Team ](https://supabase.com/dashboard/org/_/team). Your personal Gmail is not on that list. |
| **Rate limit** | ~2 messages per hour (can change without notice) |
| **Delivery** | No SLA; Gmail often blocks or quarantines emails from `supabase.io` |

**You need custom SMTP** for confirmation emails to reach real users (including your own Gmail).

---

## Fix: Configure Custom SMTP (Resend)

[Resend](https://resend.com) has a free tier and works well with Supabase. Follow these steps:

### 1. Create Resend Account & API Key

1. Go to [resend.com](https://resend.com) and sign up
2. **API Keys** → Create API Key → copy it
3. **Domains** → Add your domain (e.g. `extensionshield.com`) and verify it (add DNS records they provide)

   - For testing without a domain, Resend offers `onboarding@resend.dev` — but Supabase needs a verified sender in most setups. Use your domain when possible.

### 2. Configure SMTP in Supabase

1. [Supabase Dashboard](https://app.supabase.com) → your project → **Authentication** → **Notifications** → **Email**
2. Or go directly to: **Authentication** → **Settings** (or **SMTP Settings** under Email)
3. Enable **Custom SMTP** and enter:

   | Field | Value |
   |-------|-------|
   | **Sender email** | `noreply@yourdomain.com` (or use a Resend test address if available) |
   | **Sender name** | `ExtensionShield` |
   | **Host** | `smtp.resend.com` |
   | **Port** | `465` |
   | **Username** | `resend` |
   | **Password** | Your Resend API key |

4. Save.

After this, Supabase sends all auth emails (confirm signup, password reset, etc.) through Resend, and they should reach Gmail.

---

## Verify Supabase Auth Settings

### URL Configuration (Redirect URLs)

The confirmation link in the email must redirect to a URL that Supabase allows. Add your app URLs:

1. **Authentication** → **URL Configuration**
2. **Site URL:** Your main app URL (e.g. `https://extensionshield.com` or `http://localhost:5173` for local dev)
3. **Redirect URLs:** Add:
   - `https://extensionshield.com/**`
   - `http://localhost:5173/**` and `http://localhost:5174/**` (for local dev; add the port your app uses)
   - Any specific paths you use (e.g. `/auth/callback`)

If the redirect URL used by your app is not in this list, the confirmation link may fail.

### Enable Email Provider and Magic Link

1. **Authentication** → **Providers** → **Email**
2. Ensure **Enable Email provider** is ON
3. For **magic link** sign-in (passwordless): **Authentication** → **Emails** → **Templates** → ensure **Magic link** is enabled/used. The app sends the magic link via `signInWithOtp`; Supabase sends the email using your SMTP (e.g. Resend).

---

## Quick Checklist

| Step | Where | Action |
|------|--------|--------|
| 1 | Resend | Create account, verify domain, get API key |
| 2 | Supabase | Auth → Email → Custom SMTP → Resend credentials |
| 3 | Supabase | Auth → URL Configuration → Add Site URL + Redirect URLs |
| 4 | Supabase | Auth → Providers → Email → Ensure enabled |

---

## Production: Not Receiving Emails on extensionshield.com

If you're testing on **production** (https://extensionshield.com) and still don't receive confirmation emails, verify every item below in the **Supabase Dashboard** (your project).

### 1. Site URL (must be production)

1. **Authentication** → **URL Configuration**
2. **Site URL** must be `https://extensionshield.com` (no trailing slash).
3. If it was `http://localhost:...`, change it to `https://extensionshield.com` and Save.

The confirmation link in the email uses this (or the redirect from your app). Wrong Site URL can break the link or send users to the wrong place.

### 2. Redirect URLs (must include production)

Under **Redirect URLs** you must have at least:

- `https://extensionshield.com/**`
- `https://extensionshield.com/auth/callback`

(You already have these; no localhost needed for prod-only.)

### 3. Custom SMTP (required for delivery to Gmail)

Without custom SMTP, Supabase does **not** reliably send to Gmail (or most inboxes).

1. **Authentication** → **Notifications** (or **Email** / **SMTP Settings**).
2. Enable **Custom SMTP**.
3. Use Resend (or another provider) with:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** Your Resend API key (from [resend.com](https://resend.com) → API Keys).
4. **Sender email** must be a **verified** address. For prod use a verified domain in Resend, e.g. `noreply@extensionshield.com`. Add and verify the domain in Resend → **Domains** (DNS records).
5. Save.

### 4. Email provider enabled

1. **Authentication** → **Providers** → **Email**
2. **Enable Email provider** = ON.
3. **Confirm email** = ON if you want users to confirm before signing in.

### 5. Check Supabase Auth Logs

1. **Supabase** → **Logs** → **Auth Logs**
2. Trigger a sign-up on prod, then look for log entries for that user.
3. If you see SMTP or "send email" errors (e.g. wrong credentials, TLS), fix the Custom SMTP settings above.

### 6. Check Resend dashboard

1. Log in at [resend.com](https://resend.com) → **Emails** (or **Logs**).
2. See if the confirmation email appears and whether it was delivered, bounced, or failed. That confirms whether Supabase is sending via Resend and whether delivery is failing at Resend’s side (e.g. domain not verified, spam).

### 7. Resend: verify a domain to send to any email

**If you never receive confirmation emails (including to Gmail):** Resend’s free/testing setup only allows sending **to your own Resend account email**. To send to **any** address (e.g. s.norzang7@gmail.com or any user):

1. Go to [resend.com](https://resend.com) → **Domains**.
2. **Add domain** (e.g. `extensionshield.com`) and add the DNS records Resend shows (MX, SPF, DKIM, etc.) in your DNS provider (Hostinger, Cloudflare, etc.). See [Resend: Add domain](https://resend.com/docs/dashboard/domains/introduction).
3. Wait until the domain shows as **Verified**.
4. In **Supabase** → **Authentication** → **Emails** → **SMTP Settings**, set **Sender email** to an address on that domain, e.g. `noreply@extensionshield.com` (not `onboarding@resend.dev`).
5. Save. Then trigger a new sign-up or use Supabase **Users** → [user] → **Resend confirmation**.

Until the domain is verified and the sender uses that domain, Resend will not deliver to arbitrary recipients (only to the Resend account owner’s email).

---

## Magic link returns 500 ("Error sending magic link email")

If the app shows **"Error sending magic link email"** and the browser reports **500** on `auth/v1/otp`, Supabase is failing **while sending** the email. Fix the following in order:

### 1. Redirect URL allow list

1. **Supabase** → **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add exactly what your app uses, e.g.:
   - `http://localhost:5174/**`
   - `http://localhost:5174/`
   (Add the port you use; both patterns are safe.)
3. **Site URL** can be `http://localhost:5174` for local dev.

### 2. Custom SMTP (required for magic link emails)

Supabase must send the magic link email via SMTP. Without **Custom SMTP**, or with wrong settings, the server can return 500:

1. **Authentication** → **Emails** → **SMTP Settings** tab
2. Enable **Custom SMTP**
3. Use Resend (or another provider):
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** Your Resend API key
   - **Sender email:** A **verified** address (e.g. `noreply@extensionshield.com` after verifying the domain in Resend). Unverified senders often cause 500 or delivery failures.

### 3. Auth logs and SMTP errors

1. **Supabase** → **Logs** → **Log Explorer** (or **Auth Logs**)
2. Set time range to when you triggered the magic link
3. Look for entries with **status 500** or level **error** and path containing `otp`
4. The message often mentions **gomail** or **SMTP** — e.g. connection refused, auth failed, TLS error. Fix the SMTP settings (host, port, username, password, sender) accordingly.

### 4. Email template

1. **Authentication** → **Emails** → **Templates** → **Magic link**
2. If the template has broken variables (e.g. unclosed `{{ .ConfirmationURL }}`) or invalid HTML, Supabase can return 500. Restore the default template or fix the markup and save.

---

## Auth Logs (Debugging)

If emails still don't arrive after custom SMTP:

1. **Supabase** → **Logs** → **Auth Logs**
2. Look for errors when the confirmation email is handed off to SMTP (e.g. wrong credentials, TLS issues)

Once handed to the SMTP provider, Supabase has no control over delivery. Check Resend's dashboard for delivery status and bounces.

---

## Optional: Disable Email Confirmation (Dev Only)

For quick local testing **only** (not for production):

1. **Authentication** → **Providers** → **Email**
2. Turn **OFF** "Confirm email"

Users can sign in immediately after sign-up without confirming. **Do not use this in production** — it weakens security.

---

## References

- [Supabase: Not receiving auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project)
- [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend + Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
