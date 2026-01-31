"""
Unit tests for Signal Extractor (Stage 4)
"""

import pytest
from datetime import datetime

from extension_shield.governance.schemas import (
    Facts,
    ManifestFacts,
    SecurityFindings,
    SastFinding,
    EntropyFileFinding,
)
from extension_shield.governance.signal_extractor import (
    SignalExtractor,
    SignalType,
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


class TestSignalExtractorHostPermsBroad:
    """Tests for HOST_PERMS_BROAD signal extraction."""
    
    def test_detects_all_urls(self, base_facts):
        """Should detect <all_urls> as broad permission."""
        base_facts.host_access_patterns = ["<all_urls>"]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        assert len(signals.signals) == 1
        assert signals.signals[0].type == SignalType.HOST_PERMS_BROAD
        assert "<all_urls>" in signals.signals[0].description
    
    def test_detects_wildcard_pattern(self, base_facts):
        """Should detect *://*/* as broad permission."""
        base_facts.host_access_patterns = ["*://*/*"]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        assert len(signals.signals) == 1
        assert signals.signals[0].type == SignalType.HOST_PERMS_BROAD
    
    def test_no_signal_for_specific_domain(self, base_facts):
        """Should not trigger for specific domain permissions."""
        base_facts.host_access_patterns = ["https://example.com/*"]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        # No HOST_PERMS_BROAD signal expected
        broad_signals = [s for s in signals.signals if s.type == SignalType.HOST_PERMS_BROAD]
        assert len(broad_signals) == 0


class TestSignalExtractorSensitiveApi:
    """Tests for SENSITIVE_API signal extraction."""
    
    def test_detects_webrequest(self, base_facts):
        """Should detect webRequest as sensitive API."""
        base_facts.manifest.permissions = ["webRequest", "storage"]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        sensitive_signals = [s for s in signals.signals if s.type == SignalType.SENSITIVE_API]
        assert len(sensitive_signals) == 1
        assert "webRequest" in sensitive_signals[0].description
    
    def test_detects_debugger(self, base_facts):
        """Should detect debugger as critical sensitive API."""
        base_facts.manifest.permissions = ["debugger"]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        sensitive_signals = [s for s in signals.signals if s.type == SignalType.SENSITIVE_API]
        assert len(sensitive_signals) == 1
        assert sensitive_signals[0].severity == "critical"
    
    def test_no_signal_for_normal_permissions(self, base_facts):
        """Should not trigger for normal permissions."""
        base_facts.manifest.permissions = ["storage", "tabs", "activeTab"]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        sensitive_signals = [s for s in signals.signals if s.type == SignalType.SENSITIVE_API]
        assert len(sensitive_signals) == 0


class TestSignalExtractorObfuscation:
    """Tests for OBFUSCATION signal extraction."""
    
    def test_detects_obfuscation_flag(self, base_facts):
        """Should detect when obfuscation_detected is True."""
        base_facts.security_findings.obfuscation_detected = True
        base_facts.security_findings.entropy_findings = [
            EntropyFileFinding(
                file_name="packed.js",
                file_path="src/packed.js",
                byte_entropy=7.8,
                char_entropy=7.5,
                risk_level="high",
                is_likely_obfuscated=True,
            )
        ]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        obf_signals = [s for s in signals.signals if s.type == SignalType.OBFUSCATION]
        assert len(obf_signals) == 1
        assert "packed.js" in obf_signals[0].description
    
    def test_detects_high_entropy_risk(self, base_facts):
        """Should detect high entropy risk level."""
        base_facts.security_findings.entropy_risk_level = "high"
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        obf_signals = [s for s in signals.signals if s.type == SignalType.OBFUSCATION]
        assert len(obf_signals) == 1


class TestSignalExtractorDataflow:
    """Tests for DATAFLOW_TRACE signal extraction."""
    
    def test_detects_exfil_sast_finding(self, base_facts):
        """Should detect exfiltration SAST findings."""
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/background.js",
                finding_type="data-exfil",
                severity="high",
                description="Potential data exfiltration to external endpoint",
            )
        ]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        dataflow_signals = [s for s in signals.signals if s.type == SignalType.DATAFLOW_TRACE]
        assert len(dataflow_signals) == 1


class TestSignalExtractorEndpoints:
    """Tests for ENDPOINT_FOUND signal extraction."""
    
    def test_detects_fetch_finding(self, base_facts):
        """Should detect fetch/network SAST findings."""
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/api.js",
                finding_type="fetch-external",
                severity="medium",
                description="Fetch call to external API endpoint",
            )
        ]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        endpoint_signals = [s for s in signals.signals if s.type == SignalType.ENDPOINT_FOUND]
        assert len(endpoint_signals) == 1


class TestSignalExtractorIntegration:
    """Integration tests for Signal Extractor."""
    
    def test_multiple_signals_detected(self, base_facts):
        """Should detect multiple signal types from complex facts."""
        base_facts.host_access_patterns = ["<all_urls>"]
        base_facts.manifest.permissions = ["webRequest", "storage"]
        base_facts.security_findings.obfuscation_detected = True
        base_facts.security_findings.entropy_findings = [
            EntropyFileFinding(
                file_name="code.js",
                file_path="src/code.js",
                byte_entropy=7.9,
                char_entropy=7.6,
                risk_level="high",
                is_likely_obfuscated=True,
            )
        ]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        signal_types = [s.type for s in signals.signals]
        assert SignalType.HOST_PERMS_BROAD in signal_types
        assert SignalType.SENSITIVE_API in signal_types
        assert SignalType.OBFUSCATION in signal_types
    
    def test_signal_ids_are_unique(self, base_facts):
        """Should generate unique signal IDs."""
        base_facts.host_access_patterns = ["<all_urls>"]
        base_facts.manifest.permissions = ["webRequest"]
        
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        signal_ids = [s.signal_id for s in signals.signals]
        assert len(signal_ids) == len(set(signal_ids))  # All unique
    
    def test_scan_id_preserved(self, base_facts):
        """Should preserve scan_id in output."""
        extractor = SignalExtractor()
        signals = extractor.extract(base_facts)
        
        assert signals.scan_id == "test_scan_001"

