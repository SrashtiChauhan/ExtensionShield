/**
 * Trigger Supabase sign-up for a test user so a confirmation email is sent.
 * Uses VITE_SUPABASE_* from frontend/.env. Run from frontend dir:
 *   node scripts/signup-test-user.mjs [email] [password] [redirectUrl]
 *   node scripts/signup-test-user.mjs s.norzang7@gmail.com MyPass123! https://extensionshield.com/
 * Use --prod as 4th arg for production redirect: node scripts/signup-test-user.mjs email pass --prod
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const args = process.argv.slice(2);
const email = args[0] || 'snorzang65@gmail.com';
const password = args[1] || 'TestPass123!';
const prodFlag = args[2] === '--prod' || args[3] === '--prod';
const explicitRedirect = args[2] && args[2] !== '--prod' ? args[2] : args[3] && args[3] !== '--prod' ? args[3] : null;
const redirectTo = explicitRedirect || (prodFlag ? 'https://extensionshield.com/' : 'http://localhost:5175/');

if (!url || !anonKey || url.includes('placeholder')) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend/.env');
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { flowType: 'pkce' } });

async function main() {
  console.log('Signing up:', email);
  console.log('Redirect URL for confirmation link:', redirectTo);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: 'Test User' },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    console.error('Sign-up error:', error.message);
    process.exit(1);
  }

  if (data.user && !data.session) {
    console.log('Success. User created; confirmation email should be sent.');
    console.log('Check your inbox (and spam) for the confirmation link.');
    console.log('After confirming, you can sign in with this email and the password you used.');
  } else if (data.session) {
    console.log('Success. User created and already signed in (email confirmation may be disabled).');
  } else {
    console.log('Response:', data);
  }
}

main();
