# Authentication Flow Documentation

## Overview

ExtensionShield uses **Supabase Auth** for authentication, supporting three methods:
- **Google OAuth** (Social Login)
- **GitHub OAuth** (Social Login)
- **Email/Password** (Traditional Login)

All authentication flows are handled through the `AuthContext` React context and `authService` service layer.

---

## Architecture

### Components

1. **`frontend/src/context/AuthContext.jsx`** - Main authentication context provider
2. **`frontend/src/services/authService.js`** - Authentication service layer
3. **`frontend/src/services/supabaseClient.js`** - Supabase client initialization
4. **`frontend/src/components/SignInModal.jsx`** - Sign-in UI component

### Environment Variables

Required in `frontend/.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Authentication Flows

### 1. Google OAuth Flow

#### Step-by-Step Process

1. **User Initiates Login**
   - User clicks "Sign In with Google" button
   - `signInWithGoogle()` is called from `AuthContext`
   - This calls `authService.signInWithGoogle()`

2. **OAuth Redirect**
   - `supabase.auth.signInWithOAuth()` is called with:
     - `provider: "google"`
     - `redirectTo: ${window.location.origin}${window.location.pathname}`
     - Query params: `access_type: 'offline'`, `prompt: 'consent'`
   - Browser immediately redirects to Google OAuth consent screen
   - **Note**: Code after `signInWithOAuth()` does NOT execute (browser redirects)

3. **Google Authentication**
   - User authenticates with Google
   - Google redirects back to Supabase
   - Supabase processes the OAuth response

4. **Callback Redirect**
   - Supabase redirects back to your app with tokens in URL hash:
     ```
     https://extensionshield.com/#access_token=...&refresh_token=...&expires_at=...&token_type=bearer
     ```

5. **Token Processing** (Critical Step)
   - `AuthContext` useEffect detects tokens in URL hash
   - Extracts `access_token`, `refresh_token`, `expires_at`, `token_type`
   - Calls `supabase.auth.setSession()` with extracted tokens
   - This creates the authenticated session

6. **Session Establishment**
   - `setSession()` triggers `onAuthStateChange` event with `SIGNED_IN`
   - Auth state listener updates React state:
     - `setSession(session)`
     - `setUser(user)`
     - `setIsSignInModalOpen(false)`
   - URL hash is cleaned up
   - User is now logged in

#### Key Implementation Details

- **Auth Listener Setup**: The `onAuthStateChange` listener is set up **BEFORE** processing OAuth callback to ensure it catches the `SIGNED_IN` event
- **Token Extraction**: Tokens are manually extracted from URL hash because Supabase doesn't automatically process hash fragments
- **Error Handling**: Missing `refresh_token` is handled gracefully with fallback to `getSession()`
- **Loading States**: `isLoading` is managed throughout the flow to show proper UI feedback

---

### 2. GitHub OAuth Flow

The GitHub OAuth flow is identical to Google OAuth, except:
- Uses `provider: "github"` instead of `"google"`
- No additional query parameters (Google uses `access_type` and `prompt`)

#### Process
1. User clicks "Sign In with GitHub"
2. Redirects to GitHub OAuth
3. GitHub redirects back with tokens in hash
4. Tokens are extracted and session is set
5. User is logged in

---

### 3. Email/Password Flow

#### Sign Up Flow

1. **User Submits Form**
   - User enters email, password, and optional name
   - `signUpWithEmail()` is called

2. **Account Creation**
   - `supabase.auth.signUp()` is called with:
     - `email`
     - `password`
     - `options.data.full_name` (if provided)

3. **Email Confirmation** (if enabled)
   - If email confirmation is **enabled** in Supabase:
     - User receives confirmation email
     - No session is created immediately
     - User must click confirmation link
     - After confirmation, user can sign in
   - If email confirmation is **disabled**:
     - Session is created immediately
     - User is logged in right away

4. **Session Handling**
   - If session exists: User is logged in, modal closes
   - If no session: Modal stays open, user sees success message to check email

#### Sign In Flow

1. **User Submits Credentials**
   - User enters email and password
   - `signInWithEmail()` is called

2. **Authentication**
   - `supabase.auth.signInWithPassword()` is called
   - Supabase validates credentials

3. **Error Handling**
   - "Email not confirmed" → User-friendly message to check email
   - "Invalid credentials" → Generic error message

4. **Session Creation**
   - On success, session is automatically created
   - `getSession()` is called to refresh state
   - User is logged in, modal closes

---

## Session Management

### Session State

The `AuthContext` maintains:
- `session` - Current Supabase session object
- `user` - Transformed user object for UI
- `isLoading` - Loading state during auth operations
- `isAuthenticated` - Boolean: `!!session?.user`
- `accessToken` - Current access token for API calls

### Session Persistence

- Sessions are stored by Supabase in browser storage
- Sessions persist across page refreshes
- On app mount, `getSession()` is called to restore session
- `onAuthStateChange` listener keeps state in sync

### Session Refresh

- Supabase automatically refreshes tokens when they expire
- `refreshAuth()` function can manually refresh session
- Access tokens are synced to `realScanService` for API calls

---

## Error Handling

### OAuth Errors

- Errors in URL hash: `#error=...&error_description=...`
- Displayed to user via `authError` state
- URL is cleaned up after error display

### Email Errors

- Email not confirmed → "Please check your email..."
- Invalid credentials → "Invalid credentials"
- Sign up errors → Error message from Supabase

### Network Errors

- Timeout handling for session checks (5 second timeout)
- Fallback timeout (10 seconds) ensures UI doesn't hang
- Graceful degradation: App continues without auth if Supabase is unavailable

---

## Security Considerations

### Token Handling

- Access tokens are stored securely by Supabase
- Tokens are never logged or exposed in console (except for debugging)
- URL hash is cleaned immediately after processing

### Redirect URLs

- OAuth redirects use `window.location.origin + window.location.pathname`
- This ensures users return to the same page they started from
- Supabase must have redirect URLs configured in dashboard

### Environment Variables

- `VITE_SUPABASE_ANON_KEY` is safe to expose (it's public)
- Never use service role key in frontend
- Environment variables are validated on service initialization

---

## Supabase Configuration

### Required Settings

1. **Authentication Providers**
   - Enable Google OAuth in Supabase Dashboard
   - Enable GitHub OAuth in Supabase Dashboard
   - Enable Email provider in Supabase Dashboard

2. **Redirect URLs**
   - Add your production URL: `https://extensionshield.com`
   - Add localhost for development: `http://localhost:5173` (or your dev port)
   - Add any other domains you use

3. **Email Settings** (for email/password auth)
   - Configure SMTP settings in Supabase Dashboard
   - Or use Supabase's built-in email service
   - Set email confirmation requirement (optional)

### OAuth Provider Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. Add to Supabase Dashboard → Authentication → Providers → Google

#### GitHub OAuth
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set Authorization callback URL:
   - `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. Add to Supabase Dashboard → Authentication → Providers → GitHub

---

## Email Authentication Setup

### Step 1: Enable Email Provider

1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Email** provider
4. Toggle it **ON**

### Step 2: Configure Email Settings

#### Option A: Use Supabase's Built-in Email Service (Development)

1. In Supabase Dashboard → **Authentication** → **Email Templates**
2. Customize email templates if needed:
   - Confirm signup
   - Magic link
   - Change email address
   - Reset password

#### Option B: Use Custom SMTP (Production Recommended)

1. In Supabase Dashboard → **Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Configure:
   - **SMTP Host**: Your SMTP server (e.g., `smtp.gmail.com`)
   - **SMTP Port**: Usually `587` (TLS) or `465` (SSL)
   - **SMTP User**: Your email address
   - **SMTP Password**: App-specific password (not your regular password)
   - **Sender Email**: Email address to send from
   - **Sender Name**: Display name (e.g., "ExtensionShield")

### Step 3: Email Confirmation Settings

1. In Supabase Dashboard → **Authentication** → **Settings**
2. Under **Email Auth**:
   - **Enable email confirmations**: Toggle ON/OFF
     - **ON**: Users must confirm email before signing in (more secure)
     - **OFF**: Users can sign in immediately after signup (faster UX)

### Step 4: Test Email Authentication

1. **Sign Up Test**:
   - Try signing up with a new email
   - Check if confirmation email is sent (if enabled)
   - Verify email template looks correct

2. **Sign In Test**:
   - After confirming email (if required), try signing in
   - Verify session is created correctly

3. **Password Reset** (if implemented):
   - Test password reset flow
   - Verify reset email is sent

### Step 5: Customize Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize templates:
   - **Confirm signup**: Welcome message with confirmation link
   - **Magic link**: For passwordless login (if used)
   - **Change email address**: When user changes email
   - **Reset password**: Password reset instructions

Template variables available:
- `{{ .ConfirmationURL }}` - Confirmation link
- `{{ .Email }}` - User's email
- `{{ .SiteURL }}` - Your site URL
- `{{ .Token }}` - Token (for magic links)

---

## Code Flow Diagrams

### OAuth Flow

```
User clicks "Sign In with Google"
    ↓
signInWithGoogle() called
    ↓
supabase.auth.signInWithOAuth() called
    ↓
Browser redirects to Google
    ↓
User authenticates with Google
    ↓
Google redirects to Supabase
    ↓
Supabase redirects to app with tokens in hash
    ↓
AuthContext detects tokens in hash
    ↓
Extract access_token, refresh_token, etc.
    ↓
supabase.auth.setSession() called
    ↓
onAuthStateChange fires with SIGNED_IN
    ↓
React state updated (session, user)
    ↓
User is logged in
```

### Email Sign In Flow

```
User enters email/password
    ↓
signInWithEmail() called
    ↓
supabase.auth.signInWithPassword() called
    ↓
Supabase validates credentials
    ↓
Session created automatically
    ↓
getSession() called to refresh state
    ↓
React state updated
    ↓
User is logged in
```

### Email Sign Up Flow

```
User enters email/password/name
    ↓
signUpWithEmail() called
    ↓
supabase.auth.signUp() called
    ↓
Account created
    ↓
Check if session exists:
    ├─ YES (email confirmation disabled)
    │   └─ User logged in immediately
    └─ NO (email confirmation enabled)
        └─ User must confirm email first
```

---

## Troubleshooting

### OAuth Not Working

1. **Check redirect URLs**:
   - Verify URLs are added in Supabase Dashboard
   - Check that URL matches exactly (including http/https, port, path)

2. **Check OAuth provider settings**:
   - Verify Client ID and Secret are correct
   - Check callback URLs in provider dashboard

3. **Check browser console**:
   - Look for errors in token extraction
   - Verify tokens are in URL hash

4. **Check network tab**:
   - Verify redirects are happening
   - Check for CORS errors

### Email Not Sending

1. **Check SMTP settings**:
   - Verify SMTP credentials are correct
   - Test SMTP connection

2. **Check email templates**:
   - Verify templates are configured
   - Check for syntax errors

3. **Check spam folder**:
   - Emails might be going to spam

4. **Check Supabase logs**:
   - Look for email sending errors in dashboard

### Session Not Persisting

1. **Check browser storage**:
   - Verify localStorage/sessionStorage is enabled
   - Check for storage quota issues

2. **Check session expiration**:
   - Sessions expire after set time
   - Check `expires_at` in session object

3. **Check token refresh**:
   - Supabase should auto-refresh tokens
   - Verify refresh token is present

---

## API Integration

### Using Auth in API Calls

The access token is automatically synced to `realScanService`:

```javascript
// In AuthContext.jsx
useEffect(() => {
  realScanService.setAccessToken(session?.access_token || null);
}, [session]);
```

### Backend Token Verification

The backend verifies Supabase tokens using JWT verification. See:
- `src/extension_shield/api/supabase_auth.py` - Token verification
- `src/extension_shield/api/database.py` - User ID extraction

---

## Best Practices

1. **Always check `isAuthenticated`** before showing protected content
2. **Handle loading states** - Show loading UI during auth operations
3. **Clean up URL hash** - Remove tokens from URL after processing
4. **Error handling** - Always display user-friendly error messages
5. **Session refresh** - Implement automatic token refresh
6. **Security** - Never expose service role keys in frontend
7. **Testing** - Test all auth flows in both development and production

---

## Future Enhancements

Potential improvements:
- Password reset flow
- Magic link authentication
- Two-factor authentication (2FA)
- Social account linking
- Session timeout warnings
- Remember me functionality

---

## Related Files

- `frontend/src/context/AuthContext.jsx` - Main auth context
- `frontend/src/services/authService.js` - Auth service layer
- `frontend/src/services/supabaseClient.js` - Supabase client
- `frontend/src/components/SignInModal.jsx` - Sign-in UI
- `src/extension_shield/api/supabase_auth.py` - Backend token verification

---

## Support

For issues:
1. Check Supabase Dashboard logs
2. Check browser console for errors
3. Verify environment variables are set
4. Check network tab for failed requests
5. Review this documentation for common issues

