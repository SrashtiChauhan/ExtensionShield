#!/usr/bin/env node
/**
 * Step-by-step debug: Resend vs Supabase for magic link.
 * Run from project root:
 *   node scripts/debug-magic-link.mjs your@email.com
 *
 * Uses: root .env (RESEND_API_KEY), frontend/.env (VITE_SUPABASE_*)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');

const testEmail = process.argv[2] || 'test@example.com';
const redirectUrl = process.argv[3] || 'http://localhost:5174/';

let resendOk = false;
let supabaseOk = false;

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => { out += d; });
    child.stderr?.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

console.log('\n========================================');
console.log('  Magic link debug – Resend vs Supabase');
console.log('========================================\n');
console.log('Test email:', testEmail);
console.log('Redirect URL:', redirectUrl);
console.log('');

// ----- Step 1: Resend (direct send from root) -----
console.log('--- Step 1: Resend (direct send) ---');
const resendResult = await run('node', ['scripts/send-resend-test-email.mjs', testEmail], rootDir);
if (resendResult.code !== 0) {
  console.log('  ✗ Resend failed (exit ' + resendResult.code + ')');
  const out = (resendResult.out || '') + (resendResult.err || '');
  if (out.includes('only send testing emails') || out.includes('verify a domain')) {
    console.log('  → Resend API key is valid, but Resend only allows sending to YOUR email until you verify a domain.');
    console.log('  → Go to resend.com/domains, add extensionshield.com, add DNS records, then use noreply@extensionshield.com as sender in Supabase SMTP.');
  } else if (out.includes('Missing') || out.includes('RESEND_API_KEY')) {
    console.log('  → Add RESEND_API_KEY=re_xxx in root .env (from resend.com → API Keys).');
  } else {
    if (resendResult.err) console.log(resendResult.err.trim().split('\n').map(l => '     ' + l).join('\n'));
    console.log('  → Check RESEND_API_KEY in root .env (from resend.com → API Keys).');
  }
} else {
  resendOk = true;
  console.log('  ✓ Resend sent successfully');
  console.log('  → Check inbox (and spam) for the test email.');
}
console.log('');

// ----- Step 2: Supabase (OTP from frontend) -----
console.log('--- Step 2: Supabase (magic link / OTP) ---');
const supabaseResult = await run('node', ['scripts/check-magic-link.mjs', testEmail, redirectUrl], frontendDir);
if (supabaseResult.code !== 0) {
  console.log('  ✗ Supabase OTP failed');
  const out = (supabaseResult.out || '') + (supabaseResult.err || '');
  const statusMatch = out.match(/Status:\s*(\d+)/);
  const msgMatch = out.match(/Message:\s*(.+)/);
  if (msgMatch) console.log('     Message:', msgMatch[1].trim());
  if (statusMatch) console.log('     Status:', statusMatch[1]);
} else {
  supabaseOk = true;
  console.log('  ✓ Supabase accepted the request (magic link email should be sent)');
  console.log('  → Check inbox for magic link. If missing, Supabase SMTP config is wrong.');
}
console.log('');

// ----- Verdict -----
console.log('========================================');
console.log('  Verdict');
console.log('========================================\n');

console.log('  Resend (Step 1):  ', resendOk ? '✓ OK' : '✗ FAIL');
console.log('  Supabase (Step 2):', supabaseOk ? '✓ OK' : '✗ FAIL');
console.log('');

if (resendOk && supabaseOk) {
  console.log('Both passed. Check your inbox for both emails. If magic link is missing,');
  console.log('the issue is Supabase SMTP config in Dashboard (see below).\n');
  process.exit(0);
}

if (!resendOk) {
  console.log('► RESEND (Step 1 failed):');
  console.log('  • If "only send to your own email": API key is OK. Verify a domain at resend.com/domains so you can send to any address; then set Sender in Supabase SMTP to noreply@yourdomain.com.');
  console.log('  • If missing key: add RESEND_API_KEY=re_xxx in root .env from resend.com → API Keys.\n');
}

if (!supabaseOk) {
  console.log('► SUPABASE is the problem (Step 2 failed – magic link email not sent):');
  console.log('  • SMTP is configured only in Supabase Dashboard, not in .env.');
  console.log('  • Go to: Authentication → Emails → SMTP Settings');
  console.log('  • Enable Custom SMTP:');
  console.log('    Host: smtp.resend.com  Port: 465  User: resend  Password: <same Resend API key>');
  console.log('  • Sender email: use a verified address (e.g. noreply@yourdomain.com after');
  console.log('    verifying the domain in Resend). onboarding@resend.dev only works for your own email.');
  console.log('  • Add Redirect URLs: ' + redirectUrl + ' and ' + redirectUrl.replace(/\/?$/, '/**'));
  console.log('  • Supabase → Logs → Auth logs: look for 500/error to see exact SMTP error.\n');
}

if (!resendOk && !supabaseOk) {
  console.log('► Fix Resend first (Step 1), then Supabase SMTP (Step 2).\n');
}

process.exit(supabaseOk ? 0 : 1);
