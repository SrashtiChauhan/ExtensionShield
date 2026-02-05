/**
 * Authentication Service (Supabase Auth)
 * Keeps the existing modal UI but replaces demo/mock auth with real Supabase Auth.
 */

import { supabase } from "./supabaseClient";

const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw new Error(error.message || "Google sign-in failed");
};

const signInWithGitHub = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw new Error(error.message || "GitHub sign-in failed");
};

const signInWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message || "Invalid credentials");
  return data.user;
};

const signUpWithEmail = async (email, password, name) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: name ? { data: { full_name: name } } : undefined,
  });
  if (error) throw new Error(error.message || "Sign up failed");
  return data.user;
};

const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message || "Sign out failed");
};

const authService = {
  signInWithGoogle,
  signInWithGitHub,
  signInWithEmail,
  signUpWithEmail,
  signOut,
};

export default authService;





