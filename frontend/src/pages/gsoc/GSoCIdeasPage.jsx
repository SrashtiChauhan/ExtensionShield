import React from "react";
import { Link } from "react-router-dom";
import SEOHead from "../../components/SEOHead";
import "./GSoCIdeasPage.scss";

const GSoCIdeasPage = () => {
  const ideas = [
    {
      id: "ml-detection",
      title: "ML-Based Malicious Extension Detection",
      difficulty: "Hard",
      skills: ["Python", "Machine Learning", "TensorFlow/PyTorch"],
      mentor: "TBD",
      description: "Build a machine learning model that classifies extensions based on code patterns, permission usage, and behavioral signals. Train on labeled dataset of known malicious vs benign extensions.",
      goals: [
        "Create labeled dataset from historical scan results",
        "Train classification model with >90% accuracy",
        "Integrate model into ExtensionShield scoring pipeline",
        "Build evaluation dashboard for model performance"
      ]
    },
    {
      id: "browser-support",
      title: "Firefox & Edge Extension Support",
      difficulty: "Medium",
      skills: ["JavaScript", "WebExtensions API", "Node.js"],
      mentor: "TBD",
      description: "Extend ExtensionShield to analyze Firefox add-ons and Edge extensions. Handle format differences, different permission models, and store-specific metadata.",
      goals: [
        "Add Firefox add-on download and extraction",
        "Map Firefox permission model to common schema",
        "Support Edge extension analysis",
        "Create unified report format across browsers"
      ]
    },
    {
      id: "real-time-monitoring",
      title: "Real-Time Extension Monitoring Service",
      difficulty: "Hard",
      skills: ["Python", "Redis/Kafka", "Docker", "FastAPI"],
      mentor: "TBD",
      description: "Build a service that continuously monitors installed extensions for updates and automatically re-scans when new versions are published. Send alerts when risk level changes.",
      goals: [
        "Implement Chrome Web Store polling for updates",
        "Build queue-based re-scan triggering system",
        "Create notification system (email, Slack, webhook)",
        "Design scalable architecture for 10k+ monitored extensions"
      ]
    },
    {
      id: "policy-engine",
      title: "Enterprise Policy Engine",
      difficulty: "Medium",
      skills: ["Python", "YAML/JSON", "Rule engines"],
      mentor: "TBD",
      description: "Create a flexible policy engine that lets enterprises define custom rules for extension approval. Support conditions like permission limits, domain restrictions, and vendor allowlists.",
      goals: [
        "Design policy DSL for rule definitions",
        "Build rule evaluation engine",
        "Create policy management API",
        "Add policy violation reporting"
      ]
    },
    {
      id: "vscode-extension",
      title: "VS Code Extension for Developers",
      difficulty: "Easy",
      skills: ["TypeScript", "VS Code API", "Node.js"],
      mentor: "TBD",
      description: "Build a VS Code extension that helps browser extension developers scan their code during development. Highlight security issues inline and suggest fixes.",
      goals: [
        "Create VS Code extension scaffold",
        "Integrate with ExtensionShield API",
        "Add inline diagnostics for security issues",
        "Implement quick-fix suggestions"
      ]
    }
  ];

  return (
    <>
      <SEOHead
        title="Google Summer of Code Ideas | ExtensionShield"
        description="GSoC project ideas for ExtensionShield: ML detection, browser support, real-time monitoring, policy engines, and more."
        pathname="/gsoc/ideas"
      />

      <div className="gsoc-ideas-page">
        <div className="gsoc-content">
          <header className="gsoc-header">
            <div className="gsoc-badge">
              <span className="gsoc-logo">☀️</span>
              Google Summer of Code 2026
            </div>
            <h1>Project Ideas</h1>
            <p>
              Contribute to browser extension security. These are starting points—
              we welcome your own ideas too!
            </p>
          </header>

          <div className="ideas-list">
            {ideas.map((idea) => (
              <div key={idea.id} className="idea-card">
                <div className="idea-header">
                  <h3>{idea.title}</h3>
                  <span className={`difficulty-badge ${idea.difficulty.toLowerCase()}`}>
                    {idea.difficulty}
                  </span>
                </div>
                <p className="idea-description">{idea.description}</p>
                <div className="idea-skills">
                  {idea.skills.map((skill) => (
                    <span key={skill} className="skill-tag">{skill}</span>
                  ))}
                </div>
                <div className="idea-goals">
                  <h4>Goals</h4>
                  <ul>
                    {idea.goals.map((goal, i) => (
                      <li key={i}>{goal}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="gsoc-cta">
            <h3>Ready to apply?</h3>
            <p>Check out our contributor guide and join the community.</p>
            <div className="cta-buttons">
              <Link to="/contribute" className="cta-button primary">
                Contributor Guide
              </Link>
              <Link to="/gsoc/community" className="cta-button secondary">
                Join Community
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GSoCIdeasPage;

