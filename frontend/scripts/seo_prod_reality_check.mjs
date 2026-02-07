#!/usr/bin/env node

/**
 * SEO Production Reality Check
 * 
 * Validates REAL production HTTP behavior:
 * - Domain redirects (301, single hop, path/query preserved)
 * - robots.txt content
 * - sitemap.xml availability
 * 
 * This is a lightweight check that uses plain HTTP requests (no browser).
 * For full SEO validation including rendered meta tags, use seo_smoke_test.mjs
 */

const CANONICAL_DOMAIN = 'extensionshield.com';

// Support configurable redirect domains via env var
// Note: extensionaudit.com will be added in the future
const DEFAULT_REDIRECT_DOMAINS = ['extensionscanner.com'];
const REDIRECT_DOMAINS = process.env.REDIRECT_DOMAINS
  ? process.env.REDIRECT_DOMAINS.split(',').map(d => d.trim()).filter(Boolean)
  : DEFAULT_REDIRECT_DOMAINS;

const TEST_PATH = '/anypath';
const TEST_QUERY = '?x=1';

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

/**
 * Fetch with redirect following disabled to inspect redirect chain
 */
async function fetchWithRedirectInspection(url, maxRedirects = 0) {
  const response = await fetch(url, {
    redirect: maxRedirects === 0 ? 'manual' : 'follow',
    headers: {
      'User-Agent': 'ExtensionShield-SEO-Reality-Check/1.0',
    },
  });
  return response;
}

/**
 * Follow redirects manually to count hops
 */
async function checkRedirectChain(url, expectedFinalUrl) {
  const redirects = [];
  let currentUrl = url;
  let finalUrl = null;
  let finalStatus = null;

  for (let i = 0; i < 10; i++) { // Max 10 redirects to prevent infinite loops
    const response = await fetchWithRedirectInspection(currentUrl, 0);
    finalStatus = response.status;
    finalUrl = response.url;

    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
      const location = response.headers.get('location');
      if (!location) {
        break;
      }
      
      redirects.push({
        from: currentUrl,
        to: location,
        status: response.status,
      });

      // Resolve relative URLs
      try {
        currentUrl = new URL(location, currentUrl).href;
      } catch (e) {
        currentUrl = location;
      }
    } else {
      break;
    }
  }

  return {
    redirects,
    finalUrl,
    finalStatus,
    hopCount: redirects.length,
  };
}

/**
 * Test domain redirect
 */
async function testDomainRedirect(domain, testName) {
  const testUrl = `https://${domain}${TEST_PATH}${TEST_QUERY}`;
  const expectedUrl = `https://${CANONICAL_DOMAIN}${TEST_PATH}${TEST_QUERY}`;

  try {
    const { redirects, finalUrl, finalStatus, hopCount } = await checkRedirectChain(testUrl, expectedUrl);

    // Check: Must be exactly ONE redirect hop
    if (hopCount !== 1) {
      if (hopCount === 0) {
        // No redirect at all - likely Cloudflare Page Rules not configured
        failures.push(
          `${testName}: Expected 301 redirect to ${CANONICAL_DOMAIN}, but got status ${finalStatus || 'unknown'}. ` +
          `No redirect detected. Cloudflare Page Rules may not be configured. ` +
          `Check: https://${domain}${TEST_PATH}${TEST_QUERY}`
        );
      } else {
        // Multiple redirects
        failures.push(
          `${testName}: Expected exactly ONE redirect hop, got ${hopCount}. ` +
          `Redirects: ${redirects.map(r => `${r.from} → ${r.to} (${r.status})`).join(', ')}`
        );
      }
      testsFailed++;
      return false;
    }

    // Check: First redirect must be 301
    if (redirects[0].status !== 301) {
      failures.push(
        `${testName}: Expected 301 (Permanent Redirect), got ${redirects[0].status}. ` +
        `Redirect: ${redirects[0].from} → ${redirects[0].to}`
      );
      testsFailed++;
      return false;
    }

    // Check: Final URL must match expected (with query preserved)
    if (finalUrl !== expectedUrl) {
      failures.push(
        `${testName}: Expected final URL ${expectedUrl}, got ${finalUrl}`
      );
      testsFailed++;
      return false;
    }

    // Check: Path and query must be preserved
    const finalUrlObj = new URL(finalUrl);
    const expectedUrlObj = new URL(expectedUrl);
    if (finalUrlObj.pathname !== expectedUrlObj.pathname || finalUrlObj.search !== expectedUrlObj.search) {
      failures.push(
        `${testName}: Path/query not preserved. Expected pathname "${expectedUrlObj.pathname}" and search "${expectedUrlObj.search}", ` +
        `got pathname "${finalUrlObj.pathname}" and search "${finalUrlObj.search}"`
      );
      testsFailed++;
      return false;
    }

    testsPassed++;
    return true;
  } catch (error) {
    failures.push(`${testName}: Error - ${error.message}`);
    testsFailed++;
    return false;
  }
}

/**
 * Test robots.txt
 */
async function testRobotsTxt(domain, shouldAllowCrawl) {
  const testName = `robots.txt: ${domain}`;
  const url = `https://${domain}/robots.txt`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ExtensionShield-SEO-Reality-Check/1.0',
      },
    });

    if (response.status !== 200) {
      failures.push(`${testName}: Expected status 200, got ${response.status}`);
      testsFailed++;
      return false;
    }

    const content = await response.text();
    const hasSitemap = content.includes('Sitemap:') || content.includes('sitemap:');

    if (shouldAllowCrawl) {
      // Canonical domain: Should allow crawl and have sitemap
      if (!hasSitemap) {
        failures.push(
          `${testName}: Should include sitemap reference. ` +
          `Expected "Sitemap: https://${CANONICAL_DOMAIN}/sitemap.xml" in robots.txt`
        );
        testsFailed++;
        return false;
      }

      // Check for specific sitemap URL
      const sitemapPattern = new RegExp(`Sitemap:\\s*https://${CANONICAL_DOMAIN}/sitemap\\.xml`, 'i');
      if (!sitemapPattern.test(content)) {
        failures.push(
          `${testName}: robots.txt should include "Sitemap: https://${CANONICAL_DOMAIN}/sitemap.xml". ` +
          `Found: ${content.match(/Sitemap:.*/i)?.[0] || 'none'}`
        );
        testsFailed++;
        return false;
      }

      testsPassed++;
    } else {
      // Non-canonical domains: Should disallow all
      const hasDisallowAll = /Disallow:\s*\//i.test(content) && !/Allow:/i.test(content);
      if (!hasDisallowAll) {
        failures.push(
          `${testName}: Should disallow all crawling (Disallow: /). ` +
          `Current content: ${content.substring(0, 200).replace(/\n/g, ' ')}... ` +
          `(robots.txt may not be configured for this domain)`
        );
        testsFailed++;
        return false;
      }

      testsPassed++;
    }

    return true;
  } catch (error) {
    failures.push(`${testName}: Error - ${error.message}`);
    testsFailed++;
    return false;
  }
}

/**
 * Test sitemap.xml
 */
async function testSitemapXml() {
  const testName = 'sitemap.xml: extensionshield.com';
  const url = `https://${CANONICAL_DOMAIN}/sitemap.xml`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ExtensionShield-SEO-Reality-Check/1.0',
      },
    });

    if (response.status !== 200) {
      failures.push(`${testName}: Expected status 200, got ${response.status}`);
      testsFailed++;
      return false;
    }

    const content = await response.text();
    const hasUrlset = content.includes('<urlset');
    const hasSitemapIndex = content.includes('<sitemapindex');

    if (!hasUrlset && !hasSitemapIndex) {
      failures.push(
        `${testName}: Body should contain "<urlset" or "<sitemapindex", but found neither. ` +
        `Content preview: ${content.substring(0, 200)}...`
      );
      testsFailed++;
      return false;
    }

    testsPassed++;
    return true;
  } catch (error) {
    failures.push(`${testName}: Error - ${error.message}`);
    testsFailed++;
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n🔍 SEO Production Reality Check');
  console.log('================================\n');
  console.log('Testing REAL production HTTP behavior...\n');
  console.log(`📋 Testing redirect domains: ${REDIRECT_DOMAINS.join(', ')}\n`);

  // Test domain redirects
  console.log('📡 Testing Domain Redirects...');
  for (const domain of REDIRECT_DOMAINS) {
    await testDomainRedirect(domain, `Redirect: ${domain}${TEST_PATH}${TEST_QUERY}`);
  }

  // Test robots.txt
  console.log('🤖 Testing robots.txt...');
  await testRobotsTxt(CANONICAL_DOMAIN, true);
  for (const domain of REDIRECT_DOMAINS) {
    await testRobotsTxt(domain, false);
  }

  // Test sitemap.xml
  console.log('🗺️  Testing sitemap.xml...');
  await testSitemapXml();

  // Print results
  console.log('\n================================');
  console.log('📊 Test Summary');
  console.log('================================');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total:  ${testsPassed + testsFailed}\n`);

  if (failures.length > 0) {
    console.log('❌ Failures:');
    failures.forEach((failure, idx) => {
      console.log(`  ${idx + 1}. ${failure}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('✅ All production reality checks passed!\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

