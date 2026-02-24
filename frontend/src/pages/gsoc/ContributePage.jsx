import React from "react";
import { Link } from "react-router-dom";
import SEOHead from "../../components/SEOHead";
import "./ContributePage.scss";

const ContributePage = () => {
  const contributions = [
    {
      id: "scan",
      type: "scan",
      title: "Scan extensions",
      tag: "No coding",
      description: "Run scans on extensions you use or discover. Every scan improves our data and helps others see risk before they install.",
      to: "/scan",
    },
    {
      id: "report",
      type: "report",
      title: "Report threats",
      tag: "Critical",
      description: "See something suspicious? Report it so we can flag risky extensions and protect the community.",
      to: "/scan",
    },
    {
      id: "community",
      type: "community",
      title: "Join the community",
      tag: null,
      description: "Connect with contributors, share findings, and help shape how we make the web safer for everyone.",
      to: "/community",
    },
    {
      id: "share",
      type: "share",
      title: "Share & recommend",
      tag: null,
      description: "Tell others about ExtensionShield. Recommend safe alternatives when you find risky extensions.",
      to: "/research",
    },
  ];

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
            <h1>Everyone can contribute</h1>
            <p className="subtitle">
              Help build a safer web. Scan extensions, report threats, help others—every contribution matters, no coding required.
            </p>
          </header>

          <div className="contribution-grid">
            {contributions.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="contribution-card"
              >
                <div className="card-icon" data-type={item.type} aria-hidden>
                  {item.type === "scan" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  )}
                  {item.type === "report" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  )}
                  {item.type === "community" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  )}
                  {item.type === "share" && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  )}
                </div>
                <div className="card-body">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  {item.tag && (
                    <span className={`card-tag ${item.tag === "Critical" ? "critical" : ""}`}>
                      {item.tag}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <footer className="contribute-footer">
            <p>
              Want to contribute code? Check out our{" "}
              <Link to="/open-source">open source</Link> page and{" "}
              <Link to="/gsoc/ideas">GSoC project ideas</Link>.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default ContributePage;
