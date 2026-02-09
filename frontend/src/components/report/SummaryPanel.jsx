import React from 'react';
import './SummaryPanel.scss';
import { normalizeHighlights } from '../../utils/normalizeScanResult';

/**
 * SummaryPanel - Human-readable summary using LLM-generated content when available
 * 
 * Shows:
 * - One-liner summary (from LLM if available)
 * - Key points (from LLM why_this_score or fallback to deterministic)
 * - Key findings (top 2-3 findings, no tags)
 * - What to watch (if available)
 * 
 * Props:
 * - scores: ScoresVM - Contains decision and reasons
 * - factorsByLayer: FactorsByLayerVM - All factors
 * - rawScanResult: RawScanResult - Raw scan data to access LLM summary
 * - keyFindings: KeyFindingVM[] - Key findings to display
 * - onViewEvidence: (evidenceIds: string[]) => void - Callback for viewing evidence
 */
const SummaryPanel = ({ 
  scores = {},
  factorsByLayer = {},
  rawScanResult = null,
  keyFindings = [],
  onViewEvidence = null
}) => {
  // Use unified normalization helper for highlights
  const { oneLiner, keyPoints, whatToWatch } = normalizeHighlights(rawScanResult);

  // If we have no oneLiner and no keyPoints, it's really empty
  if (!oneLiner && keyPoints.length === 0) {
    return null;
  }

  const getDecisionBadge = () => {
    const decision = scores?.decision;
    if (!decision) return null;

    const badges = {
      'ALLOW': { label: 'Safe', color: '#10B981', icon: '✓' },
      'WARN': { label: 'Review', color: '#F59E0B', icon: '⚡' },
      'BLOCK': { label: 'Blocked', color: '#EF4444', icon: '✕' },
    };

    const badge = badges[decision] || badges['WARN'];
    return (
      <span 
        className="decision-badge"
        style={{ backgroundColor: badge.color }}
      >
        <span className="badge-icon">{badge.icon}</span>
        <span className="badge-text">{badge.label}</span>
      </span>
    );
  };

  return (
    <section className="summary-panel">
      <div className="summary-header">
        <h2 className="summary-title">
          <span className="title-icon">📋</span>
          Summary
        </h2>
        {getDecisionBadge()}
      </div>

      <div className="summary-content">
        {/* One-liner summary */}
        {oneLiner && (
          <p className="summary-one-liner">
            {oneLiner}
          </p>
        )}

        {/* Key Points - Single merged section */}
        <div className="summary-section key-points">
          {keyPoints.length > 0 ? (
            <ul className="summary-bullets">
              {keyPoints.map((point, idx) => (
                <li key={idx} className="bullet-item">
                  <span className="bullet-icon">•</span>
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <p className="placeholder-text">No key points available.</p>
          )}
        </div>

        {/* Key Findings - Top 2-3 items, no tags */}
        {keyFindings && keyFindings.length > 0 && (() => {
          // Sort by severity and take top 2-3
          const sortedFindings = [...keyFindings].sort((a, b) => {
            const severityOrder = { high: 3, medium: 2, low: 1 };
            return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
          }).slice(0, 3);

          if (sortedFindings.length === 0) return null;

          return (
            <div className="summary-section key-findings">
              <h3 className="section-subtitle">Key Findings</h3>
              <ul className="summary-bullets">
                {sortedFindings.map((finding, idx) => (
                  <li key={idx} className="bullet-item finding-item">
                    <span className="bullet-icon">•</span>
                    <span className="finding-content">
                      {finding.summary && finding.summary !== finding.title ? (
                        <>
                          <span className="finding-title-text">{finding.title}</span>
                          <span className="finding-summary-text">{finding.summary}</span>
                        </>
                      ) : (
                        <span className="finding-title-text">{finding.title}</span>
                      )}
                    </span>
                    {finding.evidenceIds && finding.evidenceIds.length > 0 && onViewEvidence && (
                      <button
                        className="view-evidence-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewEvidence(finding.evidenceIds);
                        }}
                      >
                        View Evidence
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* What to Watch (if available) */}
        {whatToWatch.length > 0 && (
          <div className="summary-section what-to-watch">
            <h3 className="section-subtitle">What to watch</h3>
            <ul className="summary-bullets">
              {whatToWatch.map((item, idx) => (
                <li key={idx} className="bullet-item">
                  <span className="bullet-icon">⚠️</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

export default SummaryPanel;

