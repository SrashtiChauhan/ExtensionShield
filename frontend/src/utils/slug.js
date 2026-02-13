/**
 * Generate a URL-friendly slug from an extension name.
 * Must match the backend's generate_slug() function in database.py.
 *
 * Examples:
 *   "Session Buddy" -> "session-buddy"
 *   "uBlock Origin" -> "ublock-origin"
 *   "PayPal Honey: Coupons & Cash Back" -> "paypal-honey-coupons-cash-back"
 *
 * @param {string} name - Extension name
 * @returns {string} URL-friendly slug
 */
export function generateSlug(name) {
  if (!name) return "";
  
  let slug = name.toLowerCase();
  // Replace common separators with hyphens
  slug = slug.replace(/[:\-–—_/\\|]+/g, "-");
  // Remove non-alphanumeric (keep hyphens and spaces for now)
  slug = slug.replace(/[^a-z0-9\s-]/g, "");
  // Replace whitespace with hyphens
  slug = slug.replace(/\s+/g, "-");
  // Collapse multiple hyphens
  slug = slug.replace(/-+/g, "-");
  // Strip leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");
  
  return slug;
}

/**
 * Check if a string looks like a Chrome extension ID (32 lowercase letters).
 * @param {string} str
 * @returns {boolean}
 */
export function isExtensionId(str) {
  return /^[a-z]{32}$/.test(str);
}

/**
 * Build the scan results route. Prefers slug when extension name is available.
 * @param {string} extensionId - Chrome extension ID (required for fallback)
 * @param {string} [extensionName] - Extension name (used to generate slug when present)
 * @returns {string} Route path e.g. /scan/results/session-buddy or /scan/results/jaogepninmlbinccpbiakcgiolijlllo
 */
export function getScanResultsRoute(extensionId, extensionName) {
  if (!extensionId) return "";
  const slug = extensionName ? generateSlug(extensionName) : "";
  const identifier = slug || extensionId;
  return `/scan/results/${encodeURIComponent(identifier)}`;
}
