import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for safe async operations with mount tracking and timeout protection
 * 
 * Prevents:
 * - State updates after component unmount
 * - Infinite loading states
 * - Hanging API calls
 * 
 * @param {Function} asyncFn - Async function to execute
 * @param {Array} deps - Dependency array for useEffect
 * @param {Object} options - Configuration options
 * @param {number} options.safetyTimeout - Max time before forcing loading to false (ms)
 * @param {number} options.requestTimeout - Max time for the async function (ms)
 * @param {boolean} options.initialLoading - Initial loading state
 * @returns {Object} { loading, error, data }
 */
export function useSafeAsync(asyncFn, deps = [], options = {}) {
  const {
    safetyTimeout = 3000,
    requestTimeout = 5000,
    initialLoading = true,
  } = options;

  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef([]);

  useEffect(() => {
    isMountedRef.current = true;
    
    const execute = async () => {
      setLoading(true);
      setError(null);
      
      // Safety timeout - force loading to false after safetyTimeout
      const safetyTimeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }, safetyTimeout);
      timeoutRefs.current.push(safetyTimeoutId);

      try {
        // Request timeout wrapper
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), requestTimeout)
        );

        const resultPromise = asyncFn();
        const result = await Promise.race([resultPromise, timeoutPromise]);

        if (isMountedRef.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err.message || 'An error occurred');
          setData(null);
        }
      } finally {
        // Clear safety timeout
        clearTimeout(safetyTimeoutId);
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    execute();

    // Cleanup
    return () => {
      isMountedRef.current = false;
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };
  }, deps);

  return { loading, error, data };
}

