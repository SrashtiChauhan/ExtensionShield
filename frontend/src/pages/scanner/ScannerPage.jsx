import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import EnhancedUrlInput from "../../components/EnhancedUrlInput";
import { useScan } from "../../context/ScanContext";
import "./ScannerPage.scss";

const ScannerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    url,
    setUrl,
    isScanning,
    error,
    setError,
    scanHistory,
    startScan,
    handleFileUpload,
    loadScanHistory,
    loadScanFromHistory,
  } = useScan();

  const [recentScans, setRecentScans] = useState([]);

  // Load recent scans on mount
  useEffect(() => {
    loadScanHistory().then((history) => {
      if (history && history.length > 0) {
        setRecentScans(history.slice(0, 4)); // Show only 4 recent
      }
    });
  }, [loadScanHistory]);

  // Handle prefilled URL from homepage
  useEffect(() => {
    if (location.state?.prefillUrl) {
      setUrl(location.state.prefillUrl);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setUrl]);

  const handleScanClick = async () => {
    if (!url.trim()) {
      setError("Please enter a Chrome Web Store URL");
      return;
    }
    await startScan(url);
  };

  return (
    <div className="scanner-page">
      <section className="scanner-hero">
        {/* Background */}
        <div className="scanner-bg">
          <div className="bg-gradient" />
          <div className="bg-grid" />
        </div>

        {/* Main Content */}
        <div className="scanner-content">
          {/* Header */}
          <div className="scanner-header">
            <h1>Extension Scanner</h1>
            <p>Analyze any Chrome extension for security threats and compliance issues</p>
          </div>

          {/* Steps Indicator */}
          <div className="scan-steps">
            <div className="step active">
              <span className="step-num">1</span>
              <span className="step-text">Paste URL or Upload</span>
            </div>
            <div className="step-line" />
            <div className="step">
              <span className="step-num">2</span>
              <span className="step-text">Scan</span>
            </div>
            <div className="step-line" />
            <div className="step">
              <span className="step-num">3</span>
              <span className="step-text">View Report</span>
            </div>
          </div>

          {/* Scan Input Box */}
          <div className="scan-input-wrapper">
            <EnhancedUrlInput
              value={url}
              onChange={setUrl}
              onScan={handleScanClick}
              onFileUpload={handleFileUpload}
              isScanning={isScanning}
            />
          </div>

          {/* Error Message */}
          {error && !error.includes("✅") && !error.includes("🔄") && (
            <div className="error-message">
              <span>{error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {/* Quick Links */}
          <div className="quick-links">
            <button className="link-btn" onClick={() => navigate("/reports")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <span>View Sample Report</span>
            </button>
            {recentScans.length > 0 && (
              <button className="link-btn" onClick={() => navigate("/history")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span>View History</span>
              </button>
            )}
          </div>
        </div>

        {/* Recent Scans - Only if exists */}
        {recentScans.length > 0 && (
          <div className="recent-scans">
            <div className="recent-header">
              <h3>Recent Scans</h3>
              <button onClick={() => navigate("/history")}>View All →</button>
            </div>
            <div className="recent-list">
              {recentScans.map((scan, index) => (
                <div
                  key={index}
                  className="recent-item"
                  onClick={() => loadScanFromHistory(scan.extension_id || scan.extensionId)}
                >
                  <div className="recent-icon">📦</div>
                  <div className="recent-info">
                    <span className="recent-name">
                      {scan.extension_name || scan.extensionName || scan.extension_id || scan.extensionId}
                    </span>
                    <span className="recent-date">
                      {new Date(scan.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={`recent-risk ${(scan.risk_level || scan.riskLevel || "").toLowerCase()}`}>
                    {(scan.risk_level || scan.riskLevel || "N/A").toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Minimal Footer */}
      <footer className="scanner-footer">
        <p>
          All uploads are processed securely and deleted after 24 hours.
          <a href="#privacy"> Privacy Policy</a>
        </p>
      </footer>
    </div>
  );
};

export default ScannerPage;
