import React from 'react';
import './SummaryPanel.scss';
import { normalizeHighlights } from '../../utils/normalizeScanResult';

/**
 * SummaryPanel - Simplified consumer-friendly summary
 * 
 * NEW FORMAT (unified_summary):
 * - headline: One sentence takeaway
 * - tldr: 2-3 sentences explaining the situation
 * - concerns: Top 3 specific concerns
 * - recommendation: One actionable sentence
 * 
 * LEGACY FORMAT (consumer_summary):
 * - verdict + reasons + access + action
 * 
 * Falls back gracefully through multiple data sources.
 */
const SummaryPanel = ({ 
  scores = {},
  factorsByLayer = {},
  rawScanResult = null,
  keyFindings = [],
  onViewEvidence = null
}) => {
  // Priority 1: New unified_summary format (simpler, LLM-powered)
  const unifiedSummary = rawScanResult?.report_view_model?.unified_summary;
  
  // Priority 2: Legacy consumer_summary format
  const consumerSummary = rawScanResult?.report_view_model?.consumer_summary;
  
  // Priority 3: Fallback to highlights (keyPoints from LLM; keyFindings from SAST/engine preferred for concerns)
  const { oneLiner, keyPoints } = normalizeHighlights(rawScanResult);

  // SAST/engine keyFindings – use for Quick Summary concerns when they add value
  const engineConcerns = (keyFindings || [])
    .filter(f => f.severity === 'high' || f.severity === 'medium')
    .slice(0, 4)
    .map(f => f.summary || f.title);

  const hasUnifiedSummary = unifiedSummary && (unifiedSummary.headline || unifiedSummary.tldr);
  const hasConsumerSummary = consumerSummary && consumerSummary.verdict;
  const hasLegacy = oneLiner || keyPoints.length > 0 || engineConcerns.length > 0;

  if (!hasUnifiedSummary && !hasConsumerSummary && !hasLegacy) {
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

  // NEW: Unified summary layout - simpler and cleaner
  if (hasUnifiedSummary) {
    const { headline, tldr, concerns = [], recommendation } = unifiedSummary;

    return (
      <section className="summary-panel summary-panel--unified">
        <div className="summary-header">
          <h2 className="summary-title">
            <span className="title-icon">✨</span>
            Quick Summary
          </h2>
          {getDecisionBadge()}
        </div>

        <div className="summary-content">
          {/* Headline - the main takeaway */}
          {headline && (
            <div className="summary-headline-wrapper">
              <h3 className="summary-headline">{headline}</h3>
            </div>
          )}

          {/* TL;DR - brief explanation */}
          {tldr && (
            <div className="summary-tldr-wrapper">
              <p className="summary-tldr">{tldr}</p>
            </div>
          )}

          {/* Concerns - from LLM or SAST/engine keyFindings */}
          {((concerns && concerns.length > 0) || engineConcerns.length > 0) && (
            <div className="summary-section concerns-section">
              <h3 className="section-subtitle">
                <span className="subtitle-icon">⚠️</span>
                Key Concerns
              </h3>
              <ul className="concerns-list">
                {(concerns && concerns.length > 0 ? concerns : engineConcerns).map((concern, idx) => (
                  <li key={idx} className="concern-item">
                    <span className="concern-bullet">•</span>
                    <span className="concern-text">{concern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation - what to do */}
          {recommendation && (
            <div className="summary-section recommendation-section">
              <div className="recommendation-card">
                <span className="recommendation-icon">👉</span>
                <span className="recommendation-text">{recommendation}</span>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Legacy consumer_summary layout
  if (hasConsumerSummary) {
    const { verdict, reasons = [], access, action } = consumerSummary;

    return (
      <section className="summary-panel">
        <div className="summary-header">
          <h2 className="summary-title">
            <span className="title-icon">✨</span>
            Quick Summary
          </h2>
          {getDecisionBadge()}
        </div>

        <div className="summary-content">
          {/* Verdict - the headline */}
          {verdict && (
            <div className="summary-verdict-wrapper">
              <p className="summary-verdict">{verdict}</p>
            </div>
          )}

          {/* Reasons - why this score */}
          {reasons.length > 0 && (
            <div className="summary-section key-reasons">
              <h3 className="section-subtitle">
                <span className="subtitle-icon">📌</span>
                Why This Score
              </h3>
              <div className="reasons-list">
                {reasons.map((reason, idx) => (
                  <div key={idx} className="reason-card">
                    <span className="reason-number">{idx + 1}</span>
                    <p className="reason-text">{reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Access - what it can access */}
          {access && (
            <div className="summary-section access-section">
              <h3 className="section-subtitle">
                <span className="subtitle-icon">🔑</span>
                What It Can Access
              </h3>
              <div className="access-card">
                <span className="access-text">{access}</span>
              </div>
            </div>
          )}

          {/* Action - what to do */}
          {action && (
            <div className="summary-section action-section">
              <h3 className="section-subtitle">
                <span className="subtitle-icon">👉</span>
                What to Do
              </h3>
              <div className="action-card">
                <span className="action-text">{action}</span>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Legacy highlights layout – prefer SAST/engine keyFindings over LLM keyPoints
  const concernsToShow = engineConcerns.length > 0 ? engineConcerns : keyPoints;

  return (
    <section className="summary-panel">
      <div className="summary-header">
        <h2 className="summary-title">
          <span className="title-icon">✨</span>
          Quick Summary
        </h2>
        {getDecisionBadge()}
      </div>

      <div className="summary-content">
        {/* One-liner summary */}
        {oneLiner && (
          <div className="summary-verdict-wrapper">
            <p className="summary-verdict">{oneLiner}</p>
          </div>
        )}

        {/* Key Concerns – from SAST/engine when available, else LLM keyPoints */}
        {concernsToShow.length > 0 && (
          <div className="summary-section key-reasons">
            <h3 className="section-subtitle">
              <span className="subtitle-icon">📌</span>
              Key Concerns
            </h3>
            <div className="reasons-list">
              {concernsToShow.map((point, idx) => (
                <div key={idx} className="reason-card">
                  <span className="reason-number">{idx + 1}</span>
                  <p className="reason-text">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SummaryPanel;
