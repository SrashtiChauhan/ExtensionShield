"""
Signal Extractor - Stage 4 of Governance Pipeline

Extracts governance signals from facts and security findings.
Signals are high-level risk indicators used by the Rules Engine.

MVP Signal Types:
- HOST_PERMS_BROAD: Extension requests broad host permissions (<all_urls>, *://*/*)
- SENSITIVE_API: Extension uses sensitive Chrome APIs (webRequest, proxy, debugger)
- ENDPOINT_FOUND: External endpoint/URL detected in code
- DATAFLOW_TRACE: Potential data exfiltration pattern detected
- OBFUSCATION: Code obfuscation or packing detected

Output: signals.json
"""

import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import uuid4

from .schemas import Signal, Signals, Facts


logger = logging.getLogger(__name__)


# =============================================================================
# SIGNAL TYPE DEFINITIONS
# =============================================================================

class SignalType:
    """Signal type constants."""
    HOST_PERMS_BROAD = "HOST_PERMS_BROAD"
    SENSITIVE_API = "SENSITIVE_API"
    ENDPOINT_FOUND = "ENDPOINT_FOUND"
    DATAFLOW_TRACE = "DATAFLOW_TRACE"
    OBFUSCATION = "OBFUSCATION"


# Sensitive Chrome APIs that warrant review
SENSITIVE_APIS = [
    "webRequest",
    "webRequestBlocking",
    "proxy",
    "debugger",
    "nativeMessaging",
    "enterprise.platformKeys",
    "vpnProvider",
    "networking.config",
    "declarativeNetRequest",
    "desktopCapture",
    "tabCapture",
]

# Broad host permission patterns
BROAD_HOST_PATTERNS = [
    "<all_urls>",
    "*://*/*",
    "http://*/*",
    "https://*/*",
    "*://*",
]


class SignalExtractor:
    """
    Extracts governance signals from facts.
    
    Stage 4 of the Governance Decisioning Pipeline.
    
    Usage:
        extractor = SignalExtractor()
        signals = extractor.extract(facts)
        signals_dict = signals.model_dump()
    """
    
    def __init__(self):
        """Initialize the Signal Extractor."""
        self._signal_counter = 0
    
    def extract(self, facts: Facts) -> Signals:
        """
        Extract all signals from facts.
        
        Args:
            facts: Facts object from Stage 2
            
        Returns:
            Signals object containing all extracted signals
        """
        logger.info("Extracting signals for scan_id=%s", facts.scan_id)
        
        self._signal_counter = 0
        signals_list: List[Signal] = []
        
        # Extract each signal type
        signals_list.extend(self._extract_host_perms_broad(facts))
        signals_list.extend(self._extract_sensitive_api(facts))
        signals_list.extend(self._extract_endpoint_found(facts))
        signals_list.extend(self._extract_dataflow_trace(facts))
        signals_list.extend(self._extract_obfuscation(facts))
        
        logger.info(
            "Extracted %d signals: %s",
            len(signals_list),
            [s.type for s in signals_list]
        )
        
        return Signals(scan_id=facts.scan_id, signals=signals_list)
    
    def extract_from_dict(self, facts_dict: Dict[str, Any], scan_id: str) -> Signals:
        """
        Extract signals from a facts dictionary.
        
        Args:
            facts_dict: Facts as a dictionary
            scan_id: Scan identifier
            
        Returns:
            Signals object
        """
        facts = Facts(**facts_dict)
        return self.extract(facts)
    
    def _next_signal_id(self) -> str:
        """Generate the next signal ID."""
        self._signal_counter += 1
        return f"sig_{self._signal_counter:03d}"
    
    # =========================================================================
    # SIGNAL EXTRACTION METHODS
    # =========================================================================
    
    def _extract_host_perms_broad(self, facts: Facts) -> List[Signal]:
        """
        Extract HOST_PERMS_BROAD signals.
        
        Triggers when extension requests broad host permissions that grant
        access to all or most websites.
        """
        signals = []
        
        broad_patterns_found = []
        for pattern in facts.host_access_patterns:
            if pattern in BROAD_HOST_PATTERNS:
                broad_patterns_found.append(pattern)
        
        if broad_patterns_found:
            signals.append(Signal(
                signal_id=self._next_signal_id(),
                type=SignalType.HOST_PERMS_BROAD,
                confidence=0.95,
                evidence_refs=[],  # Will be populated by evidence builder
                description=f"Broad host permissions detected: {', '.join(broad_patterns_found)}",
                severity="high",
            ))
            logger.debug("HOST_PERMS_BROAD signal: %s", broad_patterns_found)
        
        return signals
    
    def _extract_sensitive_api(self, facts: Facts) -> List[Signal]:
        """
        Extract SENSITIVE_API signals.
        
        Triggers when extension uses sensitive Chrome APIs that require
        heightened security review.
        """
        signals = []
        
        # Check manifest permissions
        permissions = facts.manifest.permissions or []
        sensitive_found = []
        
        for perm in permissions:
            if perm in SENSITIVE_APIS:
                sensitive_found.append(perm)
        
        # Check optional permissions too
        optional_perms = facts.manifest.optional_permissions or []
        for perm in optional_perms:
            if perm in SENSITIVE_APIS and perm not in sensitive_found:
                sensitive_found.append(f"{perm} (optional)")
        
        if sensitive_found:
            severity = "critical" if any(p in ["debugger", "proxy", "vpnProvider"] for p in sensitive_found) else "high"
            
            signals.append(Signal(
                signal_id=self._next_signal_id(),
                type=SignalType.SENSITIVE_API,
                confidence=0.90,
                evidence_refs=[],
                description=f"Sensitive APIs detected: {', '.join(sensitive_found)}",
                severity=severity,
            ))
            logger.debug("SENSITIVE_API signal: %s", sensitive_found)
        
        return signals
    
    def _extract_endpoint_found(self, facts: Facts) -> List[Signal]:
        """
        Extract ENDPOINT_FOUND signals.
        
        Triggers when external URLs/endpoints are detected in the code
        (typically from SAST findings).
        """
        signals = []
        
        # Check SAST findings for external endpoints
        sast_findings = facts.security_findings.sast_findings or []
        endpoint_findings = []
        
        for finding in sast_findings:
            # Look for findings that indicate external communication
            finding_type = finding.finding_type.lower()
            description = finding.description.lower()
            
            if any(indicator in finding_type or indicator in description for indicator in [
                "endpoint", "fetch", "xhr", "ajax", "http", "api",
                "external", "remote", "url", "network"
            ]):
                endpoint_findings.append(finding)
        
        if endpoint_findings:
            # Deduplicate by file path
            unique_files = set(f.file_path for f in endpoint_findings)
            
            signals.append(Signal(
                signal_id=self._next_signal_id(),
                type=SignalType.ENDPOINT_FOUND,
                confidence=0.85,
                evidence_refs=[],
                description=f"External endpoints detected in {len(unique_files)} file(s): {', '.join(list(unique_files)[:3])}{'...' if len(unique_files) > 3 else ''}",
                severity="medium",
            ))
            logger.debug("ENDPOINT_FOUND signal: %d findings", len(endpoint_findings))
        
        return signals
    
    def _extract_dataflow_trace(self, facts: Facts) -> List[Signal]:
        """
        Extract DATAFLOW_TRACE signals.
        
        Triggers when potential data exfiltration patterns are detected:
        - Data collection + external transfer
        - Sensitive data access + network calls
        """
        signals = []
        
        # Check SAST findings for data exfiltration patterns
        sast_findings = facts.security_findings.sast_findings or []
        dataflow_findings = []
        
        for finding in sast_findings:
            finding_type = finding.finding_type.lower()
            description = finding.description.lower()
            
            # Look for data exfiltration indicators
            if any(indicator in finding_type or indicator in description for indicator in [
                "exfil", "dataflow", "data-flow", "leak", "steal",
                "send", "transmit", "upload", "transfer", "harvest"
            ]):
                dataflow_findings.append(finding)
        
        # Also trigger if we have both storage access AND external endpoints
        has_storage = "storage" in (facts.manifest.permissions or [])
        has_endpoints = any(f.finding_type.lower() in ["endpoint", "fetch", "network"] 
                          for f in sast_findings)
        
        if dataflow_findings:
            signals.append(Signal(
                signal_id=self._next_signal_id(),
                type=SignalType.DATAFLOW_TRACE,
                confidence=0.85,
                evidence_refs=[],
                description=f"Data exfiltration pattern detected in {len(dataflow_findings)} finding(s)",
                severity="high",
            ))
            logger.debug("DATAFLOW_TRACE signal from SAST: %d findings", len(dataflow_findings))
        elif has_storage and has_endpoints:
            signals.append(Signal(
                signal_id=self._next_signal_id(),
                type=SignalType.DATAFLOW_TRACE,
                confidence=0.70,
                evidence_refs=[],
                description="Storage permission combined with external endpoint access",
                severity="medium",
            ))
            logger.debug("DATAFLOW_TRACE signal from permissions+endpoints")
        
        return signals
    
    def _extract_obfuscation(self, facts: Facts) -> List[Signal]:
        """
        Extract OBFUSCATION signals.
        
        Triggers when code obfuscation or packing is detected:
        - High entropy files
        - Known obfuscation patterns
        - Packed/minified code that hides functionality
        """
        signals = []
        
        security = facts.security_findings
        
        # Check entropy-based obfuscation detection
        if security.obfuscation_detected:
            # Get high-risk entropy files
            high_entropy_files = [
                f for f in security.entropy_findings
                if f.is_likely_obfuscated or f.risk_level == "high"
            ]
            
            file_names = [f.file_name for f in high_entropy_files[:5]]
            
            signals.append(Signal(
                signal_id=self._next_signal_id(),
                type=SignalType.OBFUSCATION,
                confidence=0.80,
                evidence_refs=[],
                description=f"Code obfuscation detected in {len(high_entropy_files)} file(s): {', '.join(file_names)}{'...' if len(high_entropy_files) > 5 else ''}",
                severity="medium",
            ))
            logger.debug("OBFUSCATION signal: %d files", len(high_entropy_files))
        
        # Check entropy risk level even if obfuscation flag is not set
        elif security.entropy_risk_level == "high":
            signals.append(Signal(
                signal_id=self._next_signal_id(),
                type=SignalType.OBFUSCATION,
                confidence=0.70,
                evidence_refs=[],
                description="High entropy detected, possible code obfuscation",
                severity="medium",
            ))
            logger.debug("OBFUSCATION signal from entropy risk level")
        
        return signals
    
    def save(self, signals: Signals, output_path: str) -> None:
        """
        Save signals to a JSON file.
        
        Args:
            signals: The Signals object to save
            output_path: Path to save the signals.json file
        """
        import json
        from pathlib import Path
        
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(signals.model_dump(mode="json"), f, indent=2, default=str)
        
        logger.info("Signals saved to %s", output_path)

