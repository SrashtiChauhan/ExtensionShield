import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabaseClient";
import realScanService from "../../services/realScanService";
import ShieldLogo from "../../components/ShieldLogo";
import "./AuthDiagnosticsPage.scss";

/**
 * Auth Diagnostics Page (Dev Only)
 * 
 * Only accessible when VITE_DEBUG_AUTH=true
 * Shows current auth state, session info, and provides diagnostic tools
 * Never prints tokens or secrets
 */
const AuthDiagnosticsPage = () => {
  const { user, session, isAuthenticated } = useAuth();
  const [lastEvent, setLastEvent] = useState(null);
  const [refreshResult, setRefreshResult] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  // Hard-disable in production unless user is admin
  const isProduction = import.meta.env.PROD === true;
  const isDebugMode = import.meta.env.VITE_DEBUG_AUTH === "true";
  
  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isProduction || !isAuthenticated || !session) {
        setIsAdmin(!isProduction && isDebugMode);
        setIsCheckingAdmin(false);
        return;
      }

      try {
        // Check if user has admin role in app_metadata
        const userRole = session.user?.app_metadata?.role;
        const isUserAdmin = userRole === "admin" || userRole === "super_admin";
        setIsAdmin(isUserAdmin);
      } catch (err) {
        // Fail closed - don't allow access if check fails
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [isProduction, isAuthenticated, session, isDebugMode]);

  useEffect(() => {
    if (!isAdmin || isCheckingAdmin) {
      return;
    }

    // Listen to auth events for diagnostics
    // Never log sensitive values (tokens, codes, verifiers)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setLastEvent({
        event,
        timestamp: new Date().toISOString(),
        hasSession: !!session,
        userId: session?.user?.id || null,
      });
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, [isAdmin, isCheckingAdmin]);

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    setRefreshResult(null);
    try {
      // Never log tokens, codes, or verifiers
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        setRefreshResult({
          success: false,
          error: error.message,
        });
      } else {
        setRefreshResult({
          success: true,
          hasSession: !!data.session,
          userId: data.session?.user?.id || null,
        });
      }
    } catch (err) {
      setRefreshResult({
        success: false,
        error: err.message || "Unknown error",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Redact sensitive values (only for access token, never for refresh token)
  const redactToken = (token) => {
    if (!token) return "null";
    if (token.length < 10) return "***";
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  };
  
  // Check if refresh token is present (never show the actual value)
  const hasRefreshToken = () => {
    return session?.refresh_token ? "present" : "absent";
  };

  // Calculate token expiry
  const getTokenExpiry = () => {
    if (!session?.expires_at) return "N/A";
    const expiryDate = new Date(session.expires_at * 1000);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return "Expired";
    if (diffMins < 60) return `${diffMins} minutes`;
    const hours = Math.floor(diffMins / 60);
    return `${hours} hours, ${diffMins % 60} minutes`;
  };

  // Check if realScanService has token
  const hasApiToken = () => {
    // We can't directly access the token, but we can check if getAuthHeaders returns something
    const headers = realScanService.getAuthHeaders();
    return !!headers.Authorization;
  };

  // Show loading state while checking admin status
  if (isCheckingAdmin) {
    return (
      <div className="auth-diagnostics-page">
        <div className="auth-diagnostics-container">
          <div className="auth-diagnostics-content">
            <h1>Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  // Hard-disable in production unless user is admin
  if (isProduction && !isAdmin) {
    return (
      <div className="auth-diagnostics-page">
        <div className="auth-diagnostics-container">
          <div className="auth-diagnostics-content">
            <h1>Access Denied</h1>
            <p>Diagnostics page is disabled in production.</p>
            <p>Only administrators can access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  // Disable in non-production if debug mode is off
  if (!isProduction && !isDebugMode) {
    return (
      <div className="auth-diagnostics-page">
        <div className="auth-diagnostics-container">
          <div className="auth-diagnostics-content">
            <h1>Access Denied</h1>
            <p>Diagnostics page is only available in debug mode.</p>
            <p>Set VITE_DEBUG_AUTH=true to enable.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-diagnostics-page">
      <div className="auth-diagnostics-container">
        <div className="auth-diagnostics-content">
          <div className="diagnostics-header">
            <ShieldLogo size={48} />
            <h1>Auth Diagnostics</h1>
            <p className="debug-warning">⚠️ Debug Mode Enabled</p>
          </div>

          <div className="diagnostics-section">
            <h2>Current Session</h2>
            <div className="diagnostics-grid">
              <div className="diagnostics-item">
                <span className="label">Session Present:</span>
                <span className="value">{session ? "✅ Yes" : "❌ No"}</span>
              </div>
              <div className="diagnostics-item">
                <span className="label">Authenticated:</span>
                <span className="value">{isAuthenticated ? "✅ Yes" : "❌ No"}</span>
              </div>
              <div className="diagnostics-item">
                <span className="label">User ID:</span>
                <span className="value">{user?.id || "N/A"}</span>
              </div>
              <div className="diagnostics-item">
                <span className="label">User Email:</span>
                <span className="value">{user?.email || "N/A"}</span>
              </div>
              <div className="diagnostics-item">
                <span className="label">Token Expiry:</span>
                <span className="value">{getTokenExpiry()}</span>
              </div>
              <div className="diagnostics-item">
                <span className="label">API Token Set:</span>
                <span className="value">{hasApiToken() ? "✅ Yes" : "❌ No"}</span>
              </div>
            </div>
          </div>

          {lastEvent && (
            <div className="diagnostics-section">
              <h2>Last Auth Event</h2>
              <div className="diagnostics-grid">
                <div className="diagnostics-item">
                  <span className="label">Event:</span>
                  <span className="value">{lastEvent.event}</span>
                </div>
                <div className="diagnostics-item">
                  <span className="label">Timestamp:</span>
                  <span className="value">{new Date(lastEvent.timestamp).toLocaleString()}</span>
                </div>
                <div className="diagnostics-item">
                  <span className="label">Had Session:</span>
                  <span className="value">{lastEvent.hasSession ? "✅ Yes" : "❌ No"}</span>
                </div>
              </div>
            </div>
          )}

          <div className="diagnostics-section">
            <h2>Session Details</h2>
            <div className="diagnostics-grid">
              <div className="diagnostics-item">
                <span className="label">Access Token:</span>
                <span className="value redacted">
                  {session?.access_token ? redactToken(session.access_token) : "N/A"}
                </span>
              </div>
              <div className="diagnostics-item">
                <span className="label">Refresh Token:</span>
                <span className="value">
                  {hasRefreshToken()}
                </span>
              </div>
              <div className="diagnostics-item">
                <span className="label">Expires At:</span>
                <span className="value">
                  {session?.expires_at
                    ? new Date(session.expires_at * 1000).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {refreshResult && (
            <div className="diagnostics-section">
              <h2>Refresh Result</h2>
              <div className={`refresh-result ${refreshResult.success ? "success" : "error"}`}>
                {refreshResult.success ? (
                  <>
                    <p>✅ Session refreshed successfully</p>
                    <p>Has Session: {refreshResult.hasSession ? "Yes" : "No"}</p>
                    {refreshResult.userId && <p>User ID: {refreshResult.userId}</p>}
                  </>
                ) : (
                  <p>❌ Error: {refreshResult.error}</p>
                )}
              </div>
            </div>
          )}

          <div className="diagnostics-actions">
            <button
              onClick={handleRefreshSession}
              disabled={isRefreshing}
              className="action-button refresh"
            >
              {isRefreshing ? "Refreshing..." : "Refresh Session"}
            </button>
            <button onClick={handleSignOut} className="action-button signout">
              Sign Out
            </button>
          </div>

          <div className="diagnostics-footer">
            <p>🔒 No tokens or secrets are displayed in full</p>
            <p>Refresh tokens are never displayed (only presence/absence)</p>
            {isProduction ? (
              <p>⚠️ Production mode - Admin access only</p>
            ) : (
              <p>This page is only available when VITE_DEBUG_AUTH=true</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthDiagnosticsPage;

