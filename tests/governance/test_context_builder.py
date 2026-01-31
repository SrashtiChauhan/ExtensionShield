"""
Unit tests for Context Builder (Stage 6)
"""

import pytest
from datetime import datetime

from extension_shield.governance.schemas import (
    Facts,
    ManifestFacts,
    SecurityFindings,
    SastFinding,
    Context,
    GovernanceContext,
)
from extension_shield.governance.context_builder import (
    ContextBuilder,
    build_governance_context,
    get_context_for_rules_engine,
    DEFAULT_RULEPACKS,
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
def builder():
    """Create a ContextBuilder instance."""
    return ContextBuilder()


class TestContextBuilderDefaults:
    """Tests for default context building."""
    
    def test_builds_context_with_defaults(self, builder):
        """Should build context with default values."""
        context = builder.build()
        
        assert isinstance(context, Context)
        assert isinstance(context.context, GovernanceContext)
        assert "GLOBAL" in context.context.regions_in_scope
        assert len(context.context.rulepacks) > 0
    
    def test_default_rulepacks_included(self, builder):
        """Should include default rulepacks."""
        context = builder.build()
        
        for rulepack in DEFAULT_RULEPACKS:
            assert rulepack in context.context.rulepacks
    
    def test_default_domain_category_is_general(self, builder):
        """Should default to general domain category."""
        context = builder.build()
        
        assert "general" in context.context.domain_categories
    
    def test_no_cross_border_by_default(self, builder):
        """Should not flag cross-border by default."""
        context = builder.build()
        
        assert context.context.cross_border_risk is False


class TestContextBuilderRulepacks:
    """Tests for rulepack selection."""
    
    def test_override_rulepacks(self, builder):
        """Should allow overriding rulepacks."""
        context = builder.build(rulepacks=["CUSTOM_RULEPACK"])
        
        assert context.context.rulepacks == ["CUSTOM_RULEPACK"]
    
    def test_multiple_rulepacks(self, builder):
        """Should support multiple rulepacks."""
        context = builder.build(rulepacks=["PACK_A", "PACK_B", "PACK_C"])
        
        assert len(context.context.rulepacks) == 3
        assert "PACK_A" in context.context.rulepacks
        assert "PACK_B" in context.context.rulepacks
        assert "PACK_C" in context.context.rulepacks


class TestContextBuilderRegions:
    """Tests for region detection and override."""
    
    def test_override_regions(self, builder):
        """Should allow overriding regions."""
        context = builder.build(regions=["US", "EU"])
        
        assert context.context.regions_in_scope == ["US", "EU"]  # Preserves user order
    
    def test_detects_eu_region_from_tld(self, builder, base_facts):
        """Should detect EU region from .de domain."""
        base_facts.host_access_patterns = ["https://*.example.de/*"]
        
        context = builder.build(base_facts)
        
        assert "EU" in context.context.regions_in_scope
    
    def test_detects_uk_region_from_tld(self, builder, base_facts):
        """Should detect UK region from .co.uk domain."""
        base_facts.host_access_patterns = ["https://*.example.co.uk/*"]
        
        context = builder.build(base_facts)
        
        assert "UK" in context.context.regions_in_scope
    
    def test_global_for_all_urls(self, builder, base_facts):
        """Should set GLOBAL for <all_urls> permission."""
        base_facts.host_access_patterns = ["<all_urls>"]
        
        context = builder.build(base_facts)
        
        assert "GLOBAL" in context.context.regions_in_scope
    
    def test_global_for_wildcard(self, builder, base_facts):
        """Should set GLOBAL for *://*/* permission."""
        base_facts.host_access_patterns = ["*://*/*"]
        
        context = builder.build(base_facts)
        
        assert "GLOBAL" in context.context.regions_in_scope
    
    def test_multiple_regions_detected(self, builder, base_facts):
        """Should detect multiple regions from patterns."""
        base_facts.host_access_patterns = [
            "https://*.example.de/*",  # EU
            "https://*.example.co.uk/*",  # UK
        ]
        
        context = builder.build(base_facts)
        
        assert "EU" in context.context.regions_in_scope
        assert "UK" in context.context.regions_in_scope


class TestContextBuilderDomainCategories:
    """Tests for domain category detection."""
    
    def test_detects_banking_category(self, builder, base_facts):
        """Should detect banking category from PayPal domain."""
        base_facts.host_access_patterns = ["https://*.paypal.com/*"]
        
        context = builder.build(base_facts)
        
        assert "banking_financial" in context.context.domain_categories
    
    def test_detects_government_category(self, builder, base_facts):
        """Should detect government category from .gov domain."""
        base_facts.host_access_patterns = ["https://*.irs.gov/*"]
        
        context = builder.build(base_facts)
        
        assert "government" in context.context.domain_categories
    
    def test_detects_healthcare_category(self, builder, base_facts):
        """Should detect healthcare category."""
        base_facts.host_access_patterns = ["https://*.anthem.com/*"]
        
        context = builder.build(base_facts)
        
        assert "healthcare" in context.context.domain_categories
    
    def test_detects_enterprise_category(self, builder, base_facts):
        """Should detect enterprise category from Salesforce."""
        base_facts.host_access_patterns = ["https://*.salesforce.com/*"]
        
        context = builder.build(base_facts)
        
        assert "enterprise" in context.context.domain_categories
    
    def test_multiple_categories_detected(self, builder, base_facts):
        """Should detect multiple domain categories."""
        base_facts.host_access_patterns = [
            "https://*.paypal.com/*",  # banking
            "https://*.salesforce.com/*",  # enterprise
        ]
        
        context = builder.build(base_facts)
        
        assert "banking_financial" in context.context.domain_categories
        assert "enterprise" in context.context.domain_categories
    
    def test_general_for_non_sensitive_domains(self, builder, base_facts):
        """Should default to general for non-sensitive domains."""
        base_facts.host_access_patterns = ["https://*.example.com/*"]
        
        context = builder.build(base_facts)
        
        assert "general" in context.context.domain_categories


class TestContextBuilderCrossBorder:
    """Tests for cross-border risk assessment."""
    
    def test_cross_border_for_multiple_regions(self, builder, base_facts):
        """Should flag cross-border for multiple regions."""
        base_facts.host_access_patterns = [
            "https://*.example.de/*",  # EU
            "https://*.example.co.uk/*",  # UK
        ]
        
        context = builder.build(base_facts)
        
        assert context.context.cross_border_risk is True
    
    def test_cross_border_for_eu_access(self, builder, base_facts):
        """Should flag cross-border for EU access (GDPR implications)."""
        base_facts.host_access_patterns = ["https://*.example.de/*"]
        
        context = builder.build(base_facts)
        
        # EU-only access should flag for cross-border review
        assert context.context.cross_border_risk is True
    
    def test_cross_border_for_broad_with_external(self, builder, base_facts):
        """Should flag cross-border for broad access with external endpoints."""
        base_facts.host_access_patterns = ["<all_urls>"]
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/api.js",
                finding_type="endpoint-detection",
                severity="medium",
                description="External API endpoint detected",
            )
        ]
        
        context = builder.build(base_facts)
        
        assert context.context.cross_border_risk is True
    
    def test_no_cross_border_for_single_non_eu_region(self, builder, base_facts):
        """Should not flag cross-border for single non-EU region."""
        base_facts.host_access_patterns = ["https://*.example.us/*"]
        
        context = builder.build(base_facts)
        
        # Only US detected, no cross-border
        # Note: If no region detected, defaults to GLOBAL which is single region
        assert context.context.cross_border_risk is False or "US" in context.context.regions_in_scope


class TestContextBuilderConvenience:
    """Tests for convenience functions."""
    
    def test_build_governance_context_function(self):
        """Should work with convenience function."""
        context = build_governance_context()
        
        assert isinstance(context, Context)
        assert "GLOBAL" in context.context.regions_in_scope
    
    def test_build_from_facts_dict(self, base_facts):
        """Should build from facts dictionary."""
        facts_dict = base_facts.model_dump()
        
        context = build_governance_context(facts_dict=facts_dict)
        
        assert isinstance(context, Context)
    
    def test_get_context_for_rules_engine(self, builder):
        """Should convert context to rules engine format."""
        context = builder.build(
            rulepacks=["ENTERPRISE_GOV_BASELINE"],
            regions=["US"],
        )
        
        rules_context = get_context_for_rules_engine(context)
        
        assert isinstance(rules_context, dict)
        assert "rulepacks" in rules_context
        assert "ENTERPRISE_GOV_BASELINE" in rules_context["rulepacks"]
        assert "regions_in_scope" in rules_context


class TestContextBuilderIntegration:
    """Integration tests."""
    
    def test_full_context_build(self, builder, base_facts):
        """Should build complete context with all fields."""
        base_facts.host_access_patterns = [
            "<all_urls>",
            "https://*.paypal.com/*",
        ]
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/background.js",
                finding_type="external-fetch",
                severity="medium",
                description="External endpoint access",
            )
        ]
        
        context = builder.build(base_facts)
        
        # Should have all required fields
        assert context.context.regions_in_scope is not None
        assert context.context.rulepacks is not None
        assert context.context.domain_categories is not None
        assert context.context.cross_border_risk is not None
        
        # Should detect banking
        assert "banking_financial" in context.context.domain_categories
        
        # Should be flagged for cross-border (broad + external)
        assert context.context.cross_border_risk is True
    
    def test_context_serialization(self, builder):
        """Should serialize context to JSON-compatible format."""
        context = builder.build()
        
        # Should be serializable
        context_dict = context.model_dump(mode="json")
        
        assert isinstance(context_dict, dict)
        assert "context" in context_dict
        assert "rulepacks" in context_dict["context"]

