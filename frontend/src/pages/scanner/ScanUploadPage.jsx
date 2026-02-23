import React from "react";
import SEOHead from "../../components/SEOHead";
import { useAuth } from "../../context/AuthContext";
import PrivateBuildDropzone from "../../components/PrivateBuildDropzone";
import PrivateBuildTrustPills from "../../components/PrivateBuildTrustPills";
import "./ScanUploadPage.scss";

const isDev = import.meta.env.DEV;

export default function ScanUploadPage() {
  const { isAuthenticated, openSignInModal } = useAuth();

  const canUpload = isDev || isAuthenticated;
  const showSignInOverlay = !isDev && !isAuthenticated;

  return (
    <div className="scan-upload-page">
      <SEOHead
        title="Upload CRX/ZIP — Chrome Extension Security Audit (Pro) | ExtensionShield"
        description="Upload a private CRX or ZIP to scan for risky permissions, vulnerabilities, suspicious network calls, and policy risks. Get evidence-linked findings and fix suggestions."
        pathname="/scan/upload"
      />
      <section className="scan-upload-hero" aria-label="Private build upload">
        <div className="scan-upload-content">
          {/* 3-step indicator: 1 Upload → 2 Scan → 3 Report */}
          <nav className="scan-upload-steps" aria-label="Scan progress">
            <div className="scan-upload-steps__step scan-upload-steps__step--active">
              <span className="scan-upload-steps__circle" aria-hidden>1</span>
              <span className="scan-upload-steps__label">Upload</span>
            </div>
            <span className="scan-upload-steps__connector" aria-hidden />
            <div className="scan-upload-steps__step">
              <span className="scan-upload-steps__circle" aria-hidden>2</span>
              <span className="scan-upload-steps__label">Scan</span>
            </div>
            <span className="scan-upload-steps__connector" aria-hidden />
            <div className="scan-upload-steps__step">
              <span className="scan-upload-steps__circle" aria-hidden>3</span>
              <span className="scan-upload-steps__label">Report</span>
            </div>
          </nav>

          <p className="scan-upload-kicker">PRIVATE BUILD</p>
          <h1 className="scan-upload-headline">Chrome extension security audit — scan CRX or ZIP</h1>
          <p className="scan-upload-subhead">
            Pre-release extension security: upload a private CRX/ZIP for vulnerability scanning, code review signals, and fix suggestions.
          </p>

          <div className="scan-upload-dropzone-wrap">
            {showSignInOverlay && (
              <div className="scan-upload-gate scan-upload-gate--signin">
                <p className="scan-upload-gate__text">Sign in to upload private builds</p>
                <button type="button" className="scan-upload-gate__btn" onClick={openSignInModal}>
                  Sign In
                </button>
              </div>
            )}
            <PrivateBuildDropzone disabled={!canUpload} />
          </div>

          <PrivateBuildTrustPills />

          <p className="scan-upload-privacy">Reports are visible only to your account.</p>
        </div>
      </section>
    </div>
  );
}
