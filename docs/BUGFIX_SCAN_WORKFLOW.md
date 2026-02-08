# Bug Fix: Scan Workflow - Table Disappearing and Stuck Scanning State

## Issue Summary

When navigating to `/scan`, the extension table would initially load correctly, but then disappear and get stuck showing "Scanning..." state. The correct workflow (scan → game screen → completion modal → results) was not working properly.

## Root Causes

### 1. **Timing Issue: Navigation Happened Too Late**
- **Problem**: `ScanContext.startScan()` was checking scan status and triggering the scan, but navigation to the progress page happened **after** these async operations, causing the user to see "Scanning..." on the `/scan` page instead of immediately going to the game screen.
- **Impact**: User experience was confusing - clicking scan would show "Scanning..." button but stay on the same page.

### 2. **Redundant State Management in ScanProgressPage**
- **Problem**: Multiple overlapping conditions controlled when the game should show:
  - `gameStarted` state
  - `shouldShowGame` computed value with 5+ conditions
  - Separate `useEffect` watching `scanResults` for completion
  - These could conflict, causing the game to not show or show incorrectly
- **Impact**: Game screen might not appear, or completion modal might not trigger properly.

### 3. **404 Errors Treated as Fatal**
- **Problem**: `realScanService.getRealScanResults()` threw errors for 404 responses, which are **expected** when a scan is still running (results don't exist yet).
- **Impact**: Console spam with "Failed to get real scan results" errors, even though this is normal behavior during scanning.

### 4. **CSP Blocking Vite Dev Workers**
- **Problem**: Vite's dev server uses blob URLs for workers, but CSP `worker-src 'self'` didn't allow `blob:`, causing CSP violations.
- **Impact**: Dev console warnings, potential HMR issues.

### 5. **Frame-Ancestors CSP Warning**
- **Problem**: `frame-ancestors` directive was included in meta tag CSP, but browsers ignore this directive when delivered via `<meta>` element (only works in HTTP headers).
- **Impact**: Harmless but noisy console warnings.

## Fixes Applied

### 1. **Immediate Navigation to Game Screen**
**File**: `frontend/src/context/ScanContext.jsx`

- Changed navigation to happen **immediately** after extracting extension ID
- Scan trigger happens **after** navigation, so user sees game screen right away
- Removed auto-redirect to results page - let completion modal handle navigation

```javascript
// Before: Navigate after checking status and triggering scan
const status = await realScanService.checkScanStatus(extId);
// ... trigger scan ...
navigate(`/scan/progress/${extId}`);

// After: Navigate immediately, then trigger scan
navigate(`/scan/progress/${extId}`);
// ... trigger scan in background ...
```

### 2. **Simplified Game State Logic**
**File**: `frontend/src/pages/scanner/ScanProgressPage.jsx`

- Removed redundant `gameStarted` state variable
- Simplified `shouldShowGame` to: `Boolean(scanId && !userExited)`
- Single polling effect that handles all status checks
- Completion modal shows once using a ref guard

```javascript
// Before: Multiple overlapping conditions
const shouldShowGame = 
  (isScanning && currentExtensionId === scanId) || 
  (scanComplete && !userExited) ||
  (gameStarted && !userExited) ||
  (currentExtensionId === scanId && !userExited) ||
  (scanId && !userExited);

// After: Simple, clear condition
const shouldShowGame = Boolean(scanId && !userExited);
```

### 3. **Graceful 404 Handling**
**File**: `frontend/src/services/realScanService.js`

- Changed `getRealScanResults()` to return `null` on 404 instead of throwing
- 404 is expected when scan is still running, so this is not an error condition

```javascript
// Before: Threw error on 404
if (response.ok) {
  // ...
} else {
  throw new Error("No scan results found.");
}

// After: Return null on 404 (expected during scan)
if (response.ok) {
  // ...
} else if (response.status === 404) {
  return null; // Results not ready yet - this is normal
} else {
  throw new Error("No scan results found.");
}
```

### 4. **Fixed CSP for Vite Dev Workers**
**File**: `frontend/vite.config.js`

- Added `blob:` to `worker-src` in dev mode to allow Vite's blob URLs

```javascript
// Before
"worker-src 'self'"

// After (dev mode)
"worker-src 'self' blob:"
```

### 5. **Removed Frame-Ancestors from Meta CSP**
**File**: `frontend/vite.config.js`

- Removed `frame-ancestors` from CSP meta tag (browsers ignore it in meta tags anyway)

### 6. **Removed Debug Console Logs**
**File**: `frontend/src/pages/scanner/ScannerPage.jsx`

- Removed verbose `[ScannerPage]` console logs that were added for debugging

## Correct Workflow (After Fix)

1. **User clicks "Scan Extension"** on `/scan` page
2. **Immediately navigates** to `/scan/progress/:scanId` (game screen)
3. **Game loads** while scan runs in background
4. **Scan completes** → Polling detects completion
5. **Completion modal appears** with options:
   - "Keep Playing" - dismisses modal, game continues
   - "View Results" - navigates to `/scan/results/:scanId`
6. **Results page** displays scan analysis

## Testing Checklist

- [x] Clicking scan immediately navigates to game screen
- [x] Game shows while scan is running
- [x] Completion modal appears when scan finishes
- [x] "Keep Playing" allows continuing game
- [x] "View Results" navigates to results page
- [x] No console errors for 404 during scan
- [x] No CSP warnings in dev console
- [x] Table on `/scan` page loads correctly and doesn't disappear

## Files Changed

- `frontend/src/context/ScanContext.jsx` - Immediate navigation, removed auto-redirect
- `frontend/src/pages/scanner/ScanProgressPage.jsx` - Simplified game state, single polling effect
- `frontend/src/services/realScanService.js` - Graceful 404 handling
- `frontend/src/pages/scanner/ScannerPage.jsx` - Removed debug logs
- `frontend/vite.config.js` - Fixed CSP for dev workers, removed frame-ancestors

## Related Issues

- This fix ensures the scan workflow matches the intended UX design
- Prevents confusion from staying on `/scan` page during scanning
- Eliminates redundant state management that could cause race conditions

## Future Considerations

- Consider adding a loading state on the game screen if scan hasn't started yet
- May want to add retry logic if scan trigger fails
- Consider adding a "Cancel Scan" option that stops the background scan

