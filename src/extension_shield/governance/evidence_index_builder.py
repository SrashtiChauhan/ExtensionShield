"""
Evidence Index Builder - Stage 3 of Governance Pipeline

Builds an evidence index from security scan outputs with chain-of-custody.
Evidence items are referenced by signals and rules for auditability.

The Evidence Index:
- Extracts evidence from SAST findings, VirusTotal, entropy analysis
- Assigns stable evidence IDs (ev_001, ev_002, etc.)
- Includes file hashes for reproducibility
- Provides snippets for human review

Output: evidence_index.json
"""

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .schemas import (
    EvidenceItem,
    EvidenceIndex,
    Facts,
    SastFinding,
    VirusTotalFileFinding,
    EntropyFileFinding,
)


logger = logging.getLogger(__name__)


class EvidenceSource:
    """Evidence provenance/source constants."""
    SAST = "SAST"
    VIRUSTOTAL = "VirusTotal"
    ENTROPY = "Entropy"
    MANIFEST = "Manifest"
    PERMISSION = "Permission"


class EvidenceIndexBuilder:
    """
    Builds the evidence index from security scan outputs.
    
    Stage 3 of the Governance Decisioning Pipeline.
    
    Usage:
        builder = EvidenceIndexBuilder()
        evidence_index = builder.build(facts)
        evidence_dict = evidence_index.model_dump()
    """
    
    def __init__(self):
        """Initialize the Evidence Index Builder."""
        self._evidence_counter = 0
        self._file_hash_cache: Dict[str, str] = {}
    
    def build(self, facts: Facts) -> EvidenceIndex:
        """
        Build the evidence index from facts.
        
        Args:
            facts: Facts object from Stage 2
            
        Returns:
            EvidenceIndex containing all evidence items
        """
        logger.info("Building evidence index for scan_id=%s", facts.scan_id)
        
        self._evidence_counter = 0
        evidence: Dict[str, EvidenceItem] = {}
        
        # Extract evidence from all sources
        self._extract_sast_evidence(facts, evidence)
        self._extract_virustotal_evidence(facts, evidence)
        self._extract_entropy_evidence(facts, evidence)
        self._extract_permission_evidence(facts, evidence)
        self._extract_manifest_evidence(facts, evidence)
        
        logger.info("Built evidence index with %d items", len(evidence))
        
        return EvidenceIndex(scan_id=facts.scan_id, evidence=evidence)
    
    def build_from_dict(self, facts_dict: Dict[str, Any], scan_id: str) -> EvidenceIndex:
        """
        Build evidence index from a facts dictionary.
        
        Args:
            facts_dict: Facts as a dictionary
            scan_id: Scan identifier
            
        Returns:
            EvidenceIndex object
        """
        facts = Facts(**facts_dict)
        return self.build(facts)
    
    def _next_evidence_id(self) -> str:
        """Generate the next evidence ID."""
        self._evidence_counter += 1
        return f"ev_{self._evidence_counter:03d}"
    
    def _compute_content_hash(self, content: str) -> str:
        """Compute SHA256 hash of content."""
        return f"sha256:{hashlib.sha256(content.encode()).hexdigest()}"
    
    def _get_file_hash(self, facts: Facts, file_path: str) -> str:
        """
        Get file hash from facts file inventory.
        Falls back to path-based hash if not found.
        """
        # Check cache first
        if file_path in self._file_hash_cache:
            return self._file_hash_cache[file_path]
        
        # Look up in file inventory
        for item in facts.file_inventory:
            if item.path == file_path and item.sha256:
                self._file_hash_cache[file_path] = f"sha256:{item.sha256}"
                return self._file_hash_cache[file_path]
        
        # Fallback: hash the path itself (for reproducibility)
        path_hash = hashlib.sha256(file_path.encode()).hexdigest()[:16]
        fallback = f"sha256:path_{path_hash}"
        self._file_hash_cache[file_path] = fallback
        return fallback
    
    # =========================================================================
    # EVIDENCE EXTRACTION METHODS
    # =========================================================================
    
    def _extract_sast_evidence(
        self,
        facts: Facts,
        evidence: Dict[str, EvidenceItem]
    ) -> None:
        """Extract evidence from SAST findings."""
        sast_findings = facts.security_findings.sast_findings or []
        
        for finding in sast_findings:
            ev_id = self._next_evidence_id()
            
            # Build provenance string
            provenance = f"{EvidenceSource.SAST}: {finding.finding_type}"
            if finding.severity:
                provenance += f" [{finding.severity.upper()}]"
            
            evidence[ev_id] = EvidenceItem(
                evidence_id=ev_id,
                file_path=finding.file_path,
                file_hash=self._get_file_hash(facts, finding.file_path),
                line_start=finding.line_number,
                line_end=finding.line_number,  # Single line for SAST findings
                snippet=self._truncate_snippet(finding.code_snippet),
                provenance=provenance,
                version=1,
                created_at=datetime.utcnow(),
            )
        
        logger.debug("Extracted %d SAST evidence items", len(sast_findings))
    
    def _extract_virustotal_evidence(
        self,
        facts: Facts,
        evidence: Dict[str, EvidenceItem]
    ) -> None:
        """Extract evidence from VirusTotal findings."""
        vt_findings = facts.security_findings.virustotal_findings or []
        
        for finding in vt_findings:
            # Only create evidence for suspicious/malicious files
            if finding.threat_level in ["suspicious", "malicious"]:
                ev_id = self._next_evidence_id()
                
                # Build detection summary
                stats = finding.detection_stats or {}
                malicious = stats.get("malicious", 0)
                suspicious = stats.get("suspicious", 0)
                total = stats.get("total", 0)
                
                detection_str = f"{malicious}/{total} malicious"
                if suspicious > 0:
                    detection_str += f", {suspicious} suspicious"
                
                provenance = f"{EvidenceSource.VIRUSTOTAL}: {detection_str}"
                if finding.malware_families:
                    provenance += f" - Families: {', '.join(finding.malware_families[:3])}"
                
                evidence[ev_id] = EvidenceItem(
                    evidence_id=ev_id,
                    file_path=finding.file_path,
                    file_hash=f"sha256:{finding.sha256}" if finding.sha256 else self._get_file_hash(facts, finding.file_path),
                    line_start=None,
                    line_end=None,
                    snippet=None,  # VT doesn't provide code snippets
                    provenance=provenance,
                    version=1,
                    created_at=datetime.utcnow(),
                )
        
        vt_evidence_count = sum(1 for f in vt_findings if f.threat_level in ["suspicious", "malicious"])
        logger.debug("Extracted %d VirusTotal evidence items", vt_evidence_count)
    
    def _extract_entropy_evidence(
        self,
        facts: Facts,
        evidence: Dict[str, EvidenceItem]
    ) -> None:
        """Extract evidence from entropy/obfuscation findings."""
        entropy_findings = facts.security_findings.entropy_findings or []
        
        for finding in entropy_findings:
            # Only create evidence for high-risk/obfuscated files
            if finding.is_likely_obfuscated or finding.risk_level == "high":
                ev_id = self._next_evidence_id()
                
                # Build provenance with entropy values
                patterns_str = ""
                if finding.obfuscation_patterns:
                    patterns_str = f" - Patterns: {', '.join(finding.obfuscation_patterns[:3])}"
                
                provenance = (
                    f"{EvidenceSource.ENTROPY}: "
                    f"byte_entropy={finding.byte_entropy:.2f}, "
                    f"char_entropy={finding.char_entropy:.2f}"
                    f"{patterns_str}"
                )
                
                evidence[ev_id] = EvidenceItem(
                    evidence_id=ev_id,
                    file_path=finding.file_path,
                    file_hash=self._get_file_hash(facts, finding.file_path),
                    line_start=None,
                    line_end=None,
                    snippet=None,  # Entropy doesn't have specific snippets
                    provenance=provenance,
                    version=1,
                    created_at=datetime.utcnow(),
                )
        
        entropy_evidence_count = sum(
            1 for f in entropy_findings 
            if f.is_likely_obfuscated or f.risk_level == "high"
        )
        logger.debug("Extracted %d entropy evidence items", entropy_evidence_count)
    
    def _extract_permission_evidence(
        self,
        facts: Facts,
        evidence: Dict[str, EvidenceItem]
    ) -> None:
        """Extract evidence from permission analysis findings."""
        perm_findings = facts.security_findings.permission_findings or []
        
        for finding in perm_findings:
            # Only create evidence for unreasonable/dangerous permissions
            if not finding.is_reasonable:
                ev_id = self._next_evidence_id()
                
                provenance = (
                    f"{EvidenceSource.PERMISSION}: {finding.permission_name} - "
                    f"{finding.justification_reasoning}"
                )
                
                evidence[ev_id] = EvidenceItem(
                    evidence_id=ev_id,
                    file_path="manifest.json",
                    file_hash=self._get_file_hash(facts, "manifest.json"),
                    line_start=None,
                    line_end=None,
                    snippet=f'"permissions": ["{finding.permission_name}"]',
                    provenance=provenance,
                    version=1,
                    created_at=datetime.utcnow(),
                )
        
        perm_evidence_count = sum(1 for f in perm_findings if not f.is_reasonable)
        logger.debug("Extracted %d permission evidence items", perm_evidence_count)
    
    def _extract_manifest_evidence(
        self,
        facts: Facts,
        evidence: Dict[str, EvidenceItem]
    ) -> None:
        """Extract evidence from manifest for broad host patterns."""
        # Create evidence for broad host access patterns
        broad_patterns = [
            p for p in facts.host_access_patterns
            if p in ["<all_urls>", "*://*/*", "http://*/*", "https://*/*"]
        ]
        
        if broad_patterns:
            ev_id = self._next_evidence_id()
            
            provenance = (
                f"{EvidenceSource.MANIFEST}: Broad host access patterns detected"
            )
            
            evidence[ev_id] = EvidenceItem(
                evidence_id=ev_id,
                file_path="manifest.json",
                file_hash=self._get_file_hash(facts, "manifest.json"),
                line_start=None,
                line_end=None,
                snippet=f'"host_permissions": {json.dumps(broad_patterns)}',
                provenance=provenance,
                version=1,
                created_at=datetime.utcnow(),
            )
            
            logger.debug("Extracted manifest evidence for broad patterns: %s", broad_patterns)
    
    def _truncate_snippet(self, snippet: Optional[str], max_length: int = 200) -> Optional[str]:
        """Truncate snippet to max length while preserving meaning."""
        if not snippet:
            return None
        
        snippet = snippet.strip()
        if len(snippet) <= max_length:
            return snippet
        
        # Truncate with ellipsis
        return snippet[:max_length - 3] + "..."
    
    def save(self, evidence_index: EvidenceIndex, output_path: str) -> None:
        """
        Save evidence index to a JSON file.
        
        Args:
            evidence_index: The EvidenceIndex object to save
            output_path: Path to save the evidence_index.json file
        """
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(evidence_index.model_dump(mode="json"), f, indent=2, default=str)
        
        logger.info("Evidence index saved to %s", output_path)


def link_evidence_to_signals(
    evidence_index: EvidenceIndex,
    signals_dict: Dict[str, Any],
    facts: Facts,
) -> Dict[str, Any]:
    """
    Link evidence items to signals based on matching criteria.
    
    This is a post-processing step that enriches signals with evidence_refs.
    
    Args:
        evidence_index: The evidence index
        signals_dict: Signals as a dictionary (will be mutated)
        facts: The facts object
        
    Returns:
        Updated signals dictionary with evidence_refs populated
    """
    evidence_by_source: Dict[str, List[str]] = {
        EvidenceSource.SAST: [],
        EvidenceSource.VIRUSTOTAL: [],
        EvidenceSource.ENTROPY: [],
        EvidenceSource.PERMISSION: [],
        EvidenceSource.MANIFEST: [],
    }
    
    # Group evidence by source
    for ev_id, ev_item in evidence_index.evidence.items():
        for source in evidence_by_source:
            if ev_item.provenance.startswith(source):
                evidence_by_source[source].append(ev_id)
                break
    
    # Link to signals based on signal type
    for signal in signals_dict.get("signals", []):
        signal_type = signal.get("type", "")
        evidence_refs = []
        
        if signal_type == "HOST_PERMS_BROAD":
            evidence_refs = evidence_by_source[EvidenceSource.MANIFEST]
        elif signal_type == "SENSITIVE_API":
            evidence_refs = evidence_by_source[EvidenceSource.PERMISSION]
        elif signal_type == "ENDPOINT_FOUND":
            evidence_refs = evidence_by_source[EvidenceSource.SAST]
        elif signal_type == "DATAFLOW_TRACE":
            evidence_refs = evidence_by_source[EvidenceSource.SAST]
        elif signal_type == "OBFUSCATION":
            evidence_refs = evidence_by_source[EvidenceSource.ENTROPY]
        
        # Add evidence refs to signal
        signal["evidence_refs"] = evidence_refs
    
    return signals_dict

