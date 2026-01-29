import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import TabbedResultsPanel from "../../components/TabbedResultsPanel";
import FileViewerModal from "../../components/FileViewerModal";
import StatusMessage from "../../components/StatusMessage";
import { useScan } from "../../context/ScanContext";
import realScanService from "../../services/realScanService";
import "./ScanResultsPage.scss";

const ScanResultsPage = () => {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const {
    scanResults,
    error,
    setError,
    loadResultsById,
    currentExtensionId,
  } = useScan();

  const [isLoading, setIsLoading] = useState(false);
  const [fileViewerModal, setFileViewerModal] = useState({
    isOpen: false,
    file: null,
  });

  // Load results if not already in context or different scan
  useEffect(() => {
    const loadResults = async () => {
      if (!scanResults || currentExtensionId !== scanId) {
        setIsLoading(true);
        await loadResultsById(scanId);
        setIsLoading(false);
      }
    };
    loadResults();
  }, [scanId, scanResults, currentExtensionId, loadResultsById]);

  const handleViewFile = (file) => {
    setFileViewerModal({ isOpen: true, file });
  };

  const getFileContent = async (extensionId, filePath) => {
    return await realScanService.getFileContent(extensionId, filePath);
  };

  const handleAnalyzeWithAI = (file) => {
    alert(`🤖 AI Analysis for ${file.name}\n\nThis would analyze the file content using GPT-OSS for security insights.`);
  };

  const handleViewFindingDetails = (finding) => {
    const details = `🚨 Security Finding Details\n\nFile: ${finding.file}\nLine: ${finding.line}\nSeverity: ${finding.severity}\nTitle: ${finding.title}\nDescription: ${finding.description}`;
    alert(details);
  };

  const handleViewAllFindings = () => {
    if (scanResults) {
      alert(`Viewing all ${scanResults.totalFindings} findings.`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="scan-results-page">
        <div className="results-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <h2>Loading Results</h2>
            <p>Fetching scan results for extension...</p>
            <code>{scanId}</code>
          </div>
        </div>
      </div>
    );
  }

  // No results found
  if (!scanResults && !isLoading) {
    return (
      <div className="scan-results-page">
        <div className="results-container">
          <div className="no-results-state">
            <div className="no-results-icon">📋</div>
            <h2>No Results Found</h2>
            <p>
              We couldn't find scan results for this extension.
              The scan may still be in progress or the extension hasn't been scanned yet.
            </p>
            <code>{scanId}</code>
            <div className="no-results-actions">
              <Button onClick={() => navigate("/scanner")} variant="default">
                Start New Scan
              </Button>
              <Button onClick={() => navigate("/history")} variant="outline">
                View History
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-results-page">
      {/* Header */}
      <div className="results-header">
        <div className="header-nav">
          <Link to="/scanner" className="back-link">
            ← Back to Scanner
          </Link>
          <div className="header-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/history")}
            >
              View History
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/scanner")}
            >
              New Scan
            </Button>
          </div>
        </div>
        <div className="header-info">
          <h1 className="results-title">
            {scanResults?.name || "Extension Analysis"}
          </h1>
          <p className="results-subtitle">
            <span className="extension-id">
              ID: <code>{scanId}</code>
            </span>
            {scanResults?.version && (
              <span className="extension-version">
                v{scanResults.version}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <StatusMessage
          type={error.includes("✅") ? "success" : error.includes("🔄") ? "loading" : "error"}
          message={error}
          onDismiss={() => setError("")}
        />
      )}

      {/* Results Panel */}
      <div className="results-content">
        <TabbedResultsPanel
          scanResults={scanResults}
          onViewFile={handleViewFile}
          onAnalyzeWithAI={handleAnalyzeWithAI}
          onViewFindingDetails={handleViewFindingDetails}
          onViewAllFindings={handleViewAllFindings}
        />
      </div>

      {/* File Viewer Modal */}
      <FileViewerModal
        isOpen={fileViewerModal.isOpen}
        onClose={() => setFileViewerModal({ isOpen: false, file: null })}
        file={fileViewerModal.file}
        extensionId={scanResults?.extensionId || scanId}
        onGetFileContent={getFileContent}
      />

      {/* Footer */}
      <footer className="results-footer">
        <p className="footer-disclaimer">
          This report was generated using deterministic rule evaluation and static code analysis. 
          Results should be reviewed by a security professional before taking enforcement action.
        </p>
      </footer>
    </div>
  );
};

export default ScanResultsPage;

