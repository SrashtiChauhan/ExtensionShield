"""
Unit tests for Report Generator (Stage 8)
"""

import pytest
from datetime import datetime

from extension_shield.governance.schemas import (
    Facts,
    ManifestFacts,
    SecurityFindings,
    RuleResult,
    RuleResults,
    GovernanceReport,
    GovernanceDecision,
)
from extension_shield.governance.report_generator import (
    ReportGenerator,
    generate_governance_report,
    aggregate_verdict,
)


@pytest.fixture
def base_manifest():
    """Create a base manifest for testing."""
    return ManifestFacts(
        name="Test Extension",
        version="1.0.0",
        manifest_version=3,
        permissions=[],
        host_permissions=[],
    )


@pytest.fixture
def base_facts(base_manifest):
    """Create base facts for testing."""
    return Facts(
        scan_id="test_scan_001",
        extension_id="test_ext_001",
        manifest=base_manifest,
        host_access_patterns=[],
        security_findings=SecurityFindings(),
    )


@pytest.fixture
def generator():
    """Create a ReportGenerator instance."""
    return ReportGenerator()


def make_rule_result(
    rule_id: str,
    verdict: str,
    explanation: str = "Test explanation",
    recommended_action: str = "Test action",
    confidence: float = 0.8,
) -> RuleResult:
    """Helper to create RuleResult objects."""
    return RuleResult(
        rule_id=rule_id,
        rulepack="TEST_RULEPACK",
        verdict=verdict,
        confidence=confidence,
        evidence_refs=[],
        citations=[],
        explanation=explanation,
        recommended_action=recommended_action,
        triggered_at=datetime.utcnow(),
    )


class TestReportGeneratorDecisionAggregation:
    """Tests for decision aggregation logic."""
    
    def test_block_when_any_block_rule(self, generator):
        """Should return BLOCK if any rule says BLOCK."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "ALLOW"),
                make_rule_result("R2", "BLOCK", "Malware detected"),
                make_rule_result("R3", "NEEDS_REVIEW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.decision.verdict == "BLOCK"
        assert "R2" in report.decision.block_rules
    
    def test_needs_review_when_no_block(self, generator):
        """Should return NEEDS_REVIEW if no BLOCK but has NEEDS_REVIEW."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "ALLOW"),
                make_rule_result("R2", "NEEDS_REVIEW", "Broad permissions"),
                make_rule_result("R3", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.decision.verdict == "NEEDS_REVIEW"
        assert "R2" in report.decision.review_rules
    
    def test_allow_when_all_allow(self, generator):
        """Should return ALLOW if all rules allow."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "ALLOW"),
                make_rule_result("R2", "ALLOW"),
                make_rule_result("R3", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.decision.verdict == "ALLOW"
        assert len(report.decision.triggered_rules) == 0
    
    def test_allow_when_no_rules(self, generator):
        """Should return ALLOW if no rules evaluated."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.decision.verdict == "ALLOW"
    
    def test_multiple_block_rules(self, generator):
        """Should handle multiple BLOCK rules."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "BLOCK", "First block reason"),
                make_rule_result("R2", "BLOCK", "Second block reason"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.decision.verdict == "BLOCK"
        assert len(report.decision.block_rules) == 2
        assert "R1" in report.decision.block_rules
        assert "R2" in report.decision.block_rules


class TestReportGeneratorStatistics:
    """Tests for statistics calculation."""
    
    def test_calculates_total_rules(self, generator):
        """Should count total rules evaluated."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "ALLOW"),
                make_rule_result("R2", "BLOCK"),
                make_rule_result("R3", "NEEDS_REVIEW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.total_rules_evaluated == 3
    
    def test_calculates_triggered_count(self, generator):
        """Should count triggered rules (non-ALLOW)."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "ALLOW"),
                make_rule_result("R2", "BLOCK"),
                make_rule_result("R3", "NEEDS_REVIEW"),
                make_rule_result("R4", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.rules_triggered == 2  # BLOCK + NEEDS_REVIEW
    
    def test_calculates_block_count(self, generator):
        """Should count BLOCK rules."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "BLOCK"),
                make_rule_result("R2", "BLOCK"),
                make_rule_result("R3", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.block_count == 2
    
    def test_calculates_review_count(self, generator):
        """Should count NEEDS_REVIEW rules."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "NEEDS_REVIEW"),
                make_rule_result("R2", "NEEDS_REVIEW"),
                make_rule_result("R3", "NEEDS_REVIEW"),
                make_rule_result("R4", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.review_count == 3
    
    def test_calculates_allow_count(self, generator):
        """Should count ALLOW rules."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "ALLOW"),
                make_rule_result("R2", "ALLOW"),
                make_rule_result("R3", "BLOCK"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert report.allow_count == 2


class TestReportGeneratorRationale:
    """Tests for rationale generation."""
    
    def test_single_rule_rationale(self, generator):
        """Should use single rule explanation as rationale."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "BLOCK", "Malware signature detected"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert "Malware signature detected" in report.decision.rationale
    
    def test_multiple_rules_rationale(self, generator):
        """Should include multiple rules in rationale."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "BLOCK", "First issue"),
                make_rule_result("R2", "BLOCK", "Second issue"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert "R1" in report.decision.rationale
        assert "R2" in report.decision.rationale
    
    def test_allow_rationale(self, generator):
        """Should provide positive rationale for ALLOW."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert "passes" in report.decision.rationale.lower() or "no" in report.decision.rationale.lower()


class TestReportGeneratorMetadata:
    """Tests for report metadata."""
    
    def test_preserves_scan_id(self, generator):
        """Should preserve scan_id in report."""
        rule_results = RuleResults(scan_id="custom_scan_123", rule_results=[])
        
        report = generator.generate("custom_scan_123", rule_results)
        
        assert report.scan_id == "custom_scan_123"
    
    def test_extracts_extension_name_from_facts(self, generator, base_facts):
        """Should extract extension name from facts."""
        rule_results = RuleResults(scan_id="test_001", rule_results=[])
        
        report = generator.generate("test_001", rule_results, facts=base_facts)
        
        assert report.extension_name == "Test Extension"
    
    def test_extracts_extension_id_from_facts(self, generator, base_facts):
        """Should extract extension ID from facts."""
        rule_results = RuleResults(scan_id="test_001", rule_results=[])
        
        report = generator.generate("test_001", rule_results, facts=base_facts)
        
        assert report.extension_id == "test_ext_001"
    
    def test_sets_created_at_timestamp(self, generator):
        """Should set created_at timestamp."""
        rule_results = RuleResults(scan_id="test_001", rule_results=[])
        
        report = generator.generate("test_001", rule_results)
        
        assert report.created_at is not None
        assert isinstance(report.created_at, datetime)


class TestReportGeneratorActionRequired:
    """Tests for action_required field."""
    
    def test_uses_rule_recommended_action_for_block(self, generator):
        """Should use rule's recommended action for BLOCK."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result(
                    "R1", 
                    "BLOCK", 
                    "Malware detected",
                    recommended_action="Remove extension immediately"
                ),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert "Remove extension immediately" in report.decision.action_required
    
    def test_uses_rule_recommended_action_for_review(self, generator):
        """Should use rule's recommended action for NEEDS_REVIEW."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result(
                    "R1",
                    "NEEDS_REVIEW",
                    "Broad permissions",
                    recommended_action="Request developer justification"
                ),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        
        assert "Request developer justification" in report.decision.action_required


class TestReportGeneratorConvenience:
    """Tests for convenience functions."""
    
    def test_generate_governance_report_function(self):
        """Should work with convenience function."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[make_rule_result("R1", "ALLOW")]
        )
        
        report = generate_governance_report("test_001", rule_results)
        
        assert isinstance(report, GovernanceReport)
        assert report.decision.verdict == "ALLOW"
    
    def test_aggregate_verdict_block(self):
        """Should aggregate to BLOCK."""
        results = [
            make_rule_result("R1", "ALLOW"),
            make_rule_result("R2", "BLOCK"),
        ]
        
        verdict = aggregate_verdict(results)
        
        assert verdict == "BLOCK"
    
    def test_aggregate_verdict_review(self):
        """Should aggregate to NEEDS_REVIEW."""
        results = [
            make_rule_result("R1", "ALLOW"),
            make_rule_result("R2", "NEEDS_REVIEW"),
        ]
        
        verdict = aggregate_verdict(results)
        
        assert verdict == "NEEDS_REVIEW"
    
    def test_aggregate_verdict_allow(self):
        """Should aggregate to ALLOW."""
        results = [
            make_rule_result("R1", "ALLOW"),
            make_rule_result("R2", "ALLOW"),
        ]
        
        verdict = aggregate_verdict(results)
        
        assert verdict == "ALLOW"


class TestReportGeneratorHTMLOutput:
    """Tests for HTML report generation."""
    
    def test_generates_html_string(self, generator):
        """Should generate valid HTML string."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "BLOCK", "Critical issue"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        html = generator._render_html(report, include_evidence=False)
        
        assert "<!DOCTYPE html>" in html
        assert "BLOCK" in html
        assert "Critical issue" in html
    
    def test_html_includes_statistics(self, generator):
        """Should include statistics in HTML."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("R1", "BLOCK"),
                make_rule_result("R2", "NEEDS_REVIEW"),
                make_rule_result("R3", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results)
        html = generator._render_html(report, include_evidence=False)
        
        # Check stats are present
        assert "Rules Evaluated" in html
        assert "Block Rules" in html
        assert "Review Rules" in html


class TestReportGeneratorIntegration:
    """Integration tests."""
    
    def test_full_report_generation(self, generator, base_facts):
        """Should generate complete report with all fields."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[
                make_rule_result("ENTERPRISE_GOV_BASELINE::R1", "NEEDS_REVIEW", "Broad permissions"),
                make_rule_result("ENTERPRISE_GOV_BASELINE::R3", "BLOCK", "Undisclosed data transfer"),
                make_rule_result("CWS_LIMITED_USE::R1", "ALLOW"),
            ]
        )
        
        report = generator.generate("test_001", rule_results, facts=base_facts)
        
        # Check all fields
        assert report.scan_id == "test_001"
        assert report.extension_id == "test_ext_001"
        assert report.extension_name == "Test Extension"
        assert report.decision.verdict == "BLOCK"
        assert report.total_rules_evaluated == 3
        assert report.block_count == 1
        assert report.review_count == 1
        assert report.allow_count == 1
        assert len(report.rule_results) == 3
    
    def test_report_serialization(self, generator):
        """Should serialize report to JSON-compatible format."""
        rule_results = RuleResults(
            scan_id="test_001",
            rule_results=[make_rule_result("R1", "ALLOW")]
        )
        
        report = generator.generate("test_001", rule_results)
        report_dict = report.model_dump(mode="json")
        
        assert isinstance(report_dict, dict)
        assert "decision" in report_dict
        assert "verdict" in report_dict["decision"]

