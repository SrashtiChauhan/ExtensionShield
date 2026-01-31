"""
Tests for Governance Workflow Nodes

Verifies that the governance_node correctly integrates all governance
pipeline stages (2-8) into the LangGraph workflow.
"""

import pytest
from unittest.mock import patch, MagicMock
from langgraph.graph import END

from extension_shield.workflow.governance_nodes import governance_node, _extract_extension_id


class TestExtractExtensionId:
    """Tests for _extract_extension_id helper."""
    
    def test_valid_cws_url(self):
        """Test extraction from standard Chrome Web Store URL."""
        url = "https://chromewebstore.google.com/detail/vimium/dbepggeogbaibhgnhhndojpepiihcmeb"
        assert _extract_extension_id(url) == "dbepggeogbaibhgnhhndojpepiihcmeb"
    
    def test_valid_cws_url_without_name(self):
        """Test extraction from CWS URL without extension name."""
        url = "https://chromewebstore.google.com/detail/dbepggeogbaibhgnhhndojpepiihcmeb"
        assert _extract_extension_id(url) == "dbepggeogbaibhgnhhndojpepiihcmeb"
    
    def test_empty_url(self):
        """Test with empty URL."""
        assert _extract_extension_id("") is None
        assert _extract_extension_id(None) is None
    
    def test_local_path(self):
        """Test with local file path (returns None)."""
        assert _extract_extension_id("/path/to/extension.crx") is None
    
    def test_invalid_url(self):
        """Test with invalid URL."""
        assert _extract_extension_id("https://example.com") is None


class TestGovernanceNode:
    """Tests for the governance_node workflow function."""
    
    @pytest.fixture
    def minimal_state(self):
        """Create minimal valid workflow state."""
        return {
            "workflow_id": "test_scan_001",
            "chrome_extension_path": "https://chromewebstore.google.com/detail/test/abcdefghijklmnopqrstuvwxyzabcdef",
            "manifest_data": {
                "name": "Test Extension",
                "version": "1.0.0",
                "manifest_version": 3,
                "permissions": ["storage", "tabs"],
            },
            "analysis_results": {
                "permissions_analysis": {
                    "permissions": ["storage", "tabs"],
                    "permissions_details": {},
                },
                "javascript_analysis": {
                    "sast_findings": {},
                    "total_findings": 0,
                },
                "virustotal_analysis": {},
                "entropy_analysis": {},
            },
            "extension_metadata": {
                "title": "Test Extension",
                "description": "A test extension for testing.",
            },
            "extracted_files": ["manifest.json", "background.js"],
            "extension_dir": "/tmp/test_extension",
        }
    
    @pytest.fixture
    def empty_state(self):
        """Create empty workflow state."""
        return {
            "workflow_id": "empty_scan",
            "chrome_extension_path": "",
            "manifest_data": {},
            "analysis_results": {},
            "extension_metadata": {},
            "extracted_files": [],
            "extension_dir": None,
        }
    
    def test_governance_node_returns_command(self, minimal_state):
        """Test that governance_node returns a LangGraph Command."""
        result = governance_node(minimal_state)
        
        # Should return a Command object
        assert hasattr(result, "goto")
        assert hasattr(result, "update")
    
    def test_governance_node_routes_to_cleanup(self, minimal_state):
        """Test that governance_node routes to cleanup node."""
        result = governance_node(minimal_state)
        
        assert result.goto == "cleanup_node"
    
    def test_governance_node_produces_bundle(self, minimal_state):
        """Test that governance_node produces a governance bundle."""
        result = governance_node(minimal_state)
        
        update = result.update
        assert "governance_bundle" in update
        assert "governance_verdict" in update
        assert "governance_report" in update
    
    def test_governance_bundle_structure(self, minimal_state):
        """Test the structure of the governance bundle."""
        result = governance_node(minimal_state)
        
        bundle = result.update.get("governance_bundle")
        
        # Bundle should contain all pipeline outputs
        assert bundle is not None
        assert "facts" in bundle
        assert "evidence_index" in bundle
        assert "signals" in bundle
        assert "store_listing" in bundle
        assert "context" in bundle
        assert "rule_results" in bundle
        assert "report" in bundle
        assert "decision" in bundle
    
    def test_governance_decision_structure(self, minimal_state):
        """Test the structure of the governance decision."""
        result = governance_node(minimal_state)
        
        bundle = result.update.get("governance_bundle")
        decision = bundle.get("decision")
        
        assert decision is not None
        assert "verdict" in decision
        assert "rationale" in decision
        assert "action_required" in decision
        
        # Verdict should be one of valid values
        assert decision["verdict"] in ["ALLOW", "BLOCK", "NEEDS_REVIEW", "ERROR"]
    
    def test_governance_verdict_extracted(self, minimal_state):
        """Test that verdict is extracted to top-level update."""
        result = governance_node(minimal_state)
        
        verdict = result.update.get("governance_verdict")
        assert verdict in ["ALLOW", "BLOCK", "NEEDS_REVIEW", "ERROR"]
    
    def test_governance_report_extracted(self, minimal_state):
        """Test that report is extracted to top-level update."""
        result = governance_node(minimal_state)
        
        report = result.update.get("governance_report")
        assert report is not None
        assert "decision" in report
        assert "scan_id" in report
    
    def test_empty_state_handles_gracefully(self, empty_state):
        """Test that empty state is handled gracefully."""
        result = governance_node(empty_state)
        
        # Should still return a command
        assert hasattr(result, "goto")
        assert result.goto == "cleanup_node"
        
        # Should have governance fields in update
        update = result.update
        assert "governance_bundle" in update or "governance_error" in update
    
    def test_local_upload_detection(self):
        """Test that local uploads are detected correctly."""
        state = {
            "workflow_id": "local_scan",
            "chrome_extension_path": "/path/to/extension.crx",
            "manifest_data": {"name": "Local Extension", "version": "1.0"},
            "analysis_results": {},
            "extension_metadata": {},
            "extracted_files": [],
            "extension_dir": "/tmp/extracted",
        }
        
        result = governance_node(state)
        bundle = result.update.get("governance_bundle")
        
        if bundle:
            store_listing = bundle.get("store_listing", {})
            extraction = store_listing.get("extraction", {})
            # Local uploads should have status "skipped"
            assert extraction.get("status") == "skipped"


class TestGovernanceNodeIntegration:
    """Integration tests for governance node with real components."""
    
    @pytest.fixture
    def full_state(self):
        """Create a comprehensive workflow state."""
        return {
            "workflow_id": "integration_test_001",
            "chrome_extension_path": "https://chromewebstore.google.com/detail/test/abcdefghijklmnopqrstuvwxyzabcdef",
            "manifest_data": {
                "name": "Integration Test Extension",
                "version": "2.0.0",
                "manifest_version": 3,
                "permissions": ["storage", "tabs", "webRequest"],
                "host_permissions": ["https://*/*"],
                "background": {
                    "service_worker": "background.js"
                },
            },
            "analysis_results": {
                "permissions_analysis": {
                    "permissions": ["storage", "tabs", "webRequest"],
                    "permissions_details": {
                        "webRequest": {
                            "name": "webRequest",
                            "risk_level": "high",
                            "is_reasonable": False,
                            "reason": "Allows intercepting network requests",
                        }
                    },
                },
                "javascript_analysis": {
                    "sast_findings": {
                        "background.js": [
                            {
                                "check_id": "eval-usage",
                                "path": "background.js",
                                "start": {"line": 10},
                                "extra": {"severity": "ERROR"},
                            }
                        ]
                    },
                    "total_findings": 1,
                },
                "virustotal_analysis": {
                    "positives": 0,
                    "total": 60,
                },
                "entropy_analysis": {
                    "high_entropy_files": [],
                    "obfuscated_files": [],
                },
            },
            "extension_metadata": {
                "title": "Integration Test Extension",
                "description": "Test extension with various permissions",
                "author": "Test Developer",
            },
            "extracted_files": ["manifest.json", "background.js", "popup.html"],
            "extension_dir": "/tmp/integration_test",
        }
    
    def test_full_pipeline_execution(self, full_state):
        """Test complete pipeline execution with realistic data."""
        result = governance_node(full_state)
        
        # Verify successful execution
        assert result.goto == "cleanup_node"
        
        bundle = result.update.get("governance_bundle")
        assert bundle is not None
        
        # Verify all stages produced output
        assert bundle.get("facts") is not None
        assert bundle.get("evidence_index") is not None
        assert bundle.get("signals") is not None
        assert bundle.get("store_listing") is not None
        assert bundle.get("context") is not None
        assert bundle.get("rule_results") is not None
        assert bundle.get("report") is not None
    
    def test_signals_extracted(self, full_state):
        """Test that signals are correctly extracted."""
        result = governance_node(full_state)
        bundle = result.update.get("governance_bundle")
        
        signals = bundle.get("signals", {})
        signal_list = signals.get("signals", [])
        
        # Should have extracted some signals (broad host permissions, sensitive API)
        assert len(signal_list) > 0
    
    def test_rules_evaluated(self, full_state):
        """Test that rules are evaluated."""
        result = governance_node(full_state)
        bundle = result.update.get("governance_bundle")
        
        rule_results = bundle.get("rule_results", {})
        
        # Verify rule_results structure exists
        assert rule_results is not None
        assert "scan_id" in rule_results
        # Results list exists (key is "rule_results" in the RulesEngine output)
        assert "rule_results" in rule_results
        # Should have evaluated multiple rules
        assert len(rule_results["rule_results"]) > 0
    
    def test_report_contains_statistics(self, full_state):
        """Test that report contains summary statistics."""
        result = governance_node(full_state)
        
        report = result.update.get("governance_report")
        assert report is not None
        
        assert "rules_triggered" in report
        assert "total_rules_evaluated" in report


class TestGovernanceNodeErrorHandling:
    """Tests for error handling in governance node."""
    
    def test_malformed_manifest_handled(self):
        """Test handling of malformed manifest data."""
        state = {
            "workflow_id": "malformed_test",
            "chrome_extension_path": "https://chromewebstore.google.com/detail/test/abcdefghijklmnopqrstuvwxyzabcdef",
            "manifest_data": "not a dictionary",  # Invalid
            "analysis_results": {},
            "extension_metadata": {},
            "extracted_files": [],
            "extension_dir": None,
        }
        
        result = governance_node(state)
        
        # Should still produce a command (error handling)
        assert hasattr(result, "goto")
        assert result.goto == "cleanup_node"
    
    def test_none_values_handled(self):
        """Test handling of None values in state."""
        state = {
            "workflow_id": "none_test",
            "chrome_extension_path": None,
            "manifest_data": None,
            "analysis_results": None,
            "extension_metadata": None,
            "extracted_files": None,
            "extension_dir": None,
        }
        
        result = governance_node(state)
        
        # Should handle gracefully
        assert hasattr(result, "goto")
        assert result.goto == "cleanup_node"

