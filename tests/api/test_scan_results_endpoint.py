"""
Tests for GET /api/scan/results/{extension_id} endpoint.

Focus: ensure legacy payloads (missing report_view_model) are upgraded to include
report_view_model.consumer_insights in the returned JSON.
"""

from typing import Dict, Any

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from extension_shield.api.main import app, scan_results


@pytest.fixture
def client() -> TestClient:
  """Create a test client for the FastAPI app."""
  return TestClient(app)


def _make_legacy_db_row(extension_id: str) -> Dict[str, Any]:
  """
  Build a minimal legacy-style scan_results row:
  - Has scoring_v2
  - Missing report_view_model
  """
  return {
    "extension_id": extension_id,
    "extension_name": "Legacy Extension",
    "url": f"https://chromewebstore.google.com/detail/legacy/{extension_id}",
    "timestamp": "2026-01-26T10:00:00",
    "status": "completed",
    "security_score": 80,
    "risk_level": "medium",
    "total_findings": 2,
    "high_risk_count": 1,
    "medium_risk_count": 1,
    "low_risk_count": 0,
    # JSON-ish fields that get mapped into formatted_results
    "metadata": {},
    "manifest": {
      "name": "Legacy Extension",
      "version": "1.0.0",
      "manifest_version": 3,
      "permissions": [],
      "host_permissions": [],
    },
    "permissions_analysis": {},
    "sast_results": {},
    "webstore_analysis": {},
    "summary": {},
    "impact_analysis": {},
    "privacy_compliance": {},
    "extracted_path": None,
    "extracted_files": [],
    # Simulate modern scoring present but missing report_view_model
    "scoring_v2": {"scoring_version": "v2", "overall_score": 80},
  }


class TestGetScanResultsUpgrade:
  """Tests for upgrading legacy payloads returned by /api/scan/results/{extension_id}."""

  def test_legacy_payload_is_upgraded_with_consumer_insights(self, client: TestClient) -> None:
    """
    Given a legacy DB row with scoring_v2 but no report_view_model,
    the API should return a payload that includes report_view_model.consumer_insights.
    """
    ext_id = "abcdefghijklmnopabcdefghijklmnop"  # 32-char extension id (valid a-p charset)

    # Ensure memory cache does not short-circuit the DB path
    scan_results.pop(ext_id, None)

    legacy_row = _make_legacy_db_row(ext_id)

    # Patch db.get_scan_result to return our legacy row
    with patch("extension_shield.api.main.db") as mock_db:
      mock_db.get_scan_result = MagicMock(return_value=legacy_row)

      response = client.get(f"/api/scan/results/{ext_id}")
      assert response.status_code == 200

      data = response.json()
      # Basic sanity checks
      assert data["extension_id"] == ext_id
      assert data["status"] == "completed"

      # Core assertion: report_view_model.consumer_insights exists
      assert "report_view_model" in data
      rvm = data["report_view_model"]
      assert isinstance(rvm, dict)
      assert "consumer_insights" in rvm
      assert isinstance(rvm["consumer_insights"], dict)


