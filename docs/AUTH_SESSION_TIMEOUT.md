# Auth session timeout (sign-out after 30 minutes)

Session lifetime and sign-out timing are **configured in Supabase**, not in the ExtensionShield codebase. The frontend uses Supabase Auth (JWT + refresh tokens) and does not override session expiry locally.

## Where to configure: Supabase Dashboard

1. Open your project: **https://app.supabase.com** → select your project.
2. Go to **Authentication** → **Sessions**  
   Direct link: `https://supabase.com/dashboard/project/<your-project-ref>/auth/sessions`
3. Use one of these options for a 30-minute sign-out:

   | Option | Effect |
   |--------|--------|
   | **Time-box user sessions** | Session ends after a **fixed** duration from sign-in (e.g. 30 minutes). |
   | **Inactivity timeout** | Session ends after **no activity** for the set duration (e.g. 30 minutes). |

   Set the value to **30** (minutes) for the option you want.

4. **JWT expiration** (optional):  
   In **Project Settings** → **API** (or Auth → JWT / Advanced), the access token (JWT) expiry is separate. Supabase recommends **at least 5 minutes**; default is often 1 hour. For a strict 30-minute session, you can set JWT expiry to 30 minutes as well, or leave it as-is and rely on the session time-box/inactivity settings above.

**Note:** Session limits (time-box, inactivity timeout, single session per user) are available on **Supabase Pro plans and above**. Changes apply the next time a session is refreshed (not immediately to already-issued tokens).

## Summary

- **Do this in Supabase** (Dashboard → Authentication → Sessions), not in local env or app code.
- Set **Time-box user sessions** or **Inactivity timeout** to **30** minutes.
- No code changes are required in ExtensionShield for this.
