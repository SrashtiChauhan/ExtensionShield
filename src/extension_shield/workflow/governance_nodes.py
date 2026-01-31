"""
Governance Workflow Nodes

This module contains the node functions for the governance decisioning pipeline.
These nodes integrate with the existing extension analysis workflow to produce
governance decisions (ALLOW/BLOCK/NEEDS_REVIEW).
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from langgraph.graph import END
from langgraph.types import Command

from extension_shield.governance import (
    FactsBuilder,
    SignalExtractor,
    EvidenceIndexBuilder,
    StoreListingExtractor,
    ContextBuilder,
    RulesEngine,
    ReportGenerator,
    link_evidence_to_signals,
    get_context_for_rules_engine,
)
from extension_shield.workflow.node_types import CLEANUP_NODE


logger = logging.getLogger(__name__)

# Governance node type constant
GOVERNANCE_NODE = "governance_node"


def governance_node(state: dict) -> Command:
    """
    Node that runs the governance decisioning pipeline.
    
    This node executes Stages 2-8 of the governance pipeline:
    - Stage 2: Facts Builder
    - Stage 3: Evidence Index Builder
    - Stage 4: Signal Extractor
    - Stage 5: Store Listing Extractor
    - Stage 6: Context Builder
    - Stage 7: Rules Engine
    - Stage 8: Report Generator
    
    Args:
        state: The current workflow state
        
    Returns:
        Command with governance results
    """
    logger.info("Starting governance decisioning pipeline")
    
    scan_id = state.get("workflow_id", "unknown")
    manifest_data = state.get("manifest_data", {})
    analysis_results = state.get("analysis_results", {})
    extension_metadata = state.get("extension_metadata", {})
    extracted_files = state.get("extracted_files", [])
    extension_dir = state.get("extension_dir")
    chrome_extension_path = state.get("chrome_extension_path", "")
    
    try:
        # Stage 2: Build Facts
        logger.info("Stage 2: Building facts...")
        facts_builder = FactsBuilder(scan_id=scan_id)
        facts = facts_builder.build(
            manifest_data=manifest_data or {},
            analysis_results=analysis_results or {},
            extracted_files=extracted_files or [],
            extension_id=_extract_extension_id(chrome_extension_path),
            metadata=extension_metadata,
            artifact_path=extension_dir,
        )
        facts_dict = facts.model_dump(mode="json")
        
        # Stage 3: Build Evidence Index
        logger.info("Stage 3: Building evidence index...")
        evidence_builder = EvidenceIndexBuilder()
        evidence_index = evidence_builder.build(facts)
        evidence_dict = evidence_index.model_dump(mode="json")
        
        # Stage 4: Extract Signals
        logger.info("Stage 4: Extracting signals...")
        signal_extractor = SignalExtractor()
        signals = signal_extractor.extract(facts)
        signals_dict = signals.model_dump(mode="json")
        
        # Link evidence to signals
        signals_dict = link_evidence_to_signals(evidence_index, signals_dict, facts)
        
        # Stage 5: Extract Store Listing
        logger.info("Stage 5: Extracting store listing...")
        store_extractor = StoreListingExtractor()
        
        # Determine if this is a local upload or CWS extension
        is_local = not chrome_extension_path.startswith("https://chromewebstore")
        
        if is_local:
            store_listing = store_extractor.create_local_upload_listing()
        elif extension_metadata:
            store_listing = store_extractor.extract_from_metadata(
                extension_metadata,
                store_url=chrome_extension_path
            )
        else:
            store_listing = store_extractor.extract_from_url(chrome_extension_path)
        
        store_listing_dict = store_listing.model_dump(mode="json")
        
        # Stage 6: Build Context
        logger.info("Stage 6: Building governance context...")
        context_builder = ContextBuilder()
        context = context_builder.build(facts)
        context_dict = get_context_for_rules_engine(context)
        
        # Stage 7: Run Rules Engine
        logger.info("Stage 7: Evaluating rules...")
        rulepacks_dir = Path(__file__).parent.parent / "governance" / "rulepacks"
        rulepacks = RulesEngine.load_rulepacks(str(rulepacks_dir))
        rules_engine = RulesEngine(rulepacks)
        
        rule_results = rules_engine.evaluate(
            scan_id=scan_id,
            facts=facts_dict,
            signals=signals_dict.get("signals", []),
            store_listing=store_listing_dict,
            context=context_dict,
        )
        rule_results_dict = rule_results.model_dump(mode="json")
        
        # Stage 8: Generate Report
        logger.info("Stage 8: Generating governance report...")
        report_generator = ReportGenerator()
        report = report_generator.generate(
            scan_id=scan_id,
            rule_results=rule_results,
            facts=facts,
            signals=signals,
            evidence_index=evidence_index,
            store_listing=store_listing,
            context=context,
        )
        report_dict = report.model_dump(mode="json")
        
        logger.info(
            "Governance pipeline complete: verdict=%s, rules_triggered=%d/%d",
            report.decision.verdict,
            report.rules_triggered,
            report.total_rules_evaluated,
        )
        
        # Compile governance bundle
        governance_bundle = {
            "facts": facts_dict,
            "evidence_index": evidence_dict,
            "signals": signals_dict,
            "store_listing": store_listing_dict,
            "context": context_dict,
            "rule_results": rule_results_dict,
            "report": report_dict,
            "decision": {
                "verdict": report.decision.verdict,
                "rationale": report.decision.rationale,
                "action_required": report.decision.action_required,
            },
        }
        
        return Command(
            goto=CLEANUP_NODE,
            update={
                "governance_bundle": governance_bundle,
                "governance_verdict": report.decision.verdict,
                "governance_report": report_dict,
            },
        )
        
    except Exception as exc:
        logger.exception("Governance pipeline failed: %s", exc)
        
        # Return partial results on error
        return Command(
            goto=CLEANUP_NODE,
            update={
                "governance_bundle": None,
                "governance_verdict": "ERROR",
                "governance_error": str(exc),
            },
        )


def _extract_extension_id(url: str) -> Optional[str]:
    """Extract extension ID from Chrome Web Store URL."""
    import re
    
    if not url:
        return None
    
    match = re.search(r"/detail/(?:[^/]+/)?([a-z]{32})", url)
    return match.group(1) if match else None

