import React from "react";
import { Link } from "react-router-dom";
import SEOHead from "../../components/SEOHead";
import "./HoneyCaseStudyPage.scss";

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "PDF Converter Chrome Extensions: Data Harvesting Case Study",
  "description": "Security analysis of malicious PDF converter extensions that harvest document contents and user data. Enterprise extension risk and Chrome extension security research.",
  "author": { "@type": "Organization", "name": "ExtensionShield" },
  "datePublished": "2025-02-01",
  "publisher": { "@type": "Organization", "name": "ExtensionShield" },
};

const PdfConvertersCaseStudyPage = () => {
  return (
    <>
      <SEOHead
        title="PDF Converter Extensions Data Harvesting Case Study | ExtensionShield"
        description="Chrome extension security case study: how malicious PDF converter extensions harvest document contents and user data. Research on extension malware, remote configuration, and enterprise extension risk management."
        pathname="/research/case-studies/pdf-converters"
        schema={articleSchema}
      />

      <div className="honey-case-study-page">
        <div className="honey-content">
          <nav className="breadcrumb">
            <Link to="/research">Research</Link>
            <span>/</span>
            <Link to="/research/case-studies">Case Studies</Link>
            <span>/</span>
            <span>PDF Converters</span>
          </nav>

          <header className="honey-header">
            <div className="honey-meta">
              <span className="severity-badge high">HIGH RISK</span>
              <span className="category-badge">Data Exfiltration</span>
              <span className="date-badge">2024–2025</span>
            </div>
            <h1>PDF Converter Extensions: The Hidden Data Harvesting Network</h1>
            <p className="honey-subtitle">
              How seemingly legitimate Chrome PDF extensions harvest document contents and user data—and why enterprises need to scan extensions before deploy.
            </p>
          </header>

          <div className="honey-stats">
            <div className="stat">
              <span className="stat-value">20K+</span>
              <span className="stat-label">Weekly Users (Single Extension)</span>
            </div>
            <div className="stat">
              <span className="stat-value">10+</span>
              <span className="stat-label">Extension Networks Observed</span>
            </div>
            <div className="stat danger">
              <span className="stat-value">Remote</span>
              <span className="stat-label">Payloads Bypass Store Review</span>
            </div>
          </div>

          <article className="honey-article">
            <section>
              <h2>Why PDF Converter Extensions Are a Target</h2>
              <p>
                Chrome extension security research has repeatedly identified PDF converter and PDF reader extensions as vectors for data harvesting. Users and enterprises install them for legitimate workflow needs—convert PDF to Word, compress PDFs, merge files—but many request broad permissions that enable reading and exfiltrating document contents and browsing data.
              </p>
            </section>

            <section>
              <h2>What Security Research Has Found</h2>
              <div className="findings-grid">
                <div className="finding-card">
                  <div className="finding-icon">📡</div>
                  <h3>Remote Configuration &amp; Payloads</h3>
                  <p>
                    Malicious extensions often use remote configuration: they download payloads from external servers after installation instead of embedding bad code upfront. This helps them bypass Chrome Web Store review and remote code execution policies. Security analysts have documented networks of at least 10 related extensions sharing similar behavior.
                  </p>
                </div>
                <div className="finding-card">
                  <div className="finding-icon">📄</div>
                  <h3>Document &amp; User Data Harvesting</h3>
                  <p>
                    Extensions with broad host permissions can inject scripts into trusted sites, read document content, and send data to third-party servers. Research on extensions like Flexi PDF Reader and similar tools has shown broad host permissions that enable surveillance, credential harvesting, and document exfiltration.
                  </p>
                </div>
                <div className="finding-card">
                  <div className="finding-icon">🔍</div>
                  <h3>SEO &amp; Typosquatting</h3>
                  <p>
                    Attackers use SEO manipulation, typosquatting, and malvertising to drive installs. Users land on fake PDF converter sites or install “helper” extensions that appear legitimate. Once installed, the extension updates via remote config to add or change behavior—making static store review insufficient.
                  </p>
                </div>
                <div className="finding-card">
                  <div className="finding-icon">📊</div>
                  <h3>Analytics &amp; Tracking</h3>
                  <p>
                    Even when not overtly malicious, some PDF tools integrate heavy analytics that track user behavior across sites. For enterprises, this creates compliance and privacy risk—especially when handling sensitive documents.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>Lessons for Security Teams &amp; Enterprises</h2>
              <ul className="lessons-list">
                <li>
                  <strong>Scan before you allow.</strong> Use a Chrome extension scanner that checks permissions, host access, and network behavior. ExtensionShield evaluates security, privacy, and governance so you can block or allow based on policy.
                </li>
                <li>
                  <strong>“Popular” does not mean safe.</strong> Extensions with thousands of users have been part of documented malicious networks. Ratings and install counts are not a substitute for technical analysis.
                </li>
                <li>
                  <strong>Watch for broad host permissions.</strong> Extensions that request access to “all websites” or “read and change your data on all sites” can read document content and exfiltrate it—red flags for PDF and file-handling tools.
                </li>
                <li>
                  <strong>Prefer minimal permissions.</strong> Legitimate PDF tools should request only what they need. Excess permissions are a core signal in extension security analysis.
                </li>
              </ul>
            </section>
          </article>

          <div className="honey-cta">
            <h3>Check Any Extension Before Install</h3>
            <p>
              Scan Chrome extensions for security vulnerabilities, privacy risks, and data exfiltration. Get a risk score and evidence-based report in under a minute—for consumers and enterprise extension governance.
            </p>
            <Link to="/scan" className="cta-button">
              Scan an Extension
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default PdfConvertersCaseStudyPage;
