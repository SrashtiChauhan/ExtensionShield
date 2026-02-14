import React from "react";
import { Link } from "react-router-dom";
import SEOHead from "../../components/SEOHead";
import ShieldLogo from "../../components/ShieldLogo";
import StatsIcon from "../../components/ui/StatsIcon";
import "./ResearchPage.scss";

const ResearchPage = () => {
  return (
    <>
      <SEOHead
        title="Extension Threat Research & Case Studies | ExtensionShield"
        description="In-depth security research on Chrome extension threats, malware analysis, and case studies of deceptive extensions like Honey."
        pathname="/research"
      />

      <div className="research-page">
        <div className="research-content">
          <header className="research-header">
            <span className="research-badge">Research Hub</span>
            <h1>Extension Security Research</h1>
            <p>
              In-depth analysis, case studies, and methodology behind ExtensionShield's security scoring.
            </p>
          </header>

          <div className="research-grid">
            {/* Case Studies */}
            <Link to="/research/case-studies" className="research-card featured">
              <div className="card-icon">📋</div>
              <div className="card-content">
                <h3>Case Studies</h3>
                <p>Real-world analysis of malicious and deceptive extensions, including Honey, PDF converters, and more.</p>
                <span className="card-link">
                  Explore case studies
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* Benchmarks */}
            <Link to="/research/benchmarks" className="research-card">
              <div className="card-icon">
                <StatsIcon size={32} />
              </div>
              <div className="card-content">
                <h3>Benchmarks</h3>
                <p>Open, reproducible comparisons across scanners + industry risk trends.</p>
                <span className="card-link">
                  View benchmarks
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* How We Score */}
            <Link to="/research/methodology" className="research-card">
              <div className="card-icon">⚙️</div>
              <div className="card-content">
                <h3>How We Score</h3>
                <p>How we score risk: static analysis, permission mapping, threat intelligence, and evidence chain-of-custody.</p>
                <span className="card-link">
                  Learn our approach
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>

            {/* Threat Intel */}
            <div className="research-card coming-soon">
              <div className="card-icon">🔍</div>
              <div className="card-content">
                <h3>Threat Intelligence</h3>
                <p>Aggregated signals from VirusTotal, malware databases, and community reports.</p>
                <span className="coming-soon-badge">Coming Soon</span>
              </div>
            </div>

            {/* Open Source */}
            <Link to="/open-source" className="research-card">
              <div className="card-icon">🌱</div>
              <div className="card-content">
                <h3>Open Source</h3>
                <p>ExtensionShield is open source. Contribute rules, report issues, or join our GSoC program.</p>
                <span className="card-link">
                  Get involved
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResearchPage;

