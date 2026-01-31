import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import TabbedResultsPanel from "../../components/TabbedResultsPanel";
import FileViewerModal from "../../components/FileViewerModal";
import realScanService from "../../services/realScanService";
import databaseService from "../../services/databaseService";
import "./ReportDetailPage.scss";

// Sample report mock data (for /reports/sample route)
const mockReportData = {
  extension_name: "Sample Extension Pro",
  scan_id: "scan_20241215_abc123xyz",
  timestamp: new Date().toISOString(),
  overall_verdict: "NEEDS_REVIEW",
  summary: {
    fail_count: 2,
    needs_review_count: 3,
    pass_count: 8,
  },
  // rulepacks hidden from users
  findings: [
    {
      id: "finding_001",
      verdict: "FAIL",
      rule_id: "SEC_PERM_001",
      title: "Excessive Permission Request",
      confidence: "HIGH",
      evidence_count: 2,
      explanation: "Extension requests '<all_urls>' permission without clear justification in manifest description. This violates Chrome Web Store policy 3.1 which requires extensions to request only the minimum permissions necessary for functionality.",
      evidence: [
        { file_path: "manifest.json", line_range: "12-15", snippet: '"permissions": ["storage", "tabs", "<all_urls>"]' },
        { file_path: "background.js", line_range: "45-52", snippet: "chrome.tabs.query({ url: ['<all_urls>'] }, (tabs) => { ... });" },
      ],
      citations: [
        { citation_id: "CWS_3.1", title: "Chrome Web Store Policy 3.1 - Permission Justification", source_link: "#" },
        { citation_id: "CWS_3.2", title: "Chrome Web Store Policy 3.2 - Limited Use Requirements", source_link: "#" },
      ],
    },
    {
      id: "finding_002",
      verdict: "NEEDS_REVIEW",
      rule_id: "SEC_PRIVACY_002",
      title: "Data Collection Without Disclosure",
      confidence: "MEDIUM",
      evidence_count: 3,
      explanation: "Extension collects user data (browsing history, form inputs) but privacy policy link in manifest is missing or invalid.",
      evidence: [
        { file_path: "background.js", line_range: "78-85", snippet: "chrome.history.search({ text: '', maxResults: 100 }, (results) => { ... });" },
        { file_path: "content.js", line_range: "23-30", snippet: "document.addEventListener('input', (e) => { collectFormData(e.target.value); });" },
        { file_path: "manifest.json", line_range: "8-8", snippet: '"privacy_policy": ""' },
      ],
      citations: [
        { citation_id: "DPDP_4.2", title: "DPDP v0 Section 4.2 - Data Collection Disclosure", source_link: "#" },
      ],
    },
    {
      id: "finding_003",
      verdict: "NEEDS_REVIEW",
      rule_id: "SEC_DATA_003",
      title: "Third-Party Data Sharing",
      confidence: "MEDIUM",
      evidence_count: 1,
      explanation: "Extension sends collected data to external domain without user consent mechanism.",
      evidence: [
        { file_path: "analytics.js", line_range: "12-18", snippet: "fetch('https://analytics.example.com/track', { method: 'POST', body: JSON.stringify(userData) });" },
      ],
      citations: [
        { citation_id: "CWS_3.5", title: "Chrome Web Store Policy 3.5 - Third-Party Data Sharing", source_link: "#" },
      ],
    },
    {
      id: "finding_004",
      verdict: "FAIL",
      rule_id: "SEC_STORAGE_004",
      title: "Sensitive Data Storage",
      confidence: "HIGH",
      evidence_count: 2,
      explanation: "Extension stores sensitive user credentials in chrome.storage.local without encryption.",
      evidence: [
        { file_path: "storage.js", line_range: "34-40", snippet: "chrome.storage.local.set({ password: userPassword, apiKey: apiKey });" },
        { file_path: "storage.js", line_range: "45-50", snippet: "const stored = await chrome.storage.local.get(['password', 'apiKey']);" },
      ],
      citations: [
        { citation_id: "DPDP_6.3", title: "DPDP v0 Section 6.3 - Data Security Requirements", source_link: "#" },
      ],
    },
    {
      id: "finding_005",
      verdict: "NEEDS_REVIEW",
      rule_id: "SEC_CODE_005",
      title: "Obfuscated Code Detected",
      confidence: "LOW",
      evidence_count: 1,
      explanation: "Code appears to be obfuscated or minified beyond standard practices.",
      evidence: [
        { file_path: "vendor.min.js", line_range: "1-1", snippet: "var _0x1a2b=['\\x48\\x65\\x6c\\x6c\\x6f','\\x57\\x6f\\x72\\x6c\\x64'];..." },
      ],
      citations: [
        { citation_id: "CWS_4.1", title: "Chrome Web Store Policy 4.1 - Code Review Requirements", source_link: "#" },
      ],
    },
  ],
};

const ReportDetailPage = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const isSampleReport = reportId === "sample";

  const [reportData, setReportData] = useState(null);
  const [scanResults, setScanResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fileViewerModal, setFileViewerModal] = useState({ isOpen: false, file: null });

  useEffect(() => {
    if (isSampleReport) {
      setReportData(mockReportData);
      setIsLoading(false);
    } else {
      loadReportData(reportId);
    }
  }, [reportId, isSampleReport]);

  const loadReportData = async (extId) => {
    try {
      setIsLoading(true);
      
      // Try to get scan results
      let results = await databaseService.getScanResult(extId);
      if (!results) {
        results = await realScanService.getRealScanResults(extId);
      }
      if (results && !results.files) {
        results = realScanService.formatRealResults(results);
      }
      setScanResults(results);

      // Try to get compliance data
      try {
        const compliance = await realScanService.getComplianceReport(extId);
        setReportData(compliance);
      } catch {
        // Compliance data may not be available
        setReportData(null);
      }

      setError(null);
    } catch (err) {
      setError("Failed to load report data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFindingClick = (finding) => {
    setSelectedFinding(finding);
    setIsDialogOpen(true);
  };

  const getVerdictBadgeVariant = (verdict) => {
    switch (verdict) {
      case "FAIL": case "BLOCK": return "destructive";
      case "NEEDS_REVIEW": return "secondary";
      case "PASS": case "ALLOW": return "default";
      default: return "outline";
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case "HIGH": return "#ef4444";
      case "MEDIUM": return "#eab308";
      case "LOW": return "#6b7280";
      default: return "#6b7280";
    }
  };

  const handleViewFile = (file) => {
    setFileViewerModal({ isOpen: true, file });
  };

  const getFileContent = async (extensionId, filePath) => {
    return await realScanService.getFileContent(extensionId, filePath);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="report-detail-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  // Error state (for real reports)
  if (!isSampleReport && !scanResults && error) {
    return (
      <div className="report-detail-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Report Not Found</h2>
          <p>{error}</p>
          <Button onClick={() => navigate("/reports")}>Back to Reports</Button>
        </div>
      </div>
    );
  }

  // Sample Report View
  if (isSampleReport) {
    return (
      <div className="report-detail-page">
        <div className="report-container">
          <Link to="/reports" className="back-link">← Back to Reports</Link>

          <div className="sample-badge-header">
            <Badge variant="outline">📄 Sample Report</Badge>
          </div>

          <div className="report-header">
            <div className="report-header-main">
              <h1 className="report-title">{mockReportData.extension_name}</h1>
              <div className="report-meta">
                <span className="report-scan-id">Scan ID: {mockReportData.scan_id}</span>
                <span className="separator">•</span>
                <span className="report-timestamp">{formatTimestamp(mockReportData.timestamp)}</span>
              </div>
            </div>
            <div className="report-header-actions">
              <Button variant="outline" disabled title="Coming soon">
                📥 Download JSON
              </Button>
              <Button variant="outline" disabled title="Coming soon">
                📄 Download PDF
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="summary-cards">
            <Card className="summary-card verdict-card">
              <CardHeader><CardTitle className="summary-label">Overall Verdict</CardTitle></CardHeader>
              <CardContent>
                <Badge variant={getVerdictBadgeVariant(mockReportData.overall_verdict)} className="verdict-badge-large">
                  {mockReportData.overall_verdict}
                </Badge>
              </CardContent>
            </Card>
            <Card className="summary-card">
              <CardHeader><CardTitle className="summary-label">Fail</CardTitle></CardHeader>
              <CardContent><span className="summary-value fail">{mockReportData.summary.fail_count}</span></CardContent>
            </Card>
            <Card className="summary-card">
              <CardHeader><CardTitle className="summary-label">Needs Review</CardTitle></CardHeader>
              <CardContent><span className="summary-value review">{mockReportData.summary.needs_review_count}</span></CardContent>
            </Card>
            <Card className="summary-card">
              <CardHeader><CardTitle className="summary-label">Pass</CardTitle></CardHeader>
              <CardContent><span className="summary-value pass">{mockReportData.summary.pass_count}</span></CardContent>
            </Card>
            {/* Rulepacks hidden - internal details not exposed to users */}
            {/* <Card className="summary-card rulepacks-card">
              <CardHeader><CardTitle className="summary-label">Rulepacks Enabled</CardTitle></CardHeader>
              <CardContent>
                <div className="rulepacks-list">
                  {mockReportData.rulepacks.map((pack, idx) => (
                    <Badge key={idx} variant="outline">{pack}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card> */}
          </div>

          {/* Findings Table */}
          <div className="findings-section">
            <h2 className="section-title">Findings</h2>
            <div className="findings-table-wrapper">
              <table className="findings-table">
                <thead>
                  <tr>
                    <th>Verdict</th>
                    <th>Rule ID</th>
                    <th>Title</th>
                    <th>Confidence</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {mockReportData.findings.map((finding) => (
                    <tr key={finding.id} className="finding-row" onClick={() => handleFindingClick(finding)}>
                      <td><Badge variant={getVerdictBadgeVariant(finding.verdict)}>{finding.verdict}</Badge></td>
                      <td className="rule-id">{finding.rule_id}</td>
                      <td className="title">{finding.title}</td>
                      <td><span style={{ color: getConfidenceColor(finding.confidence) }}>{finding.confidence}</span></td>
                      <td className="evidence-count">{finding.evidence_count} {finding.evidence_count === 1 ? "item" : "items"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="report-footer">
            <p className="footer-disclaimer">
              This is a sample compliance report. Reports are evidence-based and do not constitute legal advice.
            </p>
            <Button onClick={() => navigate("/scanner")}>Start Your Scan</Button>
          </div>

          {/* Finding Details Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="finding-dialog">
              <DialogHeader>
                <DialogTitle>{selectedFinding?.title}</DialogTitle>
                <DialogDescription>
                  <Badge variant={getVerdictBadgeVariant(selectedFinding?.verdict)}>{selectedFinding?.verdict}</Badge>
                  <span className="finding-rule-id">{selectedFinding?.rule_id}</span>
                </DialogDescription>
              </DialogHeader>
              {selectedFinding && (
                <div className="finding-details">
                  <div className="finding-section">
                    <h3>Explanation</h3>
                    <p>{selectedFinding.explanation}</p>
                  </div>
                  <div className="finding-section">
                    <h3>Evidence ({selectedFinding.evidence.length})</h3>
                    <div className="evidence-list">
                      {selectedFinding.evidence.map((ev, idx) => (
                        <div key={idx} className="evidence-item">
                          <div className="evidence-header">
                            <span className="file-path">{ev.file_path}</span>
                            <span className="line-range">Lines {ev.line_range}</span>
                          </div>
                          <pre className="evidence-snippet"><code>{ev.snippet}</code></pre>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="finding-section">
                    <h3>Citations ({selectedFinding.citations.length})</h3>
                    <div className="citations-list">
                      {selectedFinding.citations.map((citation, idx) => (
                        <div key={idx} className="citation-item">
                          <span className="citation-id">{citation.citation_id}</span>
                          <span className="citation-title">{citation.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // Real Report View (uses TabbedResultsPanel)
  return (
    <div className="report-detail-page">
      <div className="report-container full-width">
        <div className="report-header-nav">
          <Link to="/reports" className="back-link">← Back to Reports</Link>
          <div className="header-actions">
            <Button variant="outline" size="sm" onClick={() => navigate(`/scanner/results/${reportId}`)}>
              Full Analysis
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`http://localhost:8007/api/scan/report/${reportId}`, '_blank')}
            >
              📥 PDF
            </Button>
          </div>
        </div>

        <div className="report-header">
          <h1 className="report-title">{scanResults?.name || "Extension Report"}</h1>
          <p className="report-meta">
            <code>{reportId}</code>
            {scanResults?.version && <span className="version">v{scanResults.version}</span>}
          </p>
        </div>

        {/* Use TabbedResultsPanel for full results */}
        <TabbedResultsPanel
          scanResults={scanResults}
          onViewFile={handleViewFile}
          onAnalyzeWithAI={() => {}}
          onViewFindingDetails={() => {}}
          onViewAllFindings={() => {}}
        />

        <FileViewerModal
          isOpen={fileViewerModal.isOpen}
          onClose={() => setFileViewerModal({ isOpen: false, file: null })}
          file={fileViewerModal.file}
          extensionId={reportId}
          onGetFileContent={getFileContent}
        />
      </div>
    </div>
  );
};

export default ReportDetailPage;

