import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import EnhancedMetricCard from "../components/EnhancedMetricCard";
import EnhancedUrlInput from "../components/EnhancedUrlInput";
import TabbedResultsPanel from "../components/TabbedResultsPanel";
import StatusMessage from "../components/StatusMessage";
import ScanProgress from "../components/ScanProgress";
import realScanService from "../services/realScanService";
import databaseService from "../services/databaseService";
import FileViewerModal from "../components/FileViewerModal";
import "./DashboardPage.scss";

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState(null);
  const [scanResults, setScanResults] = useState(null);
  const [error, setError] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [fileViewerModal, setFileViewerModal] = useState({
    isOpen: false,
    file: null,
  });

  useEffect(() => {
    loadScanHistory();
    loadDashboardStats();
  }, []);

  // Handle prefilled URL from homepage scanner
  useEffect(() => {
    if (location.state?.prefillUrl) {
      setUrl(location.state.prefillUrl);
      // Clear the state so refresh doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadScanHistory = async () => {
    try {
      const history = await databaseService.getScanHistory(50);
      setScanHistory(history);
      
      // Initially show history if there is any
      if (history.length > 0) {
        setShowHistory(true);
      }
    } catch (error) {
      console.error("Error loading scan history:", error);
      setScanHistory([]);
    }
  };

  const [dashboardStats, setDashboardStats] = useState({
    totalScans: { value: 0, sparkline: [0] },
    highRisk: { value: 0, sparkline: [0] },
    totalFiles: { value: 0, sparkline: [0] },
    totalVulnerabilities: { value: 0, sparkline: [0] }
  });

  const loadDashboardStats = async () => {
    try {
      const metrics = await databaseService.getDashboardMetrics();
      setDashboardStats(metrics);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    }
  };

  const extractExtensionId = (url) => {
    return realScanService.extractExtensionId(url);
  };

  const handleScanClick = async () => {
    if (!url.trim()) {
      setError("Please enter a Chrome Web Store URL");
      return;
    }
    await startScan();
  };

  const handleFileUpload = async (file) => {
    setIsScanning(true);
    setError(null);
    setScanResults(null);
    setScanStage("extracting");

    try {
      setError("📤 Uploading file... This may take a moment.");
      
      // Upload the file
      const uploadResult = await realScanService.uploadAndScan(file);
      
      if (!uploadResult || !uploadResult.extension_id) {
        throw new Error("Failed to upload file");
      }

      const extensionId = uploadResult.extension_id;
      setError(`🔄 File uploaded successfully! Starting analysis...`);

      // Wait for scan completion
      await waitForScanCompletion(extensionId);

      // Get results
      const results = await realScanService.getRealScanResults(extensionId);
      setScanResults(results);
      setError("");
      setScanStage(null);
      
      // Refresh history and stats
      await loadScanHistory();
      await loadDashboardStats();
    } catch (err) {
      setError(err.message || "Failed to upload and scan file.");
      setScanStage(null);
    } finally {
      setIsScanning(false);
    }
  };



  // const handleScanSampleExtension = () => {
  //   const sampleUrl = "https://chromewebstore.google.com/detail/adblock/gighmmpiobklfepjocnamgkkbiglidom";
  //   setUrl(sampleUrl);
  //   setShowSampleModal(false);
  //   setTimeout(() => {
  //     handleScanClick();
  //   }, 500);
  // };

  const startScan = async () => {
    setIsScanning(true);
    setError(null);
    setScanResults(null);
    setScanStage("extracting");

    try {
      const extId = extractExtensionId(url);
      if (!extId) {
        throw new Error("Invalid Chrome Web Store URL format");
      }

      const status = await realScanService.checkScanStatus(extId);

      if (!status.scanned) {
        setError("🔄 Starting security scan... This may take a few minutes for large extensions.");
        const scanTrigger = await realScanService.triggerScan(url);

        // Check for success based on running status available in the response
        if (scanTrigger.status !== "running") {
          throw new Error(scanTrigger.error || "Failed to start scan");
        }

        if (scanTrigger.already_scanned) {
          setError("✅ Extension already scanned! Loading results...");
          setScanStage(null);
        } else {
          await waitForScanCompletion(extId);
        }
      } else {
        setScanStage(null);
      }

      const results = await realScanService.getRealScanResults(extId);
      setScanResults(results);
      setError("");
      setScanStage(null);
      await loadScanHistory();
      await loadDashboardStats();
    } catch (err) {
      setError(err.message || "Failed to scan extension.");
      setScanStage(null);
    } finally {
      setIsScanning(false);
    }
  };

  const waitForScanCompletion = async (extensionId, maxAttempts = 120) => {
    const stages = [
      "extracting",
      "security_scan",
      "building_evidence",
      "applying_rules",
      "generating_report",
    ];
    
    // Simulate stage progression
    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      setScanStage(stages[stageIndex]);
      
      // Each stage takes ~10-15 seconds (simulated)
      const stageDuration = 10 + Math.random() * 5;
      const steps = Math.ceil(stageDuration / 2);
      
      for (let step = 0; step < steps; step++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Check if scan completed early
        const status = await realScanService.checkScanStatus(extensionId);
        if (status.scanned) {
          setScanStage("generating_report");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          setError("✅ Scan completed! Loading results...");
          return;
        }

        if (status.status === "failed") {
          throw new Error(status.error || "Scan failed on the server.");
        }
      }
    }
    
    // Final check
    const status = await realScanService.checkScanStatus(extensionId);
    if (status.scanned) {
      setError("✅ Scan completed! Loading results...");
      return;
    }
    
    throw new Error("Scan timeout - extension analysis took too long (10 minutes limit)");
  };

  const loadScanFromHistory = async (extId) => {
    try {
      // Try database first
      let results = await databaseService.getScanResult(extId);
      
      // Fallback to API if not in database
      if (!results) {
        results = await realScanService.getRealScanResults(extId);
      }
      
      // Format the results if they're raw from database
      if (results && !results.files) {
        results = realScanService.formatRealResults(results);
      }
      
      setScanResults(results);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load scan results from history.");
    }
  };

  const handleViewFile = async (file) => {
    setFileViewerModal({ isOpen: true, file: file });
  };

  const getFileContent = async (extensionId, filePath) => {
    return await realScanService.getFileContent(extensionId, filePath);
  };

  const handleAnalyzeWithAI = async (file) => {
    alert(`🤖 AI Analysis for ${file.name}\n\nThis would analyze the file content using GPT-OSS for security insights.`);
  };

  const handleViewFindingDetails = (finding) => {
    const details = `🚨 Security Finding Details\n\nFile: ${finding.file}\nLine: ${finding.line}\nSeverity: ${finding.severity}\nTitle: ${finding.title}\nDescription: ${finding.description}`;
    alert(details);
  };

  const handleViewAllFindings = () => {
    alert(`Viewing all ${scanResults.totalFindings} findings.`);
  };

  return (
    <div className="dashboard-page">
      {/* Hero Section - Scan-First Design */}
      <section className="dashboard-hero">
        {/* Header */}
        <div className="hero-header">
          <h1 className="hero-main-title">
            Extension Compliance Scanner
          </h1>
          <p className="hero-description">
            Evidence-grade PASS/FAIL/NEEDS_REVIEW verdicts with deterministic rules and code-level citations.
          </p>
        </div>

        {/* 1-2-3 Micro Steps */}
        <div className="scan-steps">
          <div className="scan-step">
            <div className="step-number">1</div>
            <div className="step-text">Paste Web Store URL or upload CRX/ZIP</div>
          </div>
          <div className="scan-step-connector"></div>
          <div className="scan-step">
            <div className="step-number">2</div>
            <div className="step-text">Scan</div>
          </div>
          <div className="scan-step-connector"></div>
          <div className="scan-step">
            <div className="step-number">3</div>
            <div className="step-text">View Evidence Report</div>
          </div>
        </div>

        {/* Main Scan Input - Hero Component */}
        <div className="scan-hero-box">
          <EnhancedUrlInput
            value={url}
            onChange={setUrl}
            onScan={handleScanClick}
            onFileUpload={handleFileUpload}
            isScanning={isScanning}
          />
        </div>

        {/* Scan Progress */}
        {isScanning && scanStage && (
          <ScanProgress currentStage={scanStage} />
        )}

        {/* View Sample Report Button */}
        <div className="sample-report-section">
          <button
            className="sample-report-btn"
            onClick={() => navigate("/sample-report")}
          >
            View Sample Report
          </button>
        </div>

        {/* Glowing Arc Separator */}
        <div className="hero-glow-arc">
          <div className="glow-arc-beam"></div>
        </div>

        {/* Lower Section - Below Glowing Arc */}
        <div className="hero-lower-section">
          {/* Stats Overview */}
          <div className="dashboard-content-wrapper">
            <div className="section-header-row">
              <h2 className="section-title">
                <span className="icon">📊</span> Security Overview
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="history-toggle-btn"
              >
                {showHistory ? "Hide History" : "Show History"}
              </Button>
            </div>

            <div className="stats-grid">
              <EnhancedMetricCard
                icon="🔍"
                title="Total Scans"
                subtitle="Analyzed Extensions"
                value={dashboardStats.totalScans.value}
                label={dashboardStats.totalScans.value === 1 ? "Scan completed" : "Scans completed"}
                variant="primary"
                trend={null}
                sparklineData={dashboardStats.totalScans.sparkline}
                helpText="Total number of unique Chrome extensions analyzed."
              />
              <EnhancedMetricCard
                icon="🛡️"
                title="High Risk"
                subtitle="Critical Threats"
                value={dashboardStats.highRisk.value}
                label="Critical issues found"
                variant="danger"
                trend={null}
                sparklineData={dashboardStats.highRisk.sparkline}
                helpText="Extensions identified with critical security vulnerabilities."
              />
              <EnhancedMetricCard
                icon="📁"
                title="Code Analysis"
                subtitle="Files Processed"
                value={dashboardStats.totalFiles.value}
                label="Source files analyzed"
                variant="success"
                trend={null}
                sparklineData={dashboardStats.totalFiles.sparkline}
                helpText="Total file count processed across all scans."
              />
              <EnhancedMetricCard
                icon="🚨"
                title="Vulnerabilities"
                subtitle="Issues Detected"
                value={dashboardStats.totalVulnerabilities.value}
                label="Security alerts"
                variant="warning"
                trend={null}
                sparklineData={dashboardStats.totalVulnerabilities.sparkline}
                helpText="Aggregated count of security findings and potential risks."
              />
            </div>
          </div>

          {/* Statistics Section - Hidden: Internal rule engine details not exposed to users */}
          {/* <div className="hero-statistics">
            <div className="stat-item">
              <div className="stat-number">2</div>
              <div className="stat-label">Rulepacks Enabled</div>
              <div className="stat-description">CWS + DPDP v0</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">47</div>
              <div className="stat-label">Rules Executed</div>
              <div className="stat-description">Deterministic checks per scan</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">132</div>
              <div className="stat-label">Evidence Items</div>
              <div className="stat-description">Code snippets captured</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">~45s</div>
              <div className="stat-label">Avg Scan Time</div>
              <div className="stat-description">Typical analysis duration</div>
            </div>
          </div> */}
        </div>
      </section>

      {/* Recent Activity / History */}
      {showHistory && scanHistory.length > 0 && (
        <div className="dashboard-content-wrapper mt-8">
          <h3 className="section-title mb-4">
            <span className="icon">🕒</span> Recent Activity
          </h3>
          <div className="history-grid">
            {scanHistory.slice(0, 8).map((scan, index) => (
              <div
                key={index}
                className="history-tile"
                onClick={() => loadScanFromHistory(scan.extension_id || scan.extensionId)}
              >
                <div className="history-content">
                  <div className="history-icon-wrapper">
                    <span className="history-icon">📦</span>
                  </div>
                  <div className="history-info">
                    <h4>{scan.extension_name || scan.extensionName || scan.extension_id || scan.extensionId}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{new Date(scan.timestamp).toLocaleDateString()}</span>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span>Score: {scan.security_score || scan.securityScore || "N/A"}</span>
                    </div>
                    <div className="mt-2">
                      <Badge
                        variant={
                          (scan.risk_level || scan.riskLevel || "").toUpperCase() === "HIGH" ? "destructive" :
                            (scan.risk_level || scan.riskLevel || "").toUpperCase() === "MEDIUM" ? "secondary" :
                              "outline"
                        }
                        className="text-[10px] h-5 px-2"
                      >
                        {(scan.risk_level || scan.riskLevel || "UNKNOWN").toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status & Loading */}
      {error && (
        <StatusMessage
          type={error.includes("✅") ? "success" : error.includes("🔄") ? "loading" : "error"}
          message={error}
          onDismiss={() => setError("")}
        />
      )}

      {isScanning && (
        <div className="scanning-section">
          <div className="scanning-content">
            <div className="simple-loader">
              <div className="spinner"></div>
            </div>
            <h3 className="scanning-title">Performing Deep Scan</h3>
            <p className="scanning-text">Analyzing extension package structure, permissions, and code patterns...</p>
            <div className="scanning-steps">
              <span className="step active">📥 Fetching</span>
              <span className="step">📦 Unpacking</span>
              <span className="step">🔍 Static Analysis</span>
              <span className="step">🛡️ Threat Check</span>
            </div>
          </div>
          
          {/* Input Section Below Loading */}
          <div className="scanning-input-section">
            <div className="scanning-input-label">Chrome Web Store URL</div>
            <code className="scanning-sample-url">https://chromewebstore.google.com/detail/ais-visa-auto-rescheduler/bmihdnoolhjbhjcoiamedcghafihcooi</code>
            <div className="scanning-divider">
              <span>OR</span>
            </div>
            <div className="scanning-input-label">Upload CRX/ZIP File</div>
            <div className="scanning-cta">
              <span className="scanning-arrow">→</span>
              <span>Scan & Analyze</span>
            </div>
            <p className="scanning-help-text">
              Enter a Chrome Web Store URL or upload a .crx/.zip file to analyze the extension's security posture
            </p>
            <button
              className="sample-report-btn"
              onClick={() => navigate("/sample-report")}
            >
              View Sample Report
            </button>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {scanResults && (
        <div className="mt-8">
          <TabbedResultsPanel
            scanResults={scanResults}
            onViewFile={handleViewFile}
            onAnalyzeWithAI={handleAnalyzeWithAI}
            onViewFindingDetails={handleViewFindingDetails}
            onViewAllFindings={handleViewAllFindings}
          />
        </div>
      )}

      {/* Modals */}
      <FileViewerModal
        isOpen={fileViewerModal.isOpen}
        onClose={() => setFileViewerModal({ isOpen: false, file: null })}
        file={fileViewerModal.file}
        extensionId={scanResults?.extensionId}
        onGetFileContent={getFileContent}
      />

      {/* Footer Disclaimer */}
      <footer className="dashboard-footer">
        <p className="footer-disclaimer">
          Extension Compliance Scanner generates compliance reports using deterministic rule evaluation and static code analysis. Reports are evidence-based and do not constitute legal advice, compliance guarantees, or endorsement of any extension. All uploaded files are processed securely and deleted after 24 hours.
        </p>
      </footer>
    </div>
  );
};

export default DashboardPage;
