import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import { validateReturnTo } from "../../utils/authUtils";
import ShieldLogo from "../../components/ShieldLogo";
import "./AuthCallbackPage.scss";

/**
 * Auth Callback Page
 * 
 * Handles OAuth callback with PKCE flow:
 * 1. Receives code from URL query params
 * 2. Exchanges code for session using exchangeCodeForSession()
 * 3. Redirects to stored return URL or home page
 * 4. Shows loading state during processing
 */
const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("processing"); // processing, success, error
  
  // Guard against React 18 StrictMode double-run in dev
  const hasExchangedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in React 18 StrictMode
    if (hasExchangedRef.current) {
      // Never log sensitive values
      return;
    }

    const handleCallback = async () => {
      try {
        // Get code from URL query params
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Handle OAuth errors from provider
        // Never log sensitive values (codes, tokens, verifiers)
        if (errorParam) {
          // Only log error type, not full error details that might contain sensitive info
          console.error("OAuth error from provider:", errorParam);
          setError(errorDescription || errorParam || "Authentication failed");
          setStatus("error");
          
          // Redirect to validated return URL with error after a delay
          setTimeout(() => {
            const returnTo = validateReturnTo(sessionStorage.getItem("auth:returnTo"));
            sessionStorage.removeItem("auth:returnTo");
            navigate(`${returnTo}?authError=${encodeURIComponent(errorDescription || errorParam)}`, { replace: true });
          }, 2000);
          return;
        }

        // Validate code is present (user might land here manually or with invalid URL)
        // Never log the code value
        if (!code) {
          console.error("No authorization code in callback URL");
          setError("Missing authorization code. Please try signing in again.");
          setStatus("error");
          
          setTimeout(() => {
            const returnTo = validateReturnTo(sessionStorage.getItem("auth:returnTo"));
            sessionStorage.removeItem("auth:returnTo");
            navigate(`${returnTo}?authError=missing_code`, { replace: true });
          }, 2000);
          return;
        }

        // Mark as processing to prevent double-run
        hasExchangedRef.current = true;

        // Exchange code for session (PKCE flow)
        // Note: Never log the code or any sensitive values
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          // Never log the actual error message as it might contain sensitive info
          // Only log error type
          console.error("Failed to exchange code for session");
          
          // Handle specific PKCE verifier missing error
          const isPKCEError = exchangeError.message?.includes("code verifier") || 
                             exchangeError.message?.includes("both auth code and code verifier");
          
          if (isPKCEError) {
            setError("Authentication session expired. Please retry sign-in.");
          } else {
            setError(exchangeError.message || "Failed to complete sign in");
          }
          
          setStatus("error");
          
          setTimeout(() => {
            const returnTo = validateReturnTo(sessionStorage.getItem("auth:returnTo"));
            sessionStorage.removeItem("auth:returnTo");
            navigate(`${returnTo}?authError=${encodeURIComponent(exchangeError.message || "auth_failed")}`, { replace: true });
          }, 2000);
          return;
        }

        if (data?.session) {
          // Only log non-sensitive info (email is safe)
          console.log("Session created successfully, user:", data.session.user?.email);
          setStatus("success");
          
          // Get and validate return URL from sessionStorage
          const returnTo = validateReturnTo(sessionStorage.getItem("auth:returnTo"));
          sessionStorage.removeItem("auth:returnTo");
          
          // Redirect to return URL after brief delay to show success state
          setTimeout(() => {
            navigate(returnTo, { replace: true });
          }, 500);
        } else {
          console.error("No session returned from exchangeCodeForSession");
          setError("Session creation failed");
          setStatus("error");
          
          setTimeout(() => {
            const returnTo = validateReturnTo(sessionStorage.getItem("auth:returnTo"));
            sessionStorage.removeItem("auth:returnTo");
            navigate(`${returnTo}?authError=session_failed`, { replace: true });
          }, 2000);
        }
      } catch (err) {
        console.error("Unexpected error in auth callback:", err);
        setError(err.message || "An unexpected error occurred");
        setStatus("error");
        
        setTimeout(() => {
          const returnTo = validateReturnTo(sessionStorage.getItem("auth:returnTo"));
          sessionStorage.removeItem("auth:returnTo");
          navigate(`${returnTo}?authError=unexpected_error`, { replace: true });
        }, 2000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="auth-callback-page">
      <div className="auth-callback-container">
        <div className="auth-callback-content">
          <ShieldLogo size={64} />
          <h1 className="auth-callback-title">ExtensionShield</h1>
          
          {status === "processing" && (
            <>
              <div className="auth-callback-spinner">
                <div className="spinner-ring"></div>
              </div>
              <p className="auth-callback-message">Signing you in...</p>
            </>
          )}
          
          {status === "success" && (
            <>
              <div className="auth-callback-success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="auth-callback-message">Success! Redirecting...</p>
            </>
          )}
          
          {status === "error" && (
            <>
              <div className="auth-callback-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="auth-callback-message error">{error || "Authentication failed"}</p>
              <p className="auth-callback-submessage">Redirecting to home page...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;

