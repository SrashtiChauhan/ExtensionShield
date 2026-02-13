import React, { useEffect, useState } from "react";
import ExtensionHeaderCard from "../../components/dashboard/ExtensionHeaderCard";
import QuickSummaryCard from "../../components/dashboard/QuickSummaryCard";
import ScoreCard from "../../components/dashboard/ScoreCard";
import "./ScanResultsDashboardPage.scss";

const scoreCards = [
  {
    title: "Security",
    percent: 79,
    findings: "3 findings",
    statusLabel: "Review",
    statusColor: "#F5A524",
    progressColor: "#F5A524"
  },
  {
    title: "Privacy",
    percent: 73,
    findings: "7 findings",
    statusLabel: "Review",
    statusColor: "#F5A524",
    progressColor: "#F5A524"
  },
  {
    title: "Governance",
    percent: 100,
    findings: "0 findings",
    statusLabel: "Good",
    statusColor: "#39D98A",
    progressColor: "#39D98A"
  }
];

const quickSummaryBody =
  "This extension can access your current tab information and run scripts on the pages you browse. While it offers useful helpers like timers and notifications, it also exerts broad access across tabs and your account information. Review the permissions list and stay cautious before installing.";

const metadata = [
  "WEB.DE MailCheck",
  "100,000 users",
  "3.4 rating",
  "Last scanned Feb 12, 2026"
];

const navItems = ["Scan", "Research", "Enterprise", "Resources"];

const ScanResultsDashboardPage = () => {
  const [progressActive, setProgressActive] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setProgressActive(true), 120);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="scan-results-dashboard">
      <div className="background-glow" />

      <header className="dashboard-nav">
        <div className="nav-brand">
          <span className="brand-shield" aria-hidden="true">
            🛡️
          </span>
          <span className="brand-name">ExtensionShield</span>
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => (
            <button key={item} className="nav-menu-item" type="button">
              {item} <span className="nav-caret">▾</span>
            </button>
          ))}
        </nav>

        <button type="button" className="nav-signin">
          Sign in
        </button>
      </header>

      <main className="dashboard-shell">
        <div className="dashboard-back">← Back</div>
        <div className="dashboard-layout">
          <section className="dashboard-column dashboard-column-left">
            <ExtensionHeaderCard
              iconLabel="WEB"
              title="WEB.DE MailCheck"
              name="WEB.DE MailCheck"
              metadata={metadata}
              tag="Obfuscation"
              score={81}
              gaugeLabel="NEEDS REVIEW"
              delay={0.15}
            />

            <QuickSummaryCard
              headline="Exercise Caution: Medium Risk Extension with Broad Access"
              body={quickSummaryBody}
              badgeLabel="SAFE"
              primaryAction={{ label: "View risky permissions", onClick: () => {} }}
              secondaryAction={{ label: "View network domains", onClick: () => {} }}
              delay={0.35}
            />
          </section>

          <section className="dashboard-column dashboard-column-right">
            {scoreCards.map((card, index) => (
              <ScoreCard
                key={card.title}
                {...card}
                delay={0.5 + index * 0.06}
                animateProgress={progressActive}
              />
            ))}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ScanResultsDashboardPage;
