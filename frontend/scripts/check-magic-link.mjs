/**
 * Diagnose why magic link fails. Checks client config and calls Supabase OTP
 * to capture the exact error. SMTP is configured only in Supabase Dashboard.
 *
 * Run from frontend dir:
 *   node scripts/check-magic-link.mjs [email] [redirectUrl]
 *   node scripts/check-magic-link.mjs you@example.com http://localhost:5174/
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
const email = args[0] || 'test@example.com';
const redirectTo = args[1] || 'http://localhost:5174/';

function check(name, value, forbid = '') {
  const ok = value && typeof value === 'string' && value.trim() !== '' && !value.includes(forbid);
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${ok ? 'set' : 'missing or invalid'}`);
  return ok;
}

console.log('\n--- Magic link diagnostic ---\n');

console.log('1. Client config (frontend/.env):');
const hasUrl = check('VITE_SUPABASE_URL', url, 'placeholder');
const hasKey = check('VITE_SUPABASE_ANON_KEY', anonKey, 'placeholder');
if (!hasUrl || !hasKey) {
  console.log('\nFix: Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env (from Supabase Dashboard → Settings → API).\n');
  process.exit(1);
}

console.log('\n2. Calling Supabase auth/v1/otp (magic link)...');
console.log(`   Email: ${email}`);
console.log(`   Redirect: ${redirectTo}\n`);

const supabase = createClient(url, anonKey, { auth: { flowType: 'pkce' } });

const { data, error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: redirectTo },
});

if (error) {
  console.log('Supabase returned an error:\n');
  console.log('   Message:', error.message);
  console.log('   Status:', error.status ?? '(no status)');
  if (error.name) console.log('   Name:', error.name);
  if (error.code) console.log('   Code:', error.code);
  console.log('\n   Full error (for debugging):', JSON.stringify({ message: error.message, status: error.status, name: error.name }, null, 2));

  console.log('\n--- What to fix in Supabase Dashboard ---\n');
  console.log('Magic link emails are sent by Supabase. We do NOT set SMTP in .env — only in Dashboard.\n');

  if (error.status === 500 || (error.message && error.message.toLowerCase().includes('sending'))) {
    console.log('► Open Supabase → Logs → Log Explorer NOW. Set time to last 5–10 min, filter status 500 or path "otp". The log message will show the exact SMTP/template error.\n');
    console.log('• SMTP (most common):');
    console.log('  Authentication → Emails → SMTP Settings');
    console.log('  Enable Custom SMTP. Host: smtp.resend.com, Port: 465, Username: resend, Password: your Resend API key.');
    console.log('  Sender email must be a VERIFIED address (e.g. noreply@extensionshield.com).\n');
    console.log('• Full checklist: docs/MAGIC_LINK_SUPABASE_RESEND_CHECKLIST.md\n');
  }

  console.log('• Redirect URLs:');
  console.log('  Authentication → URL Configuration → Redirect URLs');
  console.log('  Add the exact redirect you use, e.g.:');
  console.log('    http://localhost:5174/**');
  console.log('    http://localhost:5174/');
  console.log('  (and https://extensionshield.com/** for prod).\n');

  console.log('• Site URL:');
  console.log('  For local dev set Site URL to http://localhost:5174 (or your dev origin).\n');

  process.exit(1);
}

console.log('Success. Supabase accepted the request. Check your inbox for the magic link email.');
if (data?.user && !data?.session) {
  console.log('(If no email arrives, the failure is in Supabase sending the email: check SMTP and Auth logs above.)');
}
console.log('');
process.exit(0);
