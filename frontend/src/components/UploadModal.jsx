/**
 * UploadModal – Modal with "Drop extension here" and PrivateBuildDropzone.
 * Same scan flow as /scan/upload; closes when upload starts (navigates to progress).
 */
import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useScan } from "../context/ScanContext";
import PrivateBuildDropzone from "./PrivateBuildDropzone";
import "./UploadModal.scss";

const isDev = import.meta.env.DEV;

export default function UploadModal({ isOpen, onClose }) {
  const { isAuthenticated, openSignInModal } = useAuth();
  const { isScanning } = useScan();
  const contentRef = useRef(null);
  const previousFocusRef = useRef(null);

  const canUpload = isDev || isAuthenticated;
  const showSignInOverlay = !isDev && !isAuthenticated;

  // Close when upload starts (user will be navigated to /scan/progress)
  useEffect(() => {
    if (isOpen && isScanning) {
      onClose();
    }
  }, [isOpen, isScanning, onClose]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Focus trap and Escape
  useEffect(() => {
    if (!isOpen) return;
    const el = contentRef.current;
    if (!el) return;

    const focusables = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first) first.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  const modal = (
    <div
      className="upload-modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div
        ref={contentRef}
        className="upload-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="upload-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h2 id="upload-modal-title" className="upload-modal-title">
          Drop extension here
        </h2>
        <p className="upload-modal-sub">or choose file to scan your private CRX/ZIP</p>
        <div className="upload-modal-dropzone-wrap">
          {showSignInOverlay && (
            <div className="upload-modal-gate">
              <p className="upload-modal-gate__text">Start a Pro audit</p>
              <button type="button" className="upload-modal-gate__btn" onClick={openSignInModal}>
                Start a Pro audit
              </button>
            </div>
          )}
          <PrivateBuildDropzone disabled={!canUpload} />
        </div>
        <p className="upload-modal-micro">Max 25MB • Private by default</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
