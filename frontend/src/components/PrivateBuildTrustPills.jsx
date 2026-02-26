/**
 * PrivateBuildTrustPills – Trust strip for /scan/upload: security signals copy + pills + community note.
 * Renders below the dropzone, above "Reports are visible only to your account."
 * Subtle shimmer on pills (disabled when prefers-reduced-motion).
 */
import React from "react";
import "./PrivateBuildTrustPills.scss";

const PILLS = [
  "Static analysis",
  "Permission audit",
  "Network endpoints",
  "Rulepacks",
  "Reputation signals",
  "VirusTotal (when available)",
];

export default function PrivateBuildTrustPills() {
  return (
    <div className="private-build-trust-pills" aria-label="Security signals we use">
      <h2 className="private-build-trust-pills__title">Comprehensive security signals</h2>
      <p className="private-build-trust-pills__sentence">
        We combine static checks, reputation signals (VirusTotal), and rulepacks.
      </p>
      <div className="private-build-trust-pills__pills-wrap">
        <div className="private-build-trust-pills__pills" role="list">
          {PILLS.map((label) => (
            <span key={label} className="private-build-trust-pills__pill" role="listitem">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
