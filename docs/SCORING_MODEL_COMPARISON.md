# Scoring Model Comparison: Old vs New

## Overview

ExtensionShield has two scoring systems:

1. **Legacy System** (`api/main.py` - `calculate_security_score`) - Simple point deduction
2. **Current System** (`scoring/engine.py` - `ScoringEngine`) - Confidence-weighted aggregation

---

## Legacy System (Old)

**Location:** `src/extension_shield/api/main.py::calculate_security_score()`

### Approach
- **Point deduction system**: Risk points are added up and deducted from 100
- **No confidence weighting**: All findings treated equally regardless of certainty
- **Fixed max risk points** per component

### Formula
```
score = 100 - sum_of_risk_points
```

### Components (with max risk points)
- SAST Findings: **40 pts max**
- Permissions Risk: **30 pts max**
- Webstore Trust: **20 pts max**
- Manifest Quality: **10 pts max**
- Third-Party API: **1 pt max**
- Screenshot Capture: **15 pts max**
- VirusTotal: **50 pts max**
- Entropy/Obfuscation: **30 pts max**
- ChromeStats: **28 pts max**
- Permission Alignment: **20 pts max**

**Total possible risk:** 244 points

### Example Calculation
```python
# Simple additive
sast_score = 8  # CRITICAL finding
permissions_score = 5  # High risk permission
virustotal_score = 15  # Single detection
final_score = 8 + 5 + 15 = 28 risk points
security_score = 100 - 28 = 72
```

### Characteristics
- ✅ Simple and easy to understand
- ❌ No confidence weighting (uncertain findings treated same as certain ones)
- ❌ No normalization (raw counts/severities)
- ❌ Hard to explain why a score is what it is
- ❌ Missing factors don't reduce confidence, they just don't contribute

---

## Current System (New - V2.0.0)

**Location:** `src/extension_shield/scoring/engine.py::ScoringEngine`

### Approach
- **Confidence-weighted aggregation**: Accounts for uncertainty in each factor
- **Normalized inputs**: All severities and confidences normalized to [0,1]
- **Explainable**: Each factor has a clear contribution
- **Three-layer architecture**: Security, Privacy, Governance

### Formula

**Layer Risk Calculation:**
```
R = Σ(w_i × c_i × s_i) / Σ(w_i × c_i)
```

**Layer Score:**
```
score = round(100 × (1 - R))
```

**Where:**
- `w_i` = weight of factor i
- `c_i` = confidence in factor i [0,1]
- `s_i` = severity of factor i [0,1]

**Factor Contribution:**
```
contribution = severity × confidence × weight
```

### Key Differences from Legacy

1. **Confidence in Denominator**
   - **Old**: `risk = Σ(contributions) / Σ(weights)` - confidence only in numerator
   - **New**: `risk = Σ(w×c×s) / Σ(w×c)` - confidence in both numerator and denominator
   - **Impact**: Low confidence factors contribute less to both risk and normalization

2. **Normalization**
   - **Old**: Raw counts/severities (e.g., "8 points for CRITICAL")
   - **New**: All normalized to [0,1] severity and confidence

3. **Missing Data Handling**
   - **Old**: Missing factors simply don't add risk points
   - **New**: Missing factors reduce overall confidence, which affects the denominator

### Example Calculation

```python
# Factor 1: SAST finding
severity = 0.8  # High severity (normalized)
confidence = 0.9  # High confidence
weight = 0.3
contribution = 0.8 × 0.9 × 0.3 = 0.216

# Factor 2: VirusTotal (uncertain)
severity = 0.6  # Medium severity
confidence = 0.3  # Low confidence (single detection, could be false positive)
weight = 0.25
contribution = 0.6 × 0.3 × 0.25 = 0.045

# Calculate risk
numerator = 0.216 + 0.045 = 0.261
denominator = (0.3 × 0.9) + (0.25 × 0.3) = 0.27 + 0.075 = 0.345
risk = 0.261 / 0.345 = 0.757

# Convert to score
score = round(100 × (1 - 0.757)) = round(24.3) = 24
```

### Characteristics
- ✅ Confidence-weighted (uncertain findings contribute less)
- ✅ Normalized inputs (consistent [0,1] scale)
- ✅ Explainable (each factor's contribution is clear)
- ✅ Missing data reduces confidence (more realistic)
- ✅ Three-layer architecture (Security, Privacy, Governance)
- ⚠️ More complex to understand initially

---

## Key Differences Summary

| Aspect | Legacy (Old) | Current (New) |
|--------|-------------|---------------|
| **Formula** | `score = 100 - Σ(risk_points)` | `R = Σ(w×c×s) / Σ(w×c)`, `score = 100×(1-R)` |
| **Confidence** | Not used | Used in both numerator and denominator |
| **Normalization** | Raw values | All [0,1] normalized |
| **Missing Data** | Doesn't affect score | Reduces confidence |
| **Explainability** | Limited | Full factor contributions |
| **Architecture** | Single security score | Three layers (Security, Privacy, Governance) |
| **Weight Usage** | Implicit in max points | Explicit weights per factor |

---

## Implementation Details

### Current System Architecture

1. **FactorScore** (`scoring/models.py`)
   - `severity`: [0,1] normalized risk
   - `confidence`: [0,1] certainty in the score
   - `weight`: [0,1] importance in layer aggregation
   - `contribution`: `severity × confidence × weight` (computed property)

2. **LayerScore** (`scoring/models.py`)
   - Aggregates multiple FactorScores
   - Uses confidence-weighted formula
   - Provides layer-level confidence

3. **ScoringResult** (`scoring/models.py`)
   - Combines three LayerScores
   - Overall score: weighted average of layer scores
   - Layer weights: Security (50%), Privacy (30%), Governance (20%)

### Formula Discrepancy Note

There's a discrepancy in the documentation:

- **`engine.py` (actual implementation)**: `R = Σ(w×c×s) / Σ(w×c)` ✅ **This is what's used**
- **`models.py::LayerScore.compute()`**: `risk = Σ(s×c×w) / Σ(w)` ❌ **Different formula**

The `engine.py` version is the authoritative implementation. The `LayerScore.compute()` method appears to use a simpler formula that doesn't include confidence in the denominator.

---

## Migration Notes

The legacy `calculate_security_score()` function is still present in `api/main.py` but the new `ScoringEngine` is the recommended approach for all new code.

**Current Status:**
- New scoring engine: V2.0.0 (`scoring/engine.py`)
- Legacy function: Still exists but deprecated (`api/main.py::calculate_security_score`)

