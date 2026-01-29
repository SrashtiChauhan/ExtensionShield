import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import databaseService from "../services/databaseService";
import "./ScanHistoryPage.scss";

/**
 * ScanHistoryPage Component
 * Displays viewing history of scanned extensions with premium dark theme design.
 * Requires authentication to view scan history.
 */
const ScanHistoryPage = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScans, setSelectedScans] = useState(new Set());
  const navigate = useNavigate();
  const { user, isAuthenticated, openSignInModal } = useAuth();

  useEffect(() => {
    const loadHistory = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const history = await databaseService.getScanHistory(100);
        const formattedHistory = history.map((item) => ({
          ...item,
          name: item.extension_name || item.extensionId || item.extension_id,
          id: item.extension_id || item.extensionId,
          filesAnalyzed: item.total_files || 0,
          downloadSize: item.downloadSize || "N/A",
          version: item.version || "N/A",
          securityScore: item.security_score || 0,
          riskLevel: item.risk_level || "unknown",
          totalFindings: item.total_findings || 0,
        }));
        setScans(formattedHistory);
      } catch (error) {
        console.error("Failed to load scan history:", error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [isAuthenticated]);

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case "high":
        return "⊘";
      case "medium":
        return "⚠";
      case "low":
        return "✓";
      default:
        return "?";
    }
  };

  const getScoreClass = (score) => {
    if (score >= 70) return "score-high";
    if (score >= 40) return "score-medium";
    return "score-low";
  };

  const filteredScans = scans.filter(
    (scan) =>
      scan.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const dataToExport = filteredScans.map((scan) => ({
      id: scan.id,
      name: scan.name,
      version: scan.version,
      timestamp: scan.timestamp,
      securityScore: scan.securityScore,
      riskLevel: scan.riskLevel,
      totalFindings: scan.totalFindings,
      filesAnalyzed: scan.filesAnalyzed,
    }));

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-atlas-history-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleScanSelection = (scanId) => {
    const newSelected = new Set(selectedScans);
    if (newSelected.has(scanId)) {
      newSelected.delete(scanId);
    } else {
      newSelected.add(scanId);
    }
    setSelectedScans(newSelected);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = new Date(timestamp);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).replace(",", "");
    } catch {
      return timestamp;
    }
  };

  // Login Required State
  if (!isAuthenticated) {
    return (
      <div className="history-page">
        <div className="history-bg-effects">
          <div className="history-bg-gradient history-gradient-1" />
          <div className="history-bg-gradient history-gradient-2" />
        </div>

        <div className="history-content">
          <header className="history-header">
            <div className="history-header-content">
              <h1 className="history-title">
                <span className="history-title-icon">📋</span>
                Scan History
              </h1>
              <p className="history-subtitle">
                View and manage your extension security scan history
              </p>
            </div>
          </header>

          <div className="login-required-minimal">
            <span className="login-lock-icon">🔐</span>
            <p className="login-minimal-text">Sign in to view your history</p>
            <button className="login-minimal-btn" onClick={openSignInModal}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-bg-effects">
        <div className="history-bg-gradient history-gradient-1" />
        <div className="history-bg-gradient history-gradient-2" />
      </div>

      <div className="history-content">
        {/* Header */}
        <header className="history-header">
          <div className="history-header-content">
            <h1 className="history-title">
              <span className="history-title-icon">📋</span>
              Scan History
            </h1>
            <p className="history-subtitle">
              View and manage your extension security scan history
            </p>
          </div>
        </header>

        {/* Toolbar */}
        <div className="history-toolbar">
          <div className="toolbar-left">
            <div className="scan-count-badge">
              <span>Recent Scans</span>
              <span className="count-number">{scans.length}</span>
            </div>
          </div>

          <div className="toolbar-right">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search scans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="export-btn" onClick={handleExport}>
              <span className="export-btn-icon">↓</span>
              Export
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span className="loading-text">Loading scan history...</span>
          </div>
        )}

        {/* Scan List */}
        {!loading && filteredScans.length > 0 && (
          <div className="scan-list">
            {filteredScans.map((scan) => (
              <div key={scan.id} className="scan-card">
                <div
                  className={`scan-checkbox ${selectedScans.has(scan.id) ? "selected" : ""}`}
                  onClick={() => toggleScanSelection(scan.id)}
                />

                <div className="scan-info">
                  <h3 className="scan-name">{scan.name}</h3>
                  <span className="scan-meta">
                    Version {scan.version} • {formatTimestamp(scan.timestamp)}
                  </span>
                </div>

                <div className="scan-stat">
                  <span className="stat-label">Score</span>
                  <span className={`stat-value ${getScoreClass(scan.securityScore)}`}>
                    {scan.securityScore}/100
                  </span>
                </div>

                <div className="scan-stat">
                  <span className="stat-label">Risk</span>
                  <div className={`risk-badge risk-${scan.riskLevel}`}>
                    <span className="risk-icon">{getRiskIcon(scan.riskLevel)}</span>
                    <span>{scan.riskLevel.toUpperCase()}</span>
                  </div>
                </div>

                <div className="scan-stat">
                  <span className="stat-label">Findings</span>
                  <span className="stat-value">{scan.totalFindings}</span>
                </div>

                <div className="scan-stat">
                  <span className="stat-label">Files</span>
                  <span className="stat-value">{scan.filesAnalyzed}</span>
                </div>

                <button
                  className="view-btn"
                  onClick={() => navigate(`/scanner/results/${scan.id}`)}
                >
                  <span className="view-btn-icon">👁</span>
                  View
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredScans.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <h3 className="empty-title">
              {searchTerm ? "No matching scans found" : "No scan history yet"}
            </h3>
            <p className="empty-description">
              {searchTerm
                ? `No scans match "${searchTerm}". Try a different search term.`
                : "Start analyzing Chrome extensions to build your security scan history."}
            </p>
            {!searchTerm && (
              <button
                className="empty-action-btn"
                onClick={() => navigate("/scanner")}
              >
                <span>⚡</span>
                Start Your First Scan
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanHistoryPage;
