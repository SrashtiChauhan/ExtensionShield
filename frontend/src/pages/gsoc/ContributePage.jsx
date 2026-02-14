import React from "react";
import { Link, useNavigate } from "react-router-dom";
import SEOHead from "../../components/SEOHead";
import "./ContributePage.scss";

const ContributePage = () => {
  const navigate = useNavigate();
  
  return (
    <>
      <SEOHead
        title="Everyone Can Contribute | ExtensionShield"
        description="Help build a safer web. Scan extensions, report threats, help others—every contribution matters, no coding required."
        pathname="/contribute"
      />

      <div className="contribute-page">
        <div className="contribute-content">
          <header className="contribute-header">
            <h1>Everyone Can Contribute</h1>
            <p className="subtitle">
              Help build a safer web for everyone. No coding required.
            </p>
            <p className="impact-message">
              Every scan you do helps the next person
            </p>
          </header>

          {/* Main Ways to Contribute - For Everyone */}
          <div className="contribution-grid">
            
            {/* Scan Extensions */}
            <div className="contribution-card main-card" onClick={() => navigate('/scan')}>
              <div className="card-icon scan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3>Scan Extensions</h3>
              <p>Every scan builds our database and helps protect the next person</p>
              <div className="card-impact">
                <span className="impact-badge">High Impact</span>
              </div>
            </div>

            {/* Report Malicious Extensions */}
            <div className="contribution-card main-card">
              <div className="card-icon report">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3>Report Threats</h3>
              <p>Found a malicious extension? Report it to protect millions of users</p>
              <div className="card-impact">
                <span className="impact-badge critical">Critical Impact</span>
              </div>
            </div>

            {/* Help Others */}
            <div className="contribution-card main-card">
              <div className="card-icon community">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3>Help the Community</h3>
              <p>Answer questions, share insights, recommend safe alternatives</p>
              <div className="card-impact">
                <span className="impact-badge">Community Builder</span>
              </div>
            </div>

            {/* Share & Spread */}
            <div className="contribution-card main-card">
              <div className="card-icon share">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <h3>Share & Spread</h3>
              <p>Tell others about ExtensionShield. Every user makes the web safer</p>
              <div className="card-impact">
                <span className="impact-badge">Amplify</span>
              </div>
            </div>

          </div>

          {/* Impact Statement */}
          <div className="impact-statement">
            <div className="impact-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2>Building a Safer Ecosystem Together</h2>
            <p>
              Every contribution—no matter how small—helps protect millions of users. 
              When you scan an extension, you help us build better threat detection. 
              When you report a threat, you protect others from harm. 
              Together, we create a safer web.
            </p>
          </div>

          {/* For Developers Section */}
          <section className="developer-section">
            <div className="developer-header">
              <div className="dev-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <h2>For Developers</h2>
              <p>Code, tests, documentation, detection rules—technical contributions welcome</p>
            </div>

            <div className="dev-ways-grid">
              <div className="dev-way-card">
                <div className="dev-way-icon">💻</div>
                <h4>Code Features</h4>
                <p>Build new features</p>
              </div>
              <div className="dev-way-card">
                <div className="dev-way-icon">🔍</div>
                <h4>Detection Rules</h4>
                <p>Add Semgrep rules</p>
              </div>
              <div className="dev-way-card">
                <div className="dev-way-icon">🧪</div>
                <h4>Write Tests</h4>
                <p>Improve coverage</p>
              </div>
              <div className="dev-way-card">
                <div className="dev-way-icon">📝</div>
                <h4>Documentation</h4>
                <p>Improve guides</p>
              </div>
              <div className="dev-way-card">
                <div className="dev-way-icon">🐛</div>
                <h4>Fix Bugs</h4>
                <p>Squash issues</p>
              </div>
              <div className="dev-way-card">
                <div className="dev-way-icon">🎨</div>
                <h4>Design & UX</h4>
                <p>Improve interface</p>
              </div>
            </div>

            <div className="dev-cta">
              <div className="dev-cta-buttons">
                <a 
                  href="https://github.com/Stanzin7/ExtensionShield" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="dev-cta-button primary"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Contribute to ExtensionShield
                </a>
                <a 
                  href="https://github.com/barvhaim/ThreatXtension" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="dev-cta-button secondary"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Contribute to ThreatXtension
                </a>
              </div>
              <p className="dev-note">
                <strong>ExtensionShield</strong>: Privacy, Compliance, UI, Infrastructure<br/>
                <strong>ThreatXtension</strong>: Security Pipeline, SAST Rules, Malware Detection
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default ContributePage;

