"""
Report Generator - Stage 8 of Governance Pipeline

Aggregates rule evaluation results and generates the final governance report.
This is the terminal stage that produces the decision and audit artifacts.

Decision Aggregation Logic:
- If ANY rule verdict = BLOCK → overall BLOCK
- Else if ANY verdict = NEEDS_REVIEW → overall NEEDS_REVIEW
- Else → ALLOW

Output: report.json (and optionally report.html)
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .schemas import (
    GovernanceReport,
    GovernanceDecision,
    RuleResult,
    RuleResults,
    Facts,
    Signals,
    EvidenceIndex,
    StoreListing,
    Context,
)


logger = logging.getLogger(__name__)


class ReportGenerator:
    """
    Generates the final governance report from all pipeline outputs.
    
    Stage 8 of the Governance Decisioning Pipeline.
    
    Usage:
        generator = ReportGenerator()
        report = generator.generate(
            scan_id="scan_123",
            rule_results=rule_results,
            facts=facts,
            signals=signals,
            evidence_index=evidence_index,
            store_listing=store_listing,
            context=context,
        )
    """
    
    def __init__(self):
        """Initialize the Report Generator."""
        pass
    
    def generate(
        self,
        scan_id: str,
        rule_results: RuleResults,
        facts: Optional[Facts] = None,
        signals: Optional[Signals] = None,
        evidence_index: Optional[EvidenceIndex] = None,
        store_listing: Optional[StoreListing] = None,
        context: Optional[Context] = None,
    ) -> GovernanceReport:
        """
        Generate the governance report from pipeline outputs.
        
        Args:
            scan_id: Unique scan identifier
            rule_results: Results from rules engine (Stage 7)
            facts: Facts from Stage 2 (optional, for metadata)
            signals: Signals from Stage 4 (optional, for summary)
            evidence_index: Evidence from Stage 3 (optional, for audit)
            store_listing: Store listing from Stage 5 (optional)
            context: Governance context from Stage 6 (optional)
            
        Returns:
            GovernanceReport with decision and all audit data
        """
        logger.info("Generating governance report for scan_id=%s", scan_id)
        
        # Aggregate decision from rule results
        decision = self._aggregate_decision(rule_results.rule_results)
        
        # Calculate summary statistics
        stats = self._calculate_statistics(rule_results.rule_results)
        
        # Extract extension metadata
        extension_id = None
        extension_name = None
        if facts:
            extension_id = facts.extension_id
            extension_name = facts.manifest.name if facts.manifest else None
        
        report = GovernanceReport(
            scan_id=scan_id,
            extension_id=extension_id,
            extension_name=extension_name,
            created_at=datetime.utcnow(),
            decision=decision,
            rule_results=rule_results.rule_results,
            total_rules_evaluated=stats["total"],
            rules_triggered=stats["triggered"],
            block_count=stats["block"],
            review_count=stats["review"],
            allow_count=stats["allow"],
        )
        
        logger.info(
            "Report generated: verdict=%s, triggered=%d/%d rules",
            decision.verdict,
            stats["triggered"],
            stats["total"],
        )
        
        return report
    
    def generate_from_dicts(
        self,
        scan_id: str,
        rule_results_dict: Dict[str, Any],
        facts_dict: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> GovernanceReport:
        """
        Generate report from dictionary inputs.
        
        Args:
            scan_id: Unique scan identifier
            rule_results_dict: Rule results as dictionary
            facts_dict: Facts as dictionary (optional)
            **kwargs: Additional arguments
            
        Returns:
            GovernanceReport
        """
        rule_results = RuleResults(**rule_results_dict)
        facts = Facts(**facts_dict) if facts_dict else None
        
        return self.generate(
            scan_id=scan_id,
            rule_results=rule_results,
            facts=facts,
            **kwargs
        )
    
    def _aggregate_decision(self, rule_results: List[RuleResult]) -> GovernanceDecision:
        """
        Aggregate rule verdicts into a single decision.
        
        Decision Logic:
        - If ANY rule says BLOCK → BLOCK
        - Else if ANY rule says NEEDS_REVIEW → NEEDS_REVIEW
        - Else → ALLOW
        
        Args:
            rule_results: List of rule evaluation results
            
        Returns:
            GovernanceDecision with aggregated verdict
        """
        block_rules = [r for r in rule_results if r.verdict == "BLOCK"]
        review_rules = [r for r in rule_results if r.verdict == "NEEDS_REVIEW"]
        triggered_rules = [r for r in rule_results if r.verdict != "ALLOW"]
        
        # Collect rule IDs
        triggered_ids = [r.rule_id for r in triggered_rules]
        block_ids = [r.rule_id for r in block_rules]
        review_ids = [r.rule_id for r in review_rules]
        
        if block_rules:
            # BLOCK - use first block rule for rationale
            top_rule = block_rules[0]
            return GovernanceDecision(
                verdict="BLOCK",
                rationale=self._build_rationale(block_rules),
                action_required=top_rule.recommended_action or "Block installation org-wide",
                triggered_rules=triggered_ids,
                block_rules=block_ids,
                review_rules=review_ids,
            )
        
        if review_rules:
            # NEEDS_REVIEW - use first review rule for rationale
            top_rule = review_rules[0]
            return GovernanceDecision(
                verdict="NEEDS_REVIEW",
                rationale=self._build_rationale(review_rules),
                action_required=top_rule.recommended_action or "Manual security review required",
                triggered_rules=triggered_ids,
                block_rules=block_ids,
                review_rules=review_ids,
            )
        
        # ALLOW - no concerning rules triggered
        return GovernanceDecision(
            verdict="ALLOW",
            rationale="No governance rules triggered. Extension passes policy checks.",
            action_required="Extension can be allowed for installation.",
            triggered_rules=[],
            block_rules=[],
            review_rules=[],
        )
    
    def _build_rationale(self, rules: List[RuleResult]) -> str:
        """
        Build rationale from triggered rules.
        
        Args:
            rules: List of triggered rules
            
        Returns:
            Human-readable rationale string
        """
        if not rules:
            return "No rules triggered."
        
        if len(rules) == 1:
            rule = rules[0]
            return f"{rule.explanation}"
        
        # Multiple rules - summarize
        rationale_parts = []
        for i, rule in enumerate(rules[:3], 1):  # Top 3 rules
            rationale_parts.append(f"{i}. [{rule.rule_id}] {rule.explanation}")
        
        if len(rules) > 3:
            rationale_parts.append(f"... and {len(rules) - 3} more rule(s) triggered.")
        
        return "\n".join(rationale_parts)
    
    def _calculate_statistics(self, rule_results: List[RuleResult]) -> Dict[str, int]:
        """
        Calculate summary statistics from rule results.
        
        Args:
            rule_results: List of rule evaluation results
            
        Returns:
            Dict with total, triggered, block, review, allow counts
        """
        total = len(rule_results)
        block = sum(1 for r in rule_results if r.verdict == "BLOCK")
        review = sum(1 for r in rule_results if r.verdict == "NEEDS_REVIEW")
        allow = sum(1 for r in rule_results if r.verdict == "ALLOW")
        triggered = block + review
        
        return {
            "total": total,
            "triggered": triggered,
            "block": block,
            "review": review,
            "allow": allow,
        }
    
    def save(self, report: GovernanceReport, output_path: str) -> None:
        """
        Save report to a JSON file.
        
        Args:
            report: The GovernanceReport object to save
            output_path: Path to save the report.json file
        """
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(report.model_dump(mode="json"), f, indent=2, default=str)
        
        logger.info("Report saved to %s", output_path)
    
    def generate_html(
        self,
        report: GovernanceReport,
        output_path: str,
        include_evidence: bool = True,
    ) -> None:
        """
        Generate an HTML visualization of the report.
        
        Args:
            report: The GovernanceReport object
            output_path: Path to save the report.html file
            include_evidence: Whether to include evidence details
        """
        html = self._render_html(report, include_evidence)
        
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, "w", encoding="utf-8") as f:
            f.write(html)
        
        logger.info("HTML report saved to %s", output_path)
    
    def _render_html(self, report: GovernanceReport, include_evidence: bool) -> str:
        """Render report as HTML."""
        verdict_colors = {
            "BLOCK": "#dc3545",
            "NEEDS_REVIEW": "#ffc107",
            "ALLOW": "#28a745",
        }
        
        verdict_color = verdict_colors.get(report.decision.verdict, "#6c757d")
        
        # Build triggered rules HTML
        triggered_html = ""
        for rule in report.rule_results:
            if rule.verdict != "ALLOW":
                rule_color = verdict_colors.get(rule.verdict, "#6c757d")
                triggered_html += f"""
                <div class="rule-card" style="border-left: 4px solid {rule_color};">
                    <div class="rule-header">
                        <span class="rule-id">{rule.rule_id}</span>
                        <span class="verdict-badge" style="background: {rule_color};">{rule.verdict}</span>
                    </div>
                    <div class="rule-body">
                        <p><strong>Explanation:</strong> {rule.explanation}</p>
                        <p><strong>Recommended Action:</strong> {rule.recommended_action}</p>
                        <p><strong>Confidence:</strong> {rule.confidence:.0%}</p>
                    </div>
                </div>
                """
        
        if not triggered_html:
            triggered_html = "<p class='no-rules'>No rules triggered. Extension passed all checks.</p>"
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Governance Report - {report.extension_name or report.scan_id}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }}
        .container {{ max-width: 1000px; margin: 0 auto; padding: 20px; }}
        .header {{ 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
        }}
        .header h1 {{ font-size: 1.8em; margin-bottom: 10px; }}
        .header .meta {{ opacity: 0.8; font-size: 0.9em; }}
        .verdict-banner {{
            background: {verdict_color};
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .verdict-banner h2 {{ font-size: 2em; }}
        .verdict-banner .action {{ 
            background: rgba(255,255,255,0.2);
            padding: 10px 15px;
            border-radius: 5px;
            max-width: 400px;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }}
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .stat-card .number {{ font-size: 2em; font-weight: bold; }}
        .stat-card .label {{ color: #666; font-size: 0.9em; }}
        .section {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .section h3 {{ margin-bottom: 15px; color: #1a1a2e; }}
        .rule-card {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
        }}
        .rule-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }}
        .rule-id {{ font-weight: bold; font-family: monospace; }}
        .verdict-badge {{
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
        }}
        .rule-body p {{ margin-bottom: 8px; font-size: 0.95em; }}
        .no-rules {{ color: #28a745; font-style: italic; }}
        .rationale {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            white-space: pre-line;
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.85em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Governance Report</h1>
            <div class="meta">
                <p><strong>Extension:</strong> {report.extension_name or 'Unknown'}</p>
                <p><strong>Scan ID:</strong> {report.scan_id}</p>
                <p><strong>Generated:</strong> {report.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if report.created_at else 'N/A'}</p>
            </div>
        </div>
        
        <div class="verdict-banner">
            <h2>{report.decision.verdict}</h2>
            <div class="action">{report.decision.action_required}</div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="number">{report.total_rules_evaluated}</div>
                <div class="label">Rules Evaluated</div>
            </div>
            <div class="stat-card">
                <div class="number" style="color: #dc3545;">{report.block_count}</div>
                <div class="label">Block Rules</div>
            </div>
            <div class="stat-card">
                <div class="number" style="color: #ffc107;">{report.review_count}</div>
                <div class="label">Review Rules</div>
            </div>
            <div class="stat-card">
                <div class="number" style="color: #28a745;">{report.allow_count}</div>
                <div class="label">Allow Rules</div>
            </div>
        </div>
        
        <div class="section">
            <h3>📋 Decision Rationale</h3>
            <div class="rationale">{report.decision.rationale}</div>
        </div>
        
        <div class="section">
            <h3>⚠️ Triggered Rules</h3>
            {triggered_html}
        </div>
        
        <div class="footer">
            <p>Generated by ExtensionShield Governance Engine</p>
        </div>
    </div>
</body>
</html>"""
        
        return html


def generate_governance_report(
    scan_id: str,
    rule_results: RuleResults,
    facts: Optional[Facts] = None,
    **kwargs
) -> GovernanceReport:
    """
    Convenience function to generate a governance report.
    
    Args:
        scan_id: Unique scan identifier
        rule_results: Results from rules engine
        facts: Facts from Stage 2 (optional)
        **kwargs: Additional arguments passed to generator
        
    Returns:
        GovernanceReport
    """
    generator = ReportGenerator()
    return generator.generate(
        scan_id=scan_id,
        rule_results=rule_results,
        facts=facts,
        **kwargs
    )


def aggregate_verdict(rule_results: List[RuleResult]) -> str:
    """
    Quick verdict aggregation without full report generation.
    
    Args:
        rule_results: List of rule results
        
    Returns:
        "BLOCK", "NEEDS_REVIEW", or "ALLOW"
    """
    if any(r.verdict == "BLOCK" for r in rule_results):
        return "BLOCK"
    if any(r.verdict == "NEEDS_REVIEW" for r in rule_results):
        return "NEEDS_REVIEW"
    return "ALLOW"

