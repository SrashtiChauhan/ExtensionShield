#!/usr/bin/env node
/**
 * Set Supabase Auth SMTP via Management API (Resend).
 * Requires: SUPABASE_ACCESS_TOKEN in .env (Personal Access Token from https://supabase.com/dashboard/account/tokens)
 * Uses: RESEND_API_KEY, project ref from SUPABASE_URL.
 *
 * Run from project root: node scripts/supabase-set-smtp.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const resendKey = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL || '';

const projectRef = supabaseUrl.match(/https:\/\/([a-z]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('Could not get project ref from SUPABASE_URL. Set SUPABASE_URL in .env (e.g. https://exmwrsrwhzvxcnhcflwb.supabase.co)');
  process.exit(1);
}

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env');
  console.error('1. Go to https://supabase.com/dashboard/account/tokens');
  console.error('2. Create a token (scope: full access or at least auth config)');
  console.error('3. Add to .env: SUPABASE_ACCESS_TOKEN=sbp_xxxx');
  process.exit(1);
}

if (!resendKey || resendKey === 're_xxxxxxxxx') {
  console.error('Missing or placeholder RESEND_API_KEY in .env');
  process.exit(1);
}

const body = {
  external_email_enabled: true,
  smtp_host: 'smtp.resend.com',
  smtp_port: 465,
  smtp_user: 'resend',
  smtp_pass: resendKey.trim(),
  smtp_admin_email: 'noreply@extensionshield.com',
  smtp_sender_name: 'ExtensionShield',
};

const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
console.log('PATCH', url);
console.log('Body keys:', Object.keys(body).join(', '));

const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let data;
try {
  data = text ? JSON.parse(text) : null;
} catch {
  data = { raw: text };
}

if (!res.ok) {
  console.error('Error:', res.status, res.statusText);
  console.error(data);
  process.exit(1);
}

console.log('OK. Auth SMTP config updated.');
console.log('Run: node scripts/debug-magic-link.mjs snorzang65@gmail.com http://localhost:5174/');
process.exit(0);
