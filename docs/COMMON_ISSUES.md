# Common Issues & Improvements

This document highlights a few observations and suggestions based on practical usage of ExtensionShield. These are intended to improve clarity and make onboarding easier, especially for new users.

---

## 1. Environment Configuration

An `.env.example` file is already provided, which is helpful. However, new users may still be unsure how to use it correctly.

**Suggestion:**
Add a brief explanation in the setup guide that:
- Instructs users to copy `.env.example` to `.env`
- Mentions which variables are required (e.g., `OPENAI_API_KEY`)
- Clarifies that basic functionality works in OSS mode without additional setup

---

## 2. Chrome Web Store URL Requirement

While analyzing extensions, users may encounter issues if the input URL format is incorrect.

**Suggestion:**
Explicitly mention that only Chrome Web Store extension URLs are supported.

Example:
https://chromewebstore.google.com/detail/<extension-id>

---

## 3. "Unknown" Analysis Results

Some extensions may appear as **"Unknown"** during analysis.

**Possible reasons include:**
- Limited or unavailable metadata
- Fetching limitations
- Unsupported extension structure

**Suggestion:**
Providing a short explanation in the UI or documentation would help users better understand this outcome.

---

## 4. Beginner-Friendly Setup Overview

The setup steps are well-structured, but a quick overview could help new users get started faster.

**Suggestion:**
Include a short quick-start summary such as:
- Clone the repository  
- Run `make install`  
- Run `make api`  
- Run `make frontend`  

---

## 5. CLI Usage Clarity

A CLI example is already provided, but highlighting its usage more clearly could improve usability for beginners.

**Suggestion:**
Briefly explain:
- Where to run the command
- What type of URL should be used
- What kind of output to expect

---

## Summary

These suggestions are based on real usage of ExtensionShield during extension analysis. Addressing them can improve clarity, reduce confusion, and enhance the overall user experience.
