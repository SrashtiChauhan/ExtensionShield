import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import realScanService from "../services/realScanService";
import databaseService from "../services/databaseService";
import { normalizeExtensionId } from "../utils/extensionId";
import { getScanResultsRoute } from "../utils/slug";
import { useAuth } from "./AuthContext";

const ScanContext = createContext(null);

export const useScan = () => {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error("useScan must be used within a ScanProvider");
  }
  return context;
};

export const ScanProvider = ({ children }) => {
  const navigate = useNavigate();
  const { isAuthenticated, accessToken } = useAuth();

  // Mount guard — prevents setState on unmounted component during long async flows
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  // Scan state
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState(null);
  const [scanResults, setScanResults] = useState(null);
  const [error, setError] = useState(null);
  const [currentExtensionId, setCurrentExtensionId] = useState(null);
  
  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState({
    totalScans: { value: 0, sparkline: [0] },
    highRisk: { value: 0, sparkline: [0] },
    totalFiles: { value: 0, sparkline: [0] },
    totalVulnerabilities: { value: 0, sparkline: [0] },
  });

  // Scan history
  const [scanHistory, setScanHistory] = useState([]);

  // Load dashboard stats
  const loadDashboardStats = useCallback(async () => {
    try {
      const metrics = await databaseService.getDashboardMetrics();
      setDashboardStats(metrics);
    } catch (err) {
      // console.error("Error loading dashboard stats:", err); // prod: no console
    }
  }, []);

  // Load scan history (only when authenticated to avoid 401 in console)
  const loadScanHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setScanHistory([]);
      return [];
    }
    try {
      const history = await databaseService.getScanHistory(50, accessToken);
      setScanHistory(history);
      return history;
    } catch (err) {
      setScanHistory([]);
      return [];
    }
  }, [isAuthenticated, accessToken]);

  // Extract extension ID from URL
  const extractExtensionId = useCallback((url) => {
    return realScanService.extractExtensionId(url);
  }, []);

  // Wait for scan completion with stage progression
  const waitForScanCompletion = useCallback(async (extensionId) => {
    const stages = [
      "extracting",
      "security_scan",
      "building_evidence",
      "applying_rules",
      "generating_report",
    ];

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      if (!mountedRef.current) return;
      setScanStage(stages[stageIndex]);

      const stageDuration = 10 + Math.random() * 5;
      const steps = Math.ceil(stageDuration / 2);

      for (let step = 0; step < steps; step++) {
        if (!mountedRef.current) return;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!mountedRef.current) return;

        const status = await realScanService.checkScanStatus(extensionId);
        if (!mountedRef.current) return;
        if (status.scanned) {
          setScanStage("generating_report");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return;
        }

        if (status.status === "failed") {
          // Check for API key errors (401) - show user-friendly message
          if (status.error_code === 401 || status.error?.includes("API key") || status.error?.includes("Invalid API key") || status.error?.includes("Authentication") || status.error?.includes("sk-proj")) {
            throw new Error("Connection is down try back in a while");
          }
          // 503 / connection refused – analysis service unavailable
          if (status.error_code === 503 || status.error?.includes("Connection refused") || status.error?.includes("Errno 61") || status.error?.includes("LLM service")) {
            throw new Error("Scan analysis service unavailable. Check your provider configuration.");
          }
          // Check for quota errors (403) - token/quota exceeded
          if (status.error_code === 403 || status.error?.includes("quota") || status.error?.includes("token_quota")) {
            throw new Error(status.error || "Scan analysis quota exceeded. Check your provider limits or try again later.");
          }
          throw new Error(status.error || "Scan failed on the server.");
        }
      }
    }

    const status = await realScanService.checkScanStatus(extensionId);
    if (status.scanned) {
      return;
    }

    throw new Error("Scan timeout - extension analysis took too long");
  }, []);

  // Start scan from URL
  const startScan = useCallback(async (scanUrl) => {
    const urlToScan = scanUrl || url;
    
    if (!urlToScan.trim()) {
      setError("Please enter a Chrome Web Store URL");
      return;
    }

    // No authentication required for scanning - anonymous users can scan with IP-based rate limiting
    // Authentication is only required to view saved scan history

    // Clear input state so /scan page starts clean after scan completes
    setUrl("");
    setIsScanning(true);
    setError(null);
    setScanResults(null);
    setCurrentExtensionId(null);
    setScanStage("extracting");

    try {
      const extIdRaw = extractExtensionId(urlToScan);
      if (!extIdRaw) {
        throw new Error("Invalid Chrome Web Store URL format");
      }

      // Normalize the extension ID to ensure it's exactly 32 chars (a-p) and remove any trailing characters
      const extId = normalizeExtensionId(extIdRaw);
      if (!extId) {
        throw new Error("Invalid Chrome extension ID format");
      }

      setCurrentExtensionId(extId);

      // Daily scan limit check (cached lookups still allowed) - skip in development
      const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
      if (!isDev) {
        try {
          const limit = await realScanService.getDeepScanLimitStatus();
          if (limit?.remaining <= 0) {
            const cached = await realScanService.hasCachedResults(extId);
            if (!cached) {
              setError("Daily scan limit reached (2 scans per day). Sign in or try again tomorrow.");
              setScanStage(null);
              setIsScanning(false);
              return;
            }
          }
        } catch (e) {
          // If the limit check fails, fall back to backend enforcement.
        }
      }

      // Navigate to the progress/game screen ASAP for best UX.
      // The progress page will poll status until the scan is running/completed.
      navigate(`/scan/progress/${extId}`);
      
      // Check status and trigger scan in the background
      const status = await realScanService.checkScanStatus(extId);
      let scanTrigger = null;

      if (!status.scanned) {
        scanTrigger = await realScanService.triggerScan(urlToScan);

        // For cached lookups, backend may return status=completed + already_scanned=true
        if (!scanTrigger.already_scanned && scanTrigger.status !== "running") {
          throw new Error(scanTrigger.error || "Failed to start scan");
        }
      }
      
      if (!status.scanned && scanTrigger && !scanTrigger.already_scanned) {
        await waitForScanCompletion(extId);
      }

      // Fetch results (via realScanService.getRealScanResults → GET /api/scan/results/:id)
      const maxAttempts = 10;
      let results = null;
      for (let i = 0; i < maxAttempts; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        results = await realScanService.getRealScanResults(extId);
        if (results) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Results are already in correct format (no transformation needed)
      setScanResults(results);
      setError("");
      setScanStage(null);
      setIsScanning(false);

      // Refresh stats and history in parallel (best-effort, non-blocking)
      void Promise.all([loadScanHistory(), loadDashboardStats()]);

      // IMPORTANT: Do not auto-navigate to results.
      // The progress page will show a "Scan complete" prompt allowing users
      // to keep playing or view results.
    } catch (err) {
      // Handle different error types with user-friendly messages
      let errorMessage = err.message || "Failed to scan extension.";
      
      // Rate limit error (429) - daily scan limit reached
      if (err.status === 429 || err.message?.includes("Daily scan limit") || err.message?.includes("DAILY_DEEP_SCAN_LIMIT")) {
        errorMessage = "Daily scan limit reached (2 scans per day). Sign in or try again tomorrow.";
      } else if (err.message?.includes("API key") || err.message?.includes("Invalid API key") || err.message?.includes("Authentication") || err.message?.includes("401")) {
        errorMessage = "Connection is down try back in a while";
      } else if (err.message?.includes("Connection refused") || err.message?.includes("Errno 61") || err.message?.includes("LLM service")) {
        errorMessage = "Scan analysis service unavailable. Check your provider configuration.";
      } else if (err.message?.includes("quota") || err.message?.includes("token_quota") || err.message?.includes("403")) {
        errorMessage = err.message || "Scan analysis quota exceeded. Check your provider limits or try again later.";
      }
      setError(errorMessage);
      setScanStage(null);
      setIsScanning(false);
      // Stay on progress page to show error
    }
  }, [url, extractExtensionId, navigate, waitForScanCompletion, loadScanHistory, loadDashboardStats]);

  // Handle file upload
  // No authentication required - anonymous users can upload with IP-based rate limiting
  const handleFileUpload = useCallback(async (file) => {
    const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

    setUrl("");
    setIsScanning(true);
    setError(null);
    setScanResults(null);
    setCurrentExtensionId(null);
    setScanStage("extracting");

    try {
      // Daily scan limit check (uploads are always deep scans) - skip in development
      if (!isDevelopment) {
        try {
          const limit = await realScanService.getDeepScanLimitStatus();
          if (limit?.remaining <= 0) {
            setError("Daily scan limit reached (2 scans per day). Sign in or try again tomorrow.");
            setScanStage(null);
            setIsScanning(false);
            return;
          }
        } catch (e) {
          // If the limit check fails, fall back to backend enforcement.
        }
      }

      const uploadResult = await realScanService.uploadAndScan(file);

      if (!uploadResult || !uploadResult.extension_id) {
        throw new Error("Failed to upload file");
      }

      // Normalize the extension ID to ensure it's exactly 32 chars (a-p) and remove any trailing characters
      const extensionIdRaw = uploadResult.extension_id;
      const extensionId = normalizeExtensionId(extensionIdRaw);
      if (!extensionId) {
        throw new Error("Invalid extension ID format from upload");
      }

      setCurrentExtensionId(extensionId);
      
      // Navigate to progress page
      navigate(`/scan/progress/${extensionId}`);

      await waitForScanCompletion(extensionId);

      // Via realScanService.getRealScanResults → GET /api/scan/results/:id
      const maxAttempts = 10;
      let results = null;
      for (let i = 0; i < maxAttempts; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        results = await realScanService.getRealScanResults(extensionId);
        if (results) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      // Results are already in correct format (no transformation needed)
      setScanResults(results);
      setError("");
      setScanStage(null);
      setIsScanning(false);

      void Promise.all([loadScanHistory(), loadDashboardStats()]);
      // Do not auto-navigate; progress page will prompt.
    } catch (err) {
      // Handle rate limit error (429) with user-friendly message
      let errorMessage = err.message || "Failed to upload and scan file.";
      if (err.status === 429 || err.message?.includes("Daily scan limit") || err.message?.includes("DAILY_DEEP_SCAN_LIMIT")) {
        errorMessage = "Daily scan limit reached (2 scans per day). Sign in or try again tomorrow.";
      }
      setError(errorMessage);
      setScanStage(null);
      setIsScanning(false);
    }
  }, [navigate, waitForScanCompletion, loadScanHistory, loadDashboardStats]);

  // Load scan from history (single API: realScanService.getRealScanResults)
  const loadScanFromHistory = useCallback(async (extId, extensionName) => {
    try {
      const data = await realScanService.getRealScanResults(extId);
      if (!data) {
        setError("Scan results not found.");
        return;
      }
      setScanResults(data);
      setCurrentExtensionId(extId);
      setError("");
      const route = getScanResultsRoute(extId, extensionName || data?.extension_name);
      navigate(route);
    } catch (err) {
      setError("Failed to load scan results from history.");
    }
  }, [navigate]);

  // Load results by extension ID (single API: realScanService.getRealScanResults)
  // Always clears previous results first so stale data never leaks between extensions.
  const loadResultsById = useCallback(async (extId) => {
    try {
      // Clear previous extension's data before fetching new one
      setScanResults(null);
      setCurrentExtensionId(extId);
      setError("");

      const data = await realScanService.getRealScanResults(extId);
      if (!data) {
        setError("Scan results not found. The extension may not have been scanned yet.");
        return null;
      }
      setScanResults(data);
      setCurrentExtensionId(extId);
      return data;
    } catch (err) {
      setError("Failed to load scan results.");
      return null;
    }
  }, []);

  // Clear scan state
  const clearScan = useCallback(() => {
    setUrl("");
    setIsScanning(false);
    setScanStage(null);
    setScanResults(null);
    setError(null);
    setCurrentExtensionId(null);
  }, []);

  const value = useMemo(() => ({
    // State
    url,
    setUrl,
    isScanning,
    scanStage,
    scanResults,
    setScanResults,
    error,
    setError,
    currentExtensionId,
    dashboardStats,
    scanHistory,
    
    // Actions
    startScan,
    handleFileUpload,
    loadScanFromHistory,
    loadResultsById,
    loadDashboardStats,
    loadScanHistory,
    extractExtensionId,
    clearScan,
  }), [
    url, isScanning, scanStage, scanResults, error,
    currentExtensionId, dashboardStats, scanHistory,
    startScan, handleFileUpload, loadScanFromHistory,
    loadResultsById, loadDashboardStats, loadScanHistory,
    extractExtensionId, clearScan,
  ]);

  return (
    <ScanContext.Provider value={value}>
      {children}
    </ScanContext.Provider>
  );
};

export default ScanContext;

