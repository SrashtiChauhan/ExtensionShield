import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SEOHead from "../../components/SEOHead";
import RainfallDroplets from "../../components/RainfallDroplets";
import "./CommunityLandingPage.scss";

const TAGLINE = "Came to scan. Stayed for community.";
const TAGLINE_SPEED = 60;

function TypewriterTagline() {
  const [display, setDisplay] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (display.length < TAGLINE.length) {
      const t = setTimeout(() => {
        setDisplay(TAGLINE.slice(0, display.length + 1));
      }, TAGLINE_SPEED);
      return () => clearTimeout(t);
    }
    setDone(true);
  }, [display]);

  return (
    <h1 className="community-tagline" aria-live="polite">
      <span className="tagline-text">{display}</span>
      {!done && <span className="tagline-cursor" aria-hidden />}
    </h1>
  );
}

/**
 * Community landing page at /community
 * Welcoming hero with tagline and CTA to join.
 */
const CommunityLandingPage = () => {
  return (
    <>
      <SEOHead
        title="Community | ExtensionShield"
        description="Came to scan, stayed for community. Trusted extensions and shared insights from the ExtensionShield community."
        pathname="/community"
      />

      <div className="community-landing-page">
        <RainfallDroplets />

        <div className="community-landing-content">
          <header className="community-landing-header">
            <TypewriterTagline />
            <p className="community-landing-message">
              Trusted extensions, shared insights, and people who care about safer browsing.
              We&apos;re building this together.
            </p>
          </header>

          <div className="community-ctas">
            <Link to="/gsoc/community" className="community-cta primary">
              Join the community
            </Link>
          </div>

          <p className="community-footnote">
            As we grow, we&apos;ll surface trusted extensions and community notes here.
          </p>
        </div>
      </div>
    </>
  );
};

export default CommunityLandingPage;
