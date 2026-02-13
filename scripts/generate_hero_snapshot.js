#!/usr/bin/env node
/**
 * Generate HERO_SNAPSHOT with embedded icon_base64 from the database.
 * Run: node scripts/generate_hero_snapshot.js
 * 
 * This fetches the 17 most recent scans and creates a static snapshot
 * with embedded icons for instant first-paint rendering.
 */

const API_URL = process.env.VITE_API_URL || 'http://localhost:8007';

async function main() {
  console.log(`Fetching recent scans from ${API_URL}/api/recent?limit=17...`);
  
  try {
    const response = await fetch(`${API_URL}/api/recent?limit=17`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const scans = data.recent || data;
    
    if (!scans?.length) {
      console.error('No scans found in database.');
      process.exit(1);
    }
    
    console.log(`Found ${scans.length} scans.`);
    
    // Transform to snapshot format
    const snapshot = scans.map((scan, i) => {
      const security = scan.signals?.security_signal || { level: 'ok', label: 'No issues', score: 90 };
      const privacy = scan.signals?.privacy_signal || { level: 'ok', label: 'No trackers', score: 90 };
      const governance = scan.signals?.governance_signal || { level: 'ok', label: 'Standard', score: 90 };
      
      return {
        extensionId: scan.extension_id,
        extension_id: scan.extension_id,
        name: scan.extension_name || 'Extension',
        slug: scan.slug,
        icon_base64: scan.icon_base64 || null,
        icon_media_type: scan.icon_media_type || 'image/png',
        security: { level: security.level, label: security.label, score: security.score },
        privacy: { level: privacy.level, label: privacy.label, score: privacy.score },
        governance: { level: governance.level, label: governance.label, score: governance.score },
        lastAnalyzed: `${i + 1}m ago`,
      };
    });
    
    // Generate the JS file content
    const output = `/**
 * Auto-generated Hero snapshot with embedded icons.
 * Generated: ${new Date().toISOString()}
 * 
 * This file provides instant first-paint for the hero carousel.
 * Regenerate with: node scripts/generate_hero_snapshot.js
 */

export const HERO_SNAPSHOT = ${JSON.stringify(snapshot, null, 2)};
`;
    
    console.log('\n--- Generated heroSnapshot.js content ---\n');
    console.log(output);
    console.log('\n--- End of generated content ---');
    console.log('\nTo apply, copy the above content to frontend/src/data/heroSnapshot.js');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
