import React from "react";
import "./PipelineViz.scss";

/**
 * Minimal pipeline animation: a dot flows through stages (no words).
 * Used on homepage (below hero) and /research/methodology (below header).
 */
const PipelineViz = ({ className = "" }) => (
  <section
    className={`pipeline-viz ${className}`.trim()}
    aria-hidden="true"
  >
    <div className="pipeline-viz-track">
      <div className="pipeline-viz-line" />
      <div className="pipeline-viz-nodes">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="pipeline-viz-node" />
        ))}
      </div>
      <div className="pipeline-viz-dot" />
    </div>
  </section>
);

export default PipelineViz;
