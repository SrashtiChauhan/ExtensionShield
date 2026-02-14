import React from "react";
import { Link } from "react-router-dom";
import { footerConfig } from "../nav/navigation";
import ShieldLogo from "./ShieldLogo";
import "./Footer.scss";

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <Link to="/" className="footer-brand" aria-label="ExtensionShield home">
          <div className="footer-logo-shield" aria-hidden="true">
            <ShieldLogo size={48} />
          </div>
          <span className="footer-logo-text">ExtensionShield</span>
        </Link>
        <p className="footer-disclaimer">
          {footerConfig.disclaimer}
        </p>
        {footerConfig.brandClarification && (
          <p className="footer-brand-clarification">
            {footerConfig.brandClarification}
          </p>
        )}
        <div className="footer-links">
          {footerConfig.links.map((link, index) => {
            if (link.external) {
              return (
                <a
                  key={index}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              );
            }
            return (
              <Link key={index} to={link.path}>
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;

