# ExtensionShield Scan Workflow Documentation

This document describes the complete workflow of the ExtensionShield scanning system, from when a user initiates a scan on `/scan` to when the scan completes and results are displayed.

## Table of Contents

1. [Frontend Workflow](#frontend-workflow)
2. [Backend Workflow](#backend-workflow)
3. [Game Screen Integration](#game-screen-integration)
4. [Scan Completion Flow](#scan-completion-flow)
5. [API Endpoints](#api-endpoints)

---

## Frontend Workflow

### 1. Initial Scan Request (`/scan` Route)

**Location:** `frontend/src/pages/scanner/ScannerPage.jsx`

**User Action:**
- User enters a Chrome Web Store URL in the input field
- User clicks "Scan Extension" button

**Code Flow:**
```javascript
handleScanClick() → startScan(url)
```

**What Happens:**
1. User input validation (checks if URL is not empty)
2. Calls `startScan(url)` from `ScanContext`

---

### 2. Scan Context - Start Scan Process

**Location:** `frontend/src/context/ScanContext.jsx`

**Function:** `startScan(scanUrl)`

**Step-by-Step Process:**

#### Step 1: Initial Setup
```javascript
setIsScanning(true)
setError(null)
setScanResults(null)
setScanStage("extracting")
```

#### Step 2: Extract Extension ID
```javascript
const extId = extractExtensionId(urlToScan)
// Extracts 32-character extension ID from Chrome Web Store URL
// Example: https://chromewebstore.google.com/detail/.../jcmljanephecacpljcpiogonhhadfpda
// Returns: jcmljanephecacpljcpiogonhhadfpda
setCurrentExtensionId(extId)
```

#### Step 3: Daily Deep-Scan Limit Check (Production Only)
```javascript
// Skip in development mode
if (isProduction) {
  const limit = await realScanService.getDeepScanLimitStatus()
  if (limit.remaining <= 0) {
    const cached = await realScanService.hasCachedResults(extId)
    if (!cached) {
      // Show error: "Daily deep-scan limit reached"
      return
    }
  }
}
```

#### Step 4: Navigate to Progress/Game Page
```javascript
// Navigate IMMEDIATELY for best UX
navigate(`/scan/progress/${extId}`)
// User sees game screen right away
```

#### Step 5: Check Existing Scan Status
```javascript
const status = await realScanService.checkScanStatus(extId)
// GET /api/scan/status/{extension_id}
```

**Possible Status Responses:**
- `{ scanned: false }` - No scan exists, need to trigger new scan
- `{ scanned: true, status: "completed" }` - Scan already completed (cached)
- `{ scanned: false, status: "running" }` - Scan already in progress

#### Step 6: Trigger New Scan (if needed)
```javascript
if (!status.scanned) {
  scanTrigger = await realScanService.triggerScan(urlToScan)
  // POST /api/scan/trigger
  // Body: { url: "https://chromewebstore.google.com/..." }
}
```

**Trigger Scan Response:**
- `{ status: "running", extension_id: "...", already_scanned: false }` - New scan started
- `{ status: "completed", already_scanned: true }` - Cached results available
- `{ status: "running" }` - Scan already in progress

#### Step 7: Wait for Scan Completion (if new scan)
```javascript
if (!status.scanned && scanTrigger && !scanTrigger.already_scanned) {
  await waitForScanCompletion(extId)
}
```

**Wait Process:**
- Polls scan status every 2 seconds
- Updates `scanStage` through stages:
  1. `"extracting"` (14% progress)
  2. `"security_scan"` (28% progress)
  3. `"building_evidence"` (42% progress)
  4. `"applying_rules"` (71% progress)
  5. `"generating_report"` (100% progress)

#### Step 8: Fetch Scan Results
```javascript
// Retry up to 10 times with 1.5s delay between attempts
for (let i = 0; i < 10; i++) {
  results = await realScanService.getRealScanResults(extId)
  // GET /api/scan/results/{extension_id}
  if (results) break
  await sleep(1500)
}
setScanResults(results)
setIsScanning(false)
```

#### Step 9: Refresh History & Stats
```javascript
await loadScanHistory()
await loadDashboardStats()
// Note: Does NOT auto-navigate to results
// User stays on game screen with completion modal
```

---

### 3. Progress Page (`/scan/progress/:scanId`)

**Location:** `frontend/src/pages/scanner/ScanProgressPage.jsx`

**Route:** `/scan/progress/{extension_id}`

**Component Mount Sequence:**

#### Initial Render
```javascript
const { scanId } = useParams() // Get extension ID from URL
const [userExited, setUserExited] = useState(false)
const [scanComplete, setScanComplete] = useState(false)
```

#### Reset State on Mount
```javascript
useEffect(() => {
  if (scanId) {
    setUserExited(false)        // Ensure game shows
    setScanComplete(false)      // Reset completion state
    completionShownRef.current = false
  }
}, [scanId])
```

#### Game Display Logic
```javascript
const shouldShowGame = scanId ? !userExited : false
// Game shows when:
// - scanId exists in URL
// - user hasn't explicitly exited to view results
```

#### Render Decision
```javascript
{shouldShowGame ? (
  // Show Rocket Game + ScanHUD
) : (
  // Show fallback "Scan Status" UI (shouldn't happen normally)
)}
```

---

### 4. Rocket Game Component

**Location:** `frontend/src/components/RocketGame.jsx`

**Props:**
- `isActive={true}` - Game is active and playable
- `statusLabel` - Text shown above game (e.g., "Running the scan... Play a game till then!")
- `onStatsUpdate` - Callback for score/time updates
- `showScoreboard={false}` - Hide scoreboard in scan mode

**Game Features:**
- Full-screen canvas game
- Rocket ship controlled with arrow keys
- Shooting mechanics
- Score tracking
- Game over detection

**Integration:**
```javascript
<RocketGame 
  isActive={true} 
  statusLabel={
    scanComplete 
      ? "Scan complete! Keep playing or click 'View Results' above." 
      : "Running the scan... Play a game till then!"
  }
  onStatsUpdate={(stats) => {
    setGameStats(stats)
    if (stats.gameOver !== undefined) {
      setGameOver(stats.gameOver)
    }
  }}
  showScoreboard={false}
/>
```

---

### 5. Status Polling on Progress Page

**Location:** `frontend/src/pages/scanner/ScanProgressPage.jsx`

**Polling Logic:**
```javascript
useEffect(() => {
  if (!scanId) return
  
  const checkStatus = async () => {
    const status = await realScanService.checkScanStatus(scanId)
    // GET /api/scan/status/{extension_id}
    
    if (status.scanned) {
      setScanComplete(true)
      if (!completionShownRef.current) {
        completionShownRef.current = true
        setShowCompletionModal(true) // Show completion popup
      }
      
      // Fetch results in background
      const results = await realScanService.getRealScanResults(scanId)
      if (results) {
        setScanResults(results)
      }
    }
  }
  
  // Poll immediately, then every 2.5 seconds
  checkStatus()
  const intervalId = setInterval(checkStatus, 2500)
  
  return () => clearInterval(intervalId)
}, [scanId])
```

**Polling Behavior:**
- Starts immediately when component mounts
- Polls every 2.5 seconds
- Continues until scan completes or component unmounts
- Handles errors gracefully (shows error modal, keeps game running)

---

### 6. Scan HUD Component

**Location:** `frontend/src/components/ScanHUD.jsx`

**Displays:**
- Extension icon and name
- Current scan stage (extracting, security_scan, etc.)
- Progress percentage
- Game stats (score, time)
- "View Findings" button (when complete)
- "Cancel Scan" button

**Position:** Overlay on top of game screen

---

## Backend Workflow

### 1. Trigger Scan Endpoint

**Location:** `src/extension_shield/api/main.py`

**Endpoint:** `POST /api/scan/trigger`

**Request:**
```json
{
  "url": "https://chromewebstore.google.com/detail/extension-name/jcmljanephecacpljcpiogonhhadfpda"
}
```

**Process:**

#### Step 1: Extract Extension ID
```python
extension_id = extract_extension_id(url)
# Returns: jcmljanephecacpljcpiogonhhadfpda
```

#### Step 2: Check for Cached Results
```python
if _has_cached_results(extension_id):
    # Return cached results immediately
    return {
        "status": "completed",
        "already_scanned": True,
        "scan_type": "lookup"
    }
```

#### Step 3: Check if Already Scanning
```python
if extension_id in scan_status and scan_status[extension_id] == "running":
    return {
        "status": "running",
        "message": "Scan already in progress"
    }
```

#### Step 4: Daily Deep-Scan Limit Check (Production)
```python
if settings.is_prod():
    limit_status = _deep_scan_limit_status(user_id)
    if limit_status["remaining"] <= 0:
        raise HTTPException(429, "Daily deep-scan limit reached")
```

#### Step 5: Consume Deep-Scan Quota
```python
after_consume = _consume_deep_scan(user_id)
```

#### Step 6: Start Background Task
```python
background_tasks.add_task(run_analysis_workflow, url, extension_id)
scan_status[extension_id] = "running"

return {
    "status": "running",
    "extension_id": extension_id,
    "scan_type": "deep_scan",
    "deep_scan_limit": after_consume
}
```

---

### 2. Analysis Workflow (Background Task)

**Location:** `src/extension_shield/api/main.py`

**Function:** `run_analysis_workflow(url, extension_id)`

**Process:**

#### Step 1: Initialize Workflow State
```python
initial_state = {
    "workflow_id": extension_id,
    "chrome_extension_path": url,
    "status": WorkflowStatus.PENDING,
    "start_time": datetime.now().isoformat(),
    # ... other fields
}
```

#### Step 2: Build Workflow Graph
```python
graph = build_graph()
# Creates LangGraph workflow with nodes:
# - extract_extension
# - analyze_manifest
# - security_scan
# - governance_check
# - generate_report
```

#### Step 3: Execute Workflow
```python
final_state = await graph.ainvoke(initial_state)
# Runs through all workflow nodes
# Updates state at each step
```

#### Step 4: Process Results
```python
# Extract metadata
extension_name = final_state.get("extension_metadata", {}).get("name")
metadata = {...}
manifest = {...}
analysis_results = {...}

# Calculate scores
scoring_result = calculate_security_scores(...)

# Build report view model
report_view_model = _build_report_view_model_safe(...)
```

#### Step 5: Store Results
```python
scan_results[extension_id] = {
    "extension_id": extension_id,
    "extension_name": extension_name,
    "timestamp": datetime.now().isoformat(),
    "status": "completed",
    "metadata": metadata,
    "manifest": manifest,
    "permissions_analysis": {...},
    "sast_results": {...},
    "webstore_analysis": {...},
    "virustotal_analysis": {...},
    "security_score": scoring_result.security_score,
    "privacy_score": scoring_result.privacy_score,
    "governance_score": scoring_result.governance_score,
    "report_view_model": report_view_model,
    # ... more fields
}

scan_status[extension_id] = "completed"
```

#### Step 6: Handle Errors
```python
except Exception as e:
    scan_status[extension_id] = "failed"
    scan_results[extension_id] = {
        "error": str(e),
        "error_code": getattr(e, "error_code", None),
        "status": "failed"
    }
```

---

### 3. Status Check Endpoint

**Location:** `src/extension_shield/api/main.py`

**Endpoint:** `GET /api/scan/status/{extension_id}`

**Response:**
```python
status = scan_status.get(extension_id)  # "running", "completed", "failed", or None

if not status:
    return ScanStatusResponse(scanned=False)

result = scan_results.get(extension_id, {})

return ScanStatusResponse(
    scanned=(status == "completed"),
    status=status,
    extension_id=extension_id,
    error=result.get("error"),
    error_code=result.get("error_code")
)
```

---

### 4. Get Results Endpoint

**Location:** `src/extension_shield/api/main.py`

**Endpoint:** `GET /api/scan/results/{extension_id}`

**Response:**
```python
result = scan_results.get(extension_id)

if not result:
    raise HTTPException(404, "No scan results found")

# Optionally save to database
if user_id:
    db.save_scan_result(...)

return result
```

---

## Game Screen Integration

### When Game Screen Loads

**Trigger:** User navigates to `/scan/progress/{extension_id}`

**What Happens:**

1. **Component Mounts:**
   - `ScanProgressPage` component renders
   - `scanId` extracted from URL params
   - `userExited` reset to `false`
   - `shouldShowGame` evaluates to `true`

2. **Game Renders:**
   - `RocketGame` component mounts
   - Full-screen canvas initialized
   - Game loop starts
   - Status label shows: "Running the scan... Play a game till then!"

3. **ScanHUD Overlay:**
   - Extension icon and name displayed
   - Scan stage indicator
   - Progress percentage
   - Game stats overlay

4. **Status Polling Starts:**
   - Immediate status check
   - Polls every 2.5 seconds
   - Updates scan stage and progress

---

## Scan Completion Flow

### When Scan Completes

**Backend:**
1. `run_analysis_workflow` finishes
2. `scan_status[extension_id] = "completed"`
3. `scan_results[extension_id] = {...}` (full results stored)

**Frontend Polling:**
1. Next poll detects `status.scanned === true`
2. `setScanComplete(true)` called
3. `setShowCompletionModal(true)` called (if not already shown)

**UI Updates:**
1. **Game Screen:**
   - Status label changes to: "Scan complete! Keep playing or click 'View Results' above."
   - "View Results" button appears in retro header overlay

2. **Completion Modal:**
   ```javascript
   <Dialog open={showCompletionModal}>
     <DialogTitle>✅ Scan Complete!</DialogTitle>
     <DialogDescription>
       Your extension scan has finished successfully. 
       You can continue playing the game or view the results now.
     </DialogDescription>
     <DialogFooter>
       <Button onClick={handleContinuePlaying}>Keep Playing</Button>
       <Button onClick={handleViewResults}>View Results</Button>
     </DialogFooter>
   </Dialog>
   ```

3. **User Options:**
   - **Keep Playing:** Modal closes, game continues, user can play indefinitely
   - **View Results:** Navigates to `/scan/results/{extension_id}` or `/extension/{extension_id}/version/{build_hash}`

---

## API Endpoints Summary

### Frontend Service Methods

**Location:** `frontend/src/services/realScanService.js`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `checkScanStatus(extensionId)` | `GET /api/scan/status/{extension_id}` | Check if scan is complete |
| `triggerScan(url)` | `POST /api/scan/trigger` | Start a new scan |
| `getRealScanResults(extensionId)` | `GET /api/scan/results/{extension_id}` | Get scan results |
| `getDeepScanLimitStatus()` | `GET /api/limits/deep-scan` | Check daily scan limit |
| `hasCachedResults(extensionId)` | `GET /api/scan/results/{extension_id}` | Check if results exist (cached) |

### Backend Endpoints

**Location:** `src/extension_shield/api/main.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scan/trigger` | POST | Trigger a new extension scan |
| `/api/scan/status/{extension_id}` | GET | Get scan status |
| `/api/scan/results/{extension_id}` | GET | Get scan results |
| `/api/scan/upload` | POST | Upload CRX/ZIP file and scan |
| `/api/limits/deep-scan` | GET | Get daily deep-scan limit status |

---

## Complete Flow Diagram

```
User on /scan
    ↓
Enter URL → Click "Scan Extension"
    ↓
startScan() in ScanContext
    ↓
Extract Extension ID
    ↓
Check Daily Limit (production only)
    ↓
Navigate to /scan/progress/{extension_id}  ← USER SEES GAME IMMEDIATELY
    ↓
Check Existing Scan Status
    ↓
[If not scanned] → Trigger New Scan (POST /api/scan/trigger)
    ↓
Backend: Start Background Task (run_analysis_workflow)
    ↓
Frontend: Poll Status Every 2.5s (GET /api/scan/status/{extension_id})
    ↓
Backend: Workflow Executes
    - Extract extension
    - Analyze manifest
    - Security scan
    - Governance check
    - Generate report
    ↓
Backend: Store Results, Set Status = "completed"
    ↓
Frontend: Poll Detects Completion
    ↓
Frontend: Show Completion Modal
    ↓
User Choice:
    - Keep Playing (game continues)
    - View Results (navigate to results page)
```

---

## Key Design Decisions

1. **Immediate Navigation:** User navigates to game screen immediately after clicking scan, providing instant feedback
2. **Background Processing:** Scan runs in background while user plays game
3. **Polling Strategy:** Frontend polls status every 2.5 seconds (not WebSocket) for simplicity
4. **No Auto-Navigation:** User stays on game screen after completion, can choose when to view results
5. **Cached Results:** If scan already exists, returns immediately without consuming quota
6. **Error Handling:** Errors shown in modal, game continues running
7. **Stage Progression:** Visual progress through scan stages (extracting → security_scan → building_evidence → applying_rules → generating_report)

---

## State Management

### ScanContext State
- `isScanning`: Boolean - Is scan in progress
- `scanStage`: String - Current scan stage
- `scanResults`: Object - Final scan results
- `error`: String - Error message if any
- `currentExtensionId`: String - Current extension being scanned

### ScanProgressPage State
- `scanId`: String - Extension ID from URL params
- `userExited`: Boolean - Has user exited to view results
- `scanComplete`: Boolean - Is scan completed
- `showCompletionModal`: Boolean - Show completion popup
- `gameStats`: Object - Game score/time stats
- `scanProgress`: Number - Progress percentage (0-100)

---

## Error Handling

### Frontend Errors
- **Network Errors:** Shown in error modal, game continues
- **API Errors (401):** "Connection is down try back in a while"
- **Quota Errors (429):** "Daily deep-scan limit reached"
- **LLM Errors:** "LLM service unavailable" or "LLM service quota exceeded"

### Backend Errors
- **Invalid URL:** 400 Bad Request
- **Rate Limit:** 429 Too Many Requests
- **Scan Failed:** Status set to "failed", error stored in results
- **LLM Failures:** Handled gracefully, scan continues with available data

---

## Performance Considerations

1. **Immediate Navigation:** User sees game instantly, scan starts in background
2. **Polling Interval:** 2.5 seconds balances responsiveness vs. server load
3. **Result Caching:** Cached results returned immediately without new scan
4. **Background Tasks:** Heavy analysis runs asynchronously, doesn't block API response
5. **Lazy Loading:** Game component and other heavy components loaded lazily

---

## Future Improvements

1. **WebSocket Support:** Replace polling with WebSocket for real-time updates
2. **Progressive Results:** Show partial results as scan progresses
3. **Multiple Scans:** Allow queuing multiple scans
4. **Scan History:** Better integration with scan history page
5. **Offline Support:** Cache results for offline viewing

---

## Testing Scenarios

1. **New Scan:** User scans extension for first time
2. **Cached Scan:** User scans extension that was already scanned
3. **Scan in Progress:** User navigates to progress page while scan is running
4. **Scan Failure:** Backend scan fails, error shown in modal
5. **Network Error:** API unavailable, error shown, game continues
6. **Quota Exceeded:** Daily limit reached, appropriate error shown
7. **Hard Reload:** User refreshes progress page, game shows, polling resumes

---

## Code References

- **Frontend Scan Context:** `frontend/src/context/ScanContext.jsx`
- **Scanner Page:** `frontend/src/pages/scanner/ScannerPage.jsx`
- **Progress Page:** `frontend/src/pages/scanner/ScanProgressPage.jsx`
- **Rocket Game:** `frontend/src/components/RocketGame.jsx`
- **Scan HUD:** `frontend/src/components/ScanHUD.jsx`
- **Scan Service:** `frontend/src/services/realScanService.js`
- **Backend API:** `src/extension_shield/api/main.py`
- **Workflow:** `src/extension_shield/workflow/` (various nodes)

---

*Last Updated: 2024*

