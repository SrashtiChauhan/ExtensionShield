/**
 * Authentication utility functions
 */

/**
 * Checks if a string contains control characters or null bytes
 */
const hasControlChars = (str) => {
  // Check for null byte or control characters (0x00-0x1F, except \t, \n, \r)
  return /[\u0000\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(str);
};

/**
 * Validates and sanitizes returnTo URL to prevent open redirects and loops
 * @param {string|null} returnTo - The return URL to validate
 * @returns {string} - Validated return URL (defaults to "/" if invalid)
 */
export const validateReturnTo = (returnTo) => {
  if (!returnTo) return "/";
  
  // Trim whitespace
  returnTo = returnTo.trim();
  
  // Reject empty string after trimming
  if (!returnTo) return "/";
  
  // Reject strings containing control characters or null bytes
  if (hasControlChars(returnTo)) {
    console.warn("Invalid returnTo (contains control characters):", returnTo);
    return "/";
  }
  
  // Normalize backslashes to forward slashes
  returnTo = returnTo.replace(/\\/g, "/");
  
  // Only allow relative paths starting with /
  if (!returnTo.startsWith("/")) {
    console.warn("Invalid returnTo (not relative):", returnTo);
    return "/";
  }
  
  // Prevent protocol-relative URLs (//evil.com)
  if (returnTo.startsWith("//")) {
    console.warn("Invalid returnTo (protocol-relative):", returnTo);
    return "/";
  }
  
  // Prevent loops: if returnTo is /auth/callback or starts with it, force home
  if (returnTo === "/auth/callback" || returnTo.startsWith("/auth/callback")) {
    console.warn("Invalid returnTo (would cause loop):", returnTo);
    return "/";
  }
  
  return returnTo;
};

