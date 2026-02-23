/**
 * Send a test email via Resend using RESEND_API_KEY from .env.
 *
 * Usage (from project root):
 *   node scripts/send-resend-test-email.mjs                    → sends to RESEND_TEST_TO or Gmail default
 *   node scripts/send-resend-test-email.mjs you@hostinger.com   → sends to that address
 *
 * .env:
 *   RESEND_API_KEY=re_your_actual_key   (required)
 *   RESEND_TEST_TO=you@example.com     (optional fallback when no CLI arg)
 */

import dotenv from 'dotenv';
import { Resend } from 'resend';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey || apiKey === 're_xxxxxxxxx') {
  console.error('Missing or placeholder RESEND_API_KEY in .env');
  console.error('Add: RESEND_API_KEY=re_your_actual_key (from resend.com → API Keys)');
  process.exit(1);
}

const to = process.argv[2] || process.env.RESEND_TEST_TO || 'support@extensionshield.com';
// Use verified domain sender so we can send to any email (set in .env: RESEND_FROM=noreply@extensionshield.com)
const from = process.env.RESEND_FROM || 'ExtensionShield <onboarding@resend.dev>';
console.log('Sending test email to:', to);
console.log('From:', from);

const resend = new Resend(apiKey);

async function main() {
  const { data, error } = await resend.emails.send({
    from: from.includes('<') ? from : `ExtensionShield <${from}>`,
    to,
    subject: 'ExtensionShield – test email',
    html: `
      <p>This is a test email from ExtensionShield (Resend).</p>
      <p>If you received this in your Hostinger inbox, email delivery is working.</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    `,
  });

  if (error) {
    console.error('Resend error:', error);
    process.exit(1);
  }
  console.log('Email sent successfully:', data);
}

main();
