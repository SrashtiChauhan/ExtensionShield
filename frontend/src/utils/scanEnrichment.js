import databaseService from '../services/databaseService';
import { enrichScanWithSignals, SIGNAL_LEVELS } from './signalMapper';

/**
 * Parse metadata from scan result (handles both string and object formats)
 * @param {Object} fullResult - Full scan result from database
 * @returns {Object} Parsed metadata object
 */
export function parseMetadata(fullResult) {
  let metadata = {};
  if (fullResult?.metadata) {
    if (typeof fullResult.metadata === 'string') {
      try {
        metadata = JSON.parse(fullResult.metadata);
      } catch (e) {
        metadata = fullResult.metadata;
      }
    } else {
      metadata = fullResult.metadata;
    }
  }
  return metadata;
}

/**
 * Create fallback scan object when enrichment fails
 * @param {Object} scan - Basic scan object
 * @returns {Object} Fallback scan with default values
 */
export function createFallbackScan(scan) {
  return {
    ...scan,
    extension_name:
      scan.extension_name ||
      scan.extensionName ||
      scan.extension_id ||
      scan.extensionId,
    extension_id: scan.extension_id || scan.extensionId,
    timestamp: scan.timestamp,
    user_count: null,
    rating: null,
    rating_count: null,
    logo: null,
    score: scan.security_score || 0,
    risk_level: scan.risk_level || 'UNKNOWN',
    findings_count: scan.total_findings || 0,
    signals: {
      code_signal: { level: SIGNAL_LEVELS.OK, label: '—' },
      perms_signal: { level: SIGNAL_LEVELS.OK, label: '—' },
      intel_signal: { level: SIGNAL_LEVELS.OK, label: '—' },
    },
  };
}

/**
 * Enrich a single scan with full details and signals
 * @param {Object} scan - Basic scan object from history
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout for individual scan fetch (ms)
 * @returns {Promise<Object>} Enriched scan object
 */
export async function enrichScan(scan, options = {}) {
  const { timeout = 5000 } = options;

  try {
    // Add timeout for individual scan result fetches
    const resultPromise = databaseService.getScanResult(
      scan.extension_id || scan.extensionId
    );
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Scan result timeout')), timeout)
    );

    const fullResult = await Promise.race([resultPromise, timeoutPromise]);
    const metadata = parseMetadata(fullResult);

    // Enrich with signals
    const enriched = enrichScanWithSignals(
      {
        ...scan,
        extension_name:
          scan.extension_name ||
          scan.extensionName ||
          metadata?.title ||
          scan.extension_id ||
          scan.extensionId,
        extension_id: scan.extension_id || scan.extensionId,
        timestamp: scan.timestamp,
        user_count: metadata?.user_count || metadata?.userCount || null,
        rating: metadata?.rating_value || metadata?.rating || null,
        rating_count:
          metadata?.rating_count ||
          metadata?.ratings_count ||
          metadata?.ratingCount ||
          null,
        logo: metadata?.logo || null,
      },
      fullResult
    );

    return enriched;
  } catch (err) {
    console.error(`Error loading data for ${scan.extension_id}:`, err);
    return createFallbackScan(scan);
  }
}

/**
 * Enrich multiple scans in parallel with error handling
 * Uses Promise.allSettled to prevent one failure from blocking all
 * 
 * @param {Array<Object>} scans - Array of basic scan objects
 * @param {Object} options - Configuration options
 * @returns {Promise<Array<Object>>} Array of enriched scans
 */
export async function enrichScans(scans, options = {}) {
  if (!scans || scans.length === 0) {
    return [];
  }

  const enrichmentPromises = scans.map((scan) => enrichScan(scan, options));
  const results = await Promise.allSettled(enrichmentPromises);
  
  return results
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter(Boolean);
}

