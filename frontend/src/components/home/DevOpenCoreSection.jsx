/**
 * DevOpenCoreSection – Dev (free/pro) copy left; right = security pipeline (enterprise-governance-visual).
 */
import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import SecurityPipeline from "./SecurityPipeline";
import "./DevOpenCoreSection.scss";

const SCORE_WEIGHTS = { security: 40, privacy: 35, compliance: 25 };

const PILLS = [
  "VirusTotal",
  "SAST",
  "Rulepacks",
  "Evidence attached",
];

export default function DevOpenCoreSection({ reducedMotion = false }) {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <section
      id="how-we-score"
      ref={sectionRef}
      className="dev-open-core-section landing-separator"
      aria-labelledby="dev-open-core-heading"
    >
      <div className="dev-open-core-inner">
        <div className="dev-open-core-grid">
          <div className="dev-open-core-left">
            <motion.div
              className="dev-open-core-block"
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 id="dev-open-core-heading" className="dev-open-core-title">
                <span className="dev-open-core-title-line">Free for users.</span>
                <span className="dev-open-core-title-line dev-open-core-title-line--main">Pro for developers.</span>
              </h2>
              <p className="dev-open-core-subhead">
                Upload a private CRX/ZIP build (Pro) before release.
                We audit your files, flag vulnerabilities and risky patterns, and suggest fixes — with evidence.
              </p>
              <p className="dev-open-core-how-calc">
                How we calculate: Security {SCORE_WEIGHTS.security}% · Privacy {SCORE_WEIGHTS.privacy}% · Governance {SCORE_WEIGHTS.compliance}%.{" "}
                <Link to="/research/methodology" className="dev-open-core-how-link">Methodology →</Link>
              </p>
              <div className="dev-open-core-pills" role="list">
                {PILLS.map((label) => (
                  <span key={label} className="dev-open-core-pill" role="listitem">{label}</span>
                ))}
              </div>
              <p className="dev-open-core-tiny-line" aria-hidden="true">
                Private by default — share only if you choose.
              </p>
              <div className="dev-open-core-cta-wrap">
                <Link to="/scan/upload" className="dev-open-core-cta-btn">Upload CRX/ZIP (Pro)</Link>
              </div>
              <p className="dev-open-core-enterprise-line">
                For teams: Monitoring + policy + audit exports.{" "}
                <Link to="/enterprise" className="dev-open-core-enterprise-link">Enterprise →</Link>
              </p>
            </motion.div>
          </div>

          {/* Right: pipeline (enterprise-governance-visual moved here) */}
          <motion.div
            className="enterprise-governance-visual dev-open-core-right"
            initial={reducedMotion ? false : { opacity: 0, x: 16 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <SecurityPipeline reducedMotion={reducedMotion} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
