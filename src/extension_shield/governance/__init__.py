"""
Governance Engine for Extension Analysis

This module implements the Governance Decisioning Pipeline (Stages 2-8)
that transforms security scan results into policy-based decisions.

Pipeline Stages:
    Stage 2: Facts Builder          → facts.json
    Stage 3: Evidence Index Builder → evidence_index.json
    Stage 4: Signal Extractor       → signals.json
    Stage 5: Store Listing Extractor→ store_listing.json
    Stage 6: Context Builder        → context.json
    Stage 7: Rules Engine (DSL)     → rule_results.json
    Stage 8: Decision + Report Gen  → report.json + report.html
"""

from .schemas import (
    # Stage 2: Facts
    Facts,
    ManifestFacts,
    ContentScriptFacts,
    BackgroundFacts,
    FileInventoryItem,
    SecurityFindings,
    ExtensionMetadata,
    # Stage 3: Evidence Index
    EvidenceItem,
    EvidenceIndex,
    # Stage 4: Signals
    Signal,
    Signals,
    # Stage 5: Store Listing
    ExtractionStatus,
    StoreListing,
    # Stage 6: Context
    GovernanceContext,
    Context,
    # Stage 7: Rules Engine
    RuleResult,
    RuleResults,
    # Stage 8: Report
    GovernanceDecision,
    GovernanceReport,
)
from .facts_builder import FactsBuilder
from .signal_extractor import SignalExtractor, SignalType
from .evidence_index_builder import EvidenceIndexBuilder, EvidenceSource, link_evidence_to_signals
from .store_listing_extractor import StoreListingExtractor, extract_store_listing
from .context_builder import ContextBuilder, build_governance_context, get_context_for_rules_engine
from .rules_engine import RulesEngine, ConditionEvaluator
from .report_generator import ReportGenerator, generate_governance_report, aggregate_verdict

__all__ = [
    # Stage 2
    "Facts",
    "ManifestFacts",
    "ContentScriptFacts",
    "BackgroundFacts",
    "FileInventoryItem",
    "SecurityFindings",
    "ExtensionMetadata",
    "FactsBuilder",
    # Stage 3
    "EvidenceItem",
    "EvidenceIndex",
    "EvidenceIndexBuilder",
    "EvidenceSource",
    "link_evidence_to_signals",
    # Stage 4
    "Signal",
    "Signals",
    "SignalExtractor",
    "SignalType",
    # Stage 5
    "ExtractionStatus",
    "StoreListing",
    "StoreListingExtractor",
    "extract_store_listing",
    # Stage 6
    "GovernanceContext",
    "Context",
    "ContextBuilder",
    "build_governance_context",
    "get_context_for_rules_engine",
    # Stage 7
    "RuleResult",
    "RuleResults",
    "RulesEngine",
    "ConditionEvaluator",
    # Stage 8
    "GovernanceDecision",
    "GovernanceReport",
    "ReportGenerator",
    "generate_governance_report",
    "aggregate_verdict",
]


