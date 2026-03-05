import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { useScan } from "../../context/ScanContext";
import { EXTENSION_ICON_PLACEHOLDER, getExtensionIconUrl } from "../../utils/constants";
import realScanService from "../../services/realScanService";
import { getScanResultsRoute } from "../../utils/slug";
import SEOHead from "../../components/SEOHead";
import { normalizeExtensionId } from "../../utils/extensionId";
import { logger } from "../../utils/logger";
import "./ScanProgressPage.scss";

const ScanProgressPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Read scanId from any possible param key (scanId, extensionId, id)
  const rawScanId = params.scanId || params.extensionId || params.id || '';
  
  // Use Chrome extension ID (32 a-p) or upload scan ID (UUID) from URL
  // normalizeExtensionId now handles both formats
  const scanId = normalizeExtensionId(rawScanId) || rawScanId;
  
  // Dev-only logging
  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.log("[ScanProgressPage] Params:", params);
      logger.log("[ScanProgressPage] Raw scanId:", rawScanId);
      logger.log("[ScanProgressPage] Normalized scanId:", scanId);
    }
  }, [params, rawScanId, scanId]);
  const {
    isScanning,
    scanStage,
    error,
    setError,
    scanResults,
    setScanResults,
    setCurrentExtensionId,
    currentExtensionId,
  } = useScan();
  
  const [extensionLogo, setExtensionLogo] = useState(EXTENSION_ICON_PLACEHOLDER);
  const [extensionName, setExtensionName] = useState(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [alreadyScanned, setAlreadyScanned] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const hasSeenInProgressRef = useRef(false);

  // Apply extension name/icon from location state immediately (when navigating from scanner with a selected suggestion)
  useEffect(() => {
    if (!scanId) return;
    const stateName = location.state?.extensionName;
    const stateLogo = location.state?.extensionLogoUrl;
    if (stateName != null) setExtensionName(stateName);
    if (stateLogo != null) setExtensionLogo(stateLogo);
  }, [scanId, location.state]);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch extension logo and name: set icon URL immediately so it shows/loads right away; fallback to placeholder on error.
  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;

    const iconUrl = getExtensionIconUrl(scanId);
    // Set logo URL immediately so the img starts loading (unless we already have one from location state).
    if (!location.state?.extensionLogoUrl) setExtensionLogo(iconUrl);

    const img = new Image();
    img.onload = () => {
      if (!cancelled) setExtensionLogo(iconUrl);
    };
    img.onerror = () => {
      if (!cancelled) setExtensionLogo(EXTENSION_ICON_PLACEHOLDER);
    };
    img.src = iconUrl;

    // Fetch extension name from scan results when available (async; may not exist yet while scan is running).
    const fetchExtensionInfo = async () => {
      try {
        const results = await realScanService.getRealScanResults(scanId);
        if (cancelled) return;
        if (results?.extension_name) {
          setExtensionName(results.extension_name);
        } else if (results?.metadata?.title) {
          setExtensionName(results.metadata.title);
        }
      } catch (e) {
        // Silently fail - results might not exist yet (scan still running)
      }
    };
    fetchExtensionInfo();

    return () => { cancelled = true; };
  }, [scanId]);

  // Calculate scan progress based on stage
  useEffect(() => {
    if (!scanStage) return;
    
    const stageProgressMap = {
      extracting: 14,
      security_scan: 28,
      building_evidence: 42,
      applying_rules: 71,
      generating_report: 100,
    };
    
    setScanProgress(stageProgressMap[scanStage] || 0);
  }, [scanStage]);

  // Poll scan status while on this page (supports direct refresh/back navigation)
  // Stops polling once scan completes or fails to save server resources.
  // Also detects "already scanned" extensions (first poll returns scanned=true
  // before any in-progress state was observed).
  useEffect(() => {
    if (!scanId) return;

    let cancelled = false;
    let intervalId = null;

    const checkStatus = async () => {
      if (cancelled) return;

      try {
        const status = await realScanService.checkScanStatus(scanId);
        if (cancelled) return;

        // Check for API key errors (401)
        if (status.error_code === 401 || (status.status === "failed" && (status.error?.includes("API key") || status.error?.includes("Connection is down")))) {
          setError("Connection is down try back in a while");
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
          return;
        }
        if (status.status === "failed") {
          if (status.error) setError(status.error);
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
          return;
        }

        // Track whether we've ever seen an in-progress (non-complete) state.
        if (!status.scanned) {
          hasSeenInProgressRef.current = true;
        }

        if (status.scanned) {
          if (intervalId) { clearInterval(intervalId); intervalId = null; }

          const wasAlreadyScanned = !hasSeenInProgressRef.current;
          if (wasAlreadyScanned) {
            setAlreadyScanned(true);
            setScanProgress(100);
          }
          setScanComplete(true);

          // Fetch results then auto-redirect to results page (no "View Results" step).
          try {
            const results = await realScanService.getRealScanResults(scanId);
            if (!cancelled && results) {
              setScanResults(results);
              setCurrentExtensionId(scanId);
            }
            const extId = results?.extension_id || scanId;
            const extName = results?.extension_name;
            const route = getScanResultsRoute(extId, extName);
            if (route) navigate(route, { replace: true });
          } catch (_e) {
            const route = getScanResultsRoute(scanId);
            if (route) navigate(route, { replace: true });
          }
        }
      } catch (e) {
        if (cancelled) return;
        if (e.message?.includes("401") || e.message?.includes("API key") || e.message?.includes("Connection is down")) {
          setError("Connection is down try back in a while");
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
        }
      }
    };

    // Kick once immediately and then poll
    checkStatus();
    intervalId = setInterval(checkStatus, 2500);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [scanId, navigate, setError, setScanResults, setCurrentExtensionId]);

  // Reset state when scanId changes or on mount
  useEffect(() => {
    if (scanId) {
      setScanComplete(false);
      setAlreadyScanned(false);
      hasSeenInProgressRef.current = false;
    }
  }, [scanId]);

  const shouldShowLoading = !!scanId;

  // Handle errors (show inline on progress page)
  useEffect(() => {
    if (error && shouldShowLoading) {
      let displayError = error;
      if (error.includes("API key") || error.includes("Invalid API key") || error.includes("Authentication") || error.includes("401") || error.includes("sk-proj")) {
        displayError = "Connection is down try back in a while";
      }
      setErrorMessage(displayError);
    }
  }, [error, shouldShowLoading]);

  // Catch any unhandled errors (parsing, network, etc.)
  useEffect(() => {
    const handleError = (event) => {
      if (shouldShowLoading) {
        let errorMsg = "Something went wrong";
        
        // Handle different error types
        if (event.error) {
          errorMsg = event.error?.message || String(event.error);
        } else if (event.message) {
          errorMsg = event.message;
        }
        
        // Check for common error patterns
        if (errorMsg.includes("401") || errorMsg.includes("API key") || errorMsg.includes("Invalid API key") || errorMsg.includes("Connection is down")) {
          errorMsg = "Connection is down try back in a while";
        } else if (errorMsg.includes("quota") || errorMsg.includes("token_quota") || (errorMsg.includes("403") && errorMsg.includes("token"))) {
          errorMsg = "Scan analysis quota exceeded. Check your provider limits or try again later.";
        } else if (errorMsg.includes("Connection refused") || errorMsg.includes("Errno 61") || errorMsg.includes("LLM service")) {
          errorMsg = "Scan analysis service unavailable. Check your provider configuration.";
        } else if (errorMsg.includes("JSON") || errorMsg.includes("parse")) {
          errorMsg = "Failed to parse server response. The scan may still be running.";
        } else if (errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("Failed to fetch")) {
          errorMsg = "Network error occurred. Check your connection and try again.";
        }
        
        setErrorMessage(errorMsg);
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event) => {
      if (shouldShowLoading) {
        let errorMsg = "Something went wrong";
        
        if (event.reason) {
          if (typeof event.reason === "string") {
            errorMsg = event.reason;
          } else if (event.reason?.message) {
            errorMsg = event.reason.message;
          } else {
            errorMsg = String(event.reason);
          }
        }
        
        // Check for API key errors first
        if (errorMsg.includes("401") || errorMsg.includes("API key") || errorMsg.includes("Invalid API key") || errorMsg.includes("Authentication") || errorMsg.includes("sk-proj") || errorMsg.includes("Connection is down")) {
          errorMsg = "Connection is down try back in a while";
        } else if (errorMsg.includes("quota") || errorMsg.includes("token_quota") || (errorMsg.includes("403") && errorMsg.includes("token"))) {
          errorMsg = "Scan analysis quota exceeded. Check your provider limits or try again later.";
        } else if (errorMsg.includes("Connection refused") || errorMsg.includes("Errno 61") || errorMsg.includes("LLM service")) {
          errorMsg = "Scan analysis service unavailable. Check your provider configuration.";
        } else if (errorMsg.includes("JSON") || errorMsg.includes("parse")) {
          errorMsg = "Failed to parse server response. The scan may still be running.";
        } else if (errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("Failed to fetch")) {
          errorMsg = "Network error occurred. Check your connection and try again.";
        }
        
        setErrorMessage(errorMsg);
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [shouldShowLoading]);

  const handleDismissError = useCallback(() => {
    setError(null);
    setErrorMessage("");
  }, [setError]);

  // Status label: Completed | In progress | Not complete
  const getScanStatusLabel = () => {
    if (scanComplete) return alreadyScanned ? "Previously scanned" : "Completed";
    if (scanProgress > 0 || scanStage) return "In progress";
    return "Not complete";
  };

  const getStageLabel = (stage) => {
    const labels = {
      extracting: "Extracting extension…",
      security_scan: "Running security scan…",
      building_evidence: "Building evidence…",
      applying_rules: "Applying rules…",
      generating_report: "Generating report…",
    };
    return labels[stage] || "Processing…";
  };

  // Always render something - never show blank page
  // Show error if normalized ID is empty (invalid format or missing)
  if (!scanId) {
    if (import.meta.env.DEV) {
      logger.warn("[ScanProgressPage] No valid scanId found. Raw params:", params);
    }
    return (
      <div className="scan-progress-page">
        <div className="progress-container">
          <div className="no-scan-state">
            <div className="no-scan-icon">⚠️</div>
            <h2>Invalid Scan ID</h2>
            <p>
              {rawScanId 
                ? `The scan ID "${rawScanId}" is not in a valid format. Expected a Chrome extension ID (32 characters a-p) or upload scan UUID.`
                : "No scan ID provided in the URL."}
            </p>
            <Button onClick={() => navigate("/scan")} variant="default">
              Go to Scanner
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showLoadingScreen = shouldShowLoading;

  return (
    <>
      <SEOHead
        title="Scan in progress"
        description="Extension scan in progress."
        pathname={location.pathname}
        noindex
      />
      <div className="scan-progress-page">
      {showLoadingScreen ? (
        <>
          {/* Minimal centered: icon, name, progress bar, status */}
          <div className="scan-progress-center">
            <div className="scan-progress-minimal-card">
              <div className="scan-progress-icon-wrap">
                <img
                  src={extensionLogo}
                  alt=""
                  className="scan-progress-minimal-icon"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = EXTENSION_ICON_PLACEHOLDER;
                  }}
                />
              </div>
              <p className="scan-progress-minimal-name">
                {extensionName || `Extension ${scanId?.substring(0, 8)}...`}
              </p>
              {scanStage && (
                <p className="scan-progress-stage-label">{getStageLabel(scanStage)}</p>
              )}
              <div className="scan-progress-minimal-bar-wrap">
                <div className="scan-progress-minimal-bar">
                  <div
                    className={`scan-progress-minimal-fill${alreadyScanned ? " already-scanned" : ""}`}
                    style={{ width: `${alreadyScanned ? 100 : scanProgress}%` }}
                  />
                </div>
                <div className="scan-progress-minimal-meta">
                  <span className="scan-progress-minimal-pct">
                    {alreadyScanned ? "100" : Math.round(scanProgress)}%
                  </span>
                  <span className="scan-progress-minimal-label">{getScanStatusLabel()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inline error (no overlay) */}
          {errorMessage && (
            <div className="scan-progress-inline-error">
              <h3>Something went wrong</h3>
              <p>{errorMessage}</p>
              <div className="scan-progress-inline-error-actions">
                <Button onClick={handleDismissError} variant="default">
                  Dismiss
                </Button>
                <Button onClick={() => navigate("/scan")} variant="outline">
                  Go to Scanner
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="progress-container">
          {/* Header */}
          <div className="progress-header">
            <Link to="/scan" className="back-link">
              ← Back to Scanner
            </Link>
            <div className="extension-header">
              <img 
                src={extensionLogo} 
                alt="Extension icon" 
                className="extension-logo"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = EXTENSION_ICON_PLACEHOLDER;
                }}
              />
              <div className="extension-header-text">
                <h1 className="progress-title">Scan Status</h1>
                <p className="progress-subtitle">
                  Extension ID: <code>{scanId}</code>
                </p>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="error-state">
              <div className="error-icon">❌</div>
              <h2>Scan Failed</h2>
              <p className="error-message">{error}</p>
              <div className="error-actions">
                <Button onClick={() => setError(null)} variant="outline">
                  Dismiss
                </Button>
                <Button onClick={() => navigate("/scan")}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* No Active Scan State */}
          {!shouldShowLoading && !error && (
            <div className="no-scan-state">
              <div className="no-scan-icon">🔍</div>
              <h2>No Active Scan</h2>
              <p>
                There's no active scan for extension ID: <code>{scanId}</code>
                <br />
                The scan may have completed, or you can start a new scan.
              </p>
              <div className="no-scan-actions">
                <Button onClick={() => navigate(`/scan/results/${scanId}`)} variant="default">
                  Check Results
                </Button>
                <Button onClick={() => navigate("/scan")} variant="outline">
                  Start New Scan
                </Button>
                <Button onClick={() => navigate("/scan/history")} variant="outline">
                  View History
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
};

export default ScanProgressPage;

