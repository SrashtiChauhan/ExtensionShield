import React from "react";
import { Link } from "react-router-dom";
import { footerConfig } from "../nav/navigation";
import "./Footer.scss";

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <img 
            src="/logo.png" 
            alt="ExtensionShield Logo" 
            className="footer-logo-img"
          />
          <span className="brand-extensionshield">ExtensionShield</span>
        </div>
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

