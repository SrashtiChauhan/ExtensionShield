import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import authService from "../services/authService";
import { supabase } from "../services/supabaseClient";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [authError, setAuthError] = useState(null);

  const toUiUser = useCallback((sbUser) => {
    if (!sbUser) return null;
    const meta = sbUser.user_metadata || {};
    const appMeta = sbUser.app_metadata || {};
    const provider = appMeta.provider || meta.provider || "email";
    const name = meta.full_name || meta.name || sbUser.email || "User";
    const avatar = meta.avatar_url || meta.picture || null;
    return {
      id: sbUser.id,
      email: sbUser.email,
      name,
      avatar,
      provider,
    };
  }, []);

  // Load session on mount + subscribe to auth changes
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;
        setSession(data.session || null);
        setUser(toUiUser(data.session?.user));
      } catch (error) {
        console.error("Auth session load failed:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession || null);
      setUser(toUiUser(nextSession?.user));
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, [toUiUser]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      await authService.signInWithGoogle();
      // OAuth redirects; session will be set by the auth listener on return.
      setIsSignInModalOpen(false);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGitHub = useCallback(async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      await authService.signInWithGitHub();
      setIsSignInModalOpen(false);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const sbUser = await authService.signInWithEmail(email, password);
      setUser(toUiUser(sbUser));
      setIsSignInModalOpen(false);
      return sbUser;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toUiUser]);

  const signUpWithEmail = useCallback(async (email, password, name) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const sbUser = await authService.signUpWithEmail(email, password, name);
      setUser(toUiUser(sbUser));
      setIsSignInModalOpen(false);
      return sbUser;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toUiUser]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openSignInModal = useCallback(() => {
    setAuthError(null);
    setIsSignInModalOpen(true);
  }, []);

  const closeSignInModal = useCallback(() => {
    setAuthError(null);
    setIsSignInModalOpen(false);
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated: !!session?.user,
    accessToken: session?.access_token || null,
    getAccessToken: () => session?.access_token || null,
    authError,
    isSignInModalOpen,
    signInWithGoogle,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    openSignInModal,
    closeSignInModal,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;





