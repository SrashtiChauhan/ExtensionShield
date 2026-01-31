import React, { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import ScanProgress from "../../components/ScanProgress";
import { useScan } from "../../context/ScanContext";
import "./ScanProgressPage.scss";

const ScanProgressPage = () => {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const {
    isScanning,
    scanStage,
    error,
    setError,
    scanResults,
    currentExtensionId,
  } = useScan();

  // If we have results and the scan is complete, redirect to results page
  useEffect(() => {
    if (scanResults && !isScanning && currentExtensionId === scanId) {
      navigate(`/scanner/results/${scanId}`, { replace: true });
    }
  }, [scanResults, isScanning, scanId, currentExtensionId, navigate]);

  // If user navigates directly here without an active scan, show appropriate message
  const hasActiveScan = isScanning && currentExtensionId === scanId;

  return (
    <div className="scan-progress-page">
      <div className="progress-container">
        {/* Header */}
        <div className="progress-header">
          <Link to="/scanner" className="back-link">
            ← Back to Scanner
          </Link>
          <h1 className="progress-title">
            {hasActiveScan ? "Analyzing Extension" : "Scan Status"}
          </h1>
          <p className="progress-subtitle">
            Extension ID: <code>{scanId}</code>
          </p>
        </div>

        {/* Active Scan Progress */}
        {hasActiveScan && (
          <>
            {/* Visual Scanner Animation */}
            <div className="scanner-visual">
              <div className="scanner-ring outer"></div>
              <div className="scanner-ring middle"></div>
              <div className="scanner-ring inner"></div>
              <div className="scanner-core">
                <div className="core-pulse"></div>
                <span className="core-icon">🔍</span>
              </div>
            </div>

            {/* Stage Progress */}
            <div className="stage-progress-wrapper">
              <ScanProgress currentStage={scanStage} />
            </div>

            {/* Status Message */}
            <div className="status-message">
              <div className="status-indicator">
                <span className="pulse-dot"></span>
                <span>Scan in progress</span>
              </div>
              <p className="status-description">
                {scanStage === "extracting" && "Downloading and extracting extension package..."}
                {scanStage === "security_scan" && "Running security analysis..."}
                {scanStage === "building_evidence" && "Analyzing code patterns..."}
                {scanStage === "applying_rules" && "Evaluating security policies..."}
                {scanStage === "generating_report" && "Generating final report..."}
              </p>
            </div>

            {/* What's Happening Section */}
            <div className="analysis-info">
              <h3>What we're checking:</h3>
              <div className="check-grid">
                <div className="check-item">
                  <span className="check-icon">🔐</span>
                  <div>
                    <strong>Permission Analysis</strong>
                    <p>Evaluating declared permissions against functionality</p>
                  </div>
                </div>
                <div className="check-item">
                  <span className="check-icon">📜</span>
                  <div>
                    <strong>Code Patterns</strong>
                    <p>Scanning for suspicious or risky code patterns</p>
                  </div>
                </div>
                <div className="check-item">
                  <span className="check-icon">⚖️</span>
                  <div>
                    <strong>Policy Compliance</strong>
                    <p>Checking against Chrome Web Store policies</p>
                  </div>
                </div>
                <div className="check-item">
                  <span className="check-icon">🛡️</span>
                  <div>
                    <strong>Threat Intelligence</strong>
                    <p>Cross-referencing with known threat databases</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

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
              <Button onClick={() => navigate("/scanner")}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* No Active Scan State */}
        {!hasActiveScan && !error && (
          <div className="no-scan-state">
            <div className="no-scan-icon">🔍</div>
            <h2>No Active Scan</h2>
            <p>
              There's no active scan for this extension ID. 
              You can start a new scan or check the scan history.
            </p>
            <div className="no-scan-actions">
              <Button onClick={() => navigate("/scanner")} variant="default">
                Start New Scan
              </Button>
              <Button onClick={() => navigate("/history")} variant="outline">
                View History
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanProgressPage;

