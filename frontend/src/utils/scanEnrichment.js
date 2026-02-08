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
 * @param {Object} scan - Basic scan object from history (may already include metadata)
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipFullFetch - If true, use metadata from scan and calculate signals from available data
 * @param {number} options.timeout - Timeout for individual scan fetch (ms)
 * @returns {Promise<Object>} Enriched scan object
 */
export async function enrichScan(scan, options = {}) {
  const { timeout = 3000, skipFullFetch = false } = options; // Reduced timeout for faster failures

  // If metadata is already available in scan, use it directly (avoids N+1 queries)
  const metadata = parseMetadata(scan);
  const hasMetadata = metadata && Object.keys(metadata).length > 0;

  // Build base scan object with available data
  const baseScan = {
    ...scan,
    extension_name:
      scan.extension_name ||
      scan.extensionName ||
      metadata?.title ||
      scan.extension_id ||
      scan.extensionId,
    extension_id: scan.extension_id || scan.extensionId,
    timestamp: scan.timestamp,
    score: scan.security_score || scan.score || 0,
    risk_level: scan.risk_level || 'UNKNOWN',
    findings_count: scan.total_findings || 0,
    user_count: metadata?.user_count || metadata?.userCount || null,
    rating: metadata?.rating_value || metadata?.rating || null,
    rating_count:
      metadata?.rating_count ||
      metadata?.ratings_count ||
      metadata?.ratingCount ||
      null,
    logo: metadata?.logo || null,
  };

  // If skipFullFetch is true and we have metadata, try to calculate signals from available data
  // This avoids the N+1 query problem
  if (hasMetadata && skipFullFetch) {
    // Try to calculate signals from metadata/scan data if available
    // If sast_results, permissions_analysis, etc. are in metadata, use them
    const scanDataForSignals = {
      ...scan,
      metadata,
      sast_results: scan.sast_results || metadata?.sast_results,
      permissions_analysis: scan.permissions_analysis || metadata?.permissions_analysis,
      virustotal_analysis: scan.virustotal_analysis || metadata?.virustotal_analysis,
      manifest: scan.manifest || metadata?.manifest,
    };

    // Calculate signals from available data
    const enriched = enrichScanWithSignals(baseScan, scanDataForSignals);
    return enriched;
  }

  // Original behavior: fetch full result if metadata not available or skipFullFetch is false
  try {
    const resultPromise = databaseService.getScanResult(
      scan.extension_id || scan.extensionId
    );
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Scan result timeout')), timeout)
    );

    const fullResult = await Promise.race([resultPromise, timeoutPromise]);
    const fullMetadata = parseMetadata(fullResult);

    // Enrich with signals from full result
    const enriched = enrichScanWithSignals(
      {
        ...baseScan,
        user_count: fullMetadata?.user_count || fullMetadata?.userCount || baseScan.user_count,
        rating: fullMetadata?.rating_value || fullMetadata?.rating || baseScan.rating,
        rating_count:
          fullMetadata?.rating_count ||
          fullMetadata?.ratings_count ||
          fullMetadata?.ratingCount ||
          baseScan.rating_count,
        logo: fullMetadata?.logo || baseScan.logo,
      },
      fullResult
    );

    return enriched;
  } catch (err) {
    // If fetch fails, use what we have and create fallback
    console.warn(`Could not fetch full result for ${scan.extension_id}, using available data:`, err);
    return enrichScanWithSignals(baseScan, { metadata, ...scan });
  }
}

/**
 * Enrich multiple scans in parallel with error handling
 * Uses Promise.allSettled to prevent one failure from blocking all
 * 
 * @param {Array<Object>} scans - Array of basic scan objects (may include metadata)
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipFullFetch - If true, use metadata from scans instead of fetching (optimization)
 * @returns {Promise<Array<Object>>} Array of enriched scans
 */
export async function enrichScans(scans, options = {}) {
  if (!scans || scans.length === 0) {
    return [];
  }

  // Check if scans already have metadata - if so, we can skip full fetches for better performance
  const hasMetadata = scans.some(scan => {
    const metadata = parseMetadata(scan);
    return metadata && Object.keys(metadata).length > 0;
  });

  // If metadata is available, skip full fetches to avoid N+1 queries
  // We still need to fetch for signals, but we can do it more efficiently
  const enrichmentOptions = {
    ...options,
    skipFullFetch: hasMetadata && options.skipFullFetch !== false,
  };

  const enrichmentPromises = scans.map((scan) => enrichScan(scan, enrichmentOptions));
  const results = await Promise.allSettled(enrichmentPromises);
  
  return results
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter(Boolean);
}

