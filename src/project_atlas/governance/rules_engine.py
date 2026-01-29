"""
Rules Engine - Stage 7 of Governance Pipeline

Evaluates extensions against policy rules using a deterministic DSL.
Produces rule_results.json with ALLOW/BLOCK/NEEDS_REVIEW verdicts.

The Rules Engine is:
- Deterministic: Same input → same output, every time
- Auditable: Simple condition parser, no LLM calls
- Lightweight: Pure Python, no external dependencies (besides pyyaml)
"""

import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Literal
from pathlib import Path

from .schemas import RuleResult, RuleResults

logger = logging.getLogger(__name__)


class ConditionEvaluator:
    """
    Evaluates rule conditions using a simple recursive descent parser.
    
    Supported operators:
    - Equality: ==, !=
    - Contains: contains, not contains
    - Emptiness: is empty, is not empty
    - Logic: AND, OR, NOT
    - Type check: type="..." (for signals array)
    """
    
    def __init__(self):
        """Initialize the condition evaluator."""
        self.context = {}
    
    def evaluate(self, condition: str, context: Dict[str, Any]) -> bool:
        """
        Evaluate a condition string against a context dictionary.
        
        Args:
            condition: Condition string (e.g., "facts.host_access_patterns contains '<all_urls>'")
            context: Evaluation context with facts, signals, etc.
            
        Returns:
            bool: True if condition is satisfied, False otherwise
        """
        self.context = context
        try:
            result = self._parse_or(condition.strip())
            return result
        except Exception as e:
            logger.error(f"Error evaluating condition '{condition}': {e}")
            return False
    
    def _parse_or(self, expr: str) -> bool:
        """Parse OR expressions (lowest precedence)."""
        # Split on OR that's not inside parentheses
        parts = self._split_on_operator(expr, "OR")
        if len(parts) > 1:
            return any(self._parse_and(part.strip()) for part in parts)
        return self._parse_and(expr)
    
    def _parse_and(self, expr: str) -> bool:
        """Parse AND expressions."""
        # Split on AND that's not inside parentheses
        parts = self._split_on_operator(expr, "AND")
        if len(parts) > 1:
            return all(self._parse_and(part.strip()) for part in parts)
        return self._parse_comparison(expr)
    
    def _parse_comparison(self, expr: str) -> bool:
        """Parse comparison expressions (equality, contains, etc.)."""
        expr = expr.strip()
        
        # Handle parentheses
        if expr.startswith("(") and expr.endswith(")"):
            return self._parse_or(expr[1:-1])
        
        # Handle NOT
        if expr.startswith("NOT"):
            rest = expr[3:].strip()
            if rest.startswith("(") and rest.endswith(")"):
                return not self._parse_or(rest[1:-1])
            return not self._parse_comparison(rest)
        
        # Check for comparison operators
        if " is empty" in expr:
            return self._eval_is_empty(expr)
        if " is not empty" in expr:
            return self._eval_is_not_empty(expr)
        if " contains type=" in expr:
            return self._eval_signal_type_contains(expr)
        if " contains " in expr:
            return self._eval_contains(expr)
        if " not contains " in expr:
            return self._eval_not_contains(expr)
        if " == " in expr:
            return self._eval_equality(expr, "==")
        if " != " in expr:
            return self._eval_equality(expr, "!=")
        if " >= " in expr:
            return self._eval_numeric_comparison(expr, ">=")
        if " <= " in expr:
            return self._eval_numeric_comparison(expr, "<=")
        if " > " in expr:
            return self._eval_numeric_comparison(expr, ">")
        if " < " in expr:
            return self._eval_numeric_comparison(expr, "<")
        
        logger.warning(f"Unknown comparison operator in: {expr}")
        return False
    
    def _split_on_operator(self, expr: str, operator: str) -> List[str]:
        """Split expression on operator, respecting parentheses."""
        parts = []
        current = ""
        paren_depth = 0
        
        i = 0
        while i < len(expr):
            if expr[i] == "(":
                paren_depth += 1
                current += expr[i]
            elif expr[i] == ")":
                paren_depth -= 1
                current += expr[i]
            elif paren_depth == 0 and expr[i:i+len(operator)] == operator:
                # Found operator at top level
                if current.strip():
                    parts.append(current)
                current = ""
                i += len(operator) - 1
            else:
                current += expr[i]
            i += 1
        
        if current.strip():
            parts.append(current)
        
        return parts
    
    def _get_value(self, path: str) -> Any:
        """Get value from context using dot notation."""
        path = path.strip()
        parts = path.split(".")
        
        value = self.context
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        
        return value
    
    def _eval_equality(self, expr: str, operator: str) -> bool:
        """Evaluate == or != comparison."""
        parts = expr.split(operator)
        if len(parts) != 2:
            return False
        
        left = self._get_value(parts[0].strip())
        right = self._parse_value(parts[1].strip())
        
        if operator == "==":
            return left == right
        else:  # !=
            return left != right
    
    def _eval_numeric_comparison(self, expr: str, operator: str) -> bool:
        """Evaluate numeric comparison operators (>, <, >=, <=)."""
        parts = expr.split(f" {operator} ", 1)
        if len(parts) != 2:
            return False
        
        left = self._get_value(parts[0].strip())
        right = self._parse_value(parts[1].strip())
        
        # Convert to numbers for comparison
        try:
            left_num = float(left) if left is not None else 0
            right_num = float(right) if right is not None else 0
        except (ValueError, TypeError):
            logger.warning(f"Cannot compare non-numeric values: {left} {operator} {right}")
            return False
        
        if operator == ">":
            return left_num > right_num
        elif operator == "<":
            return left_num < right_num
        elif operator == ">=":
            return left_num >= right_num
        elif operator == "<=":
            return left_num <= right_num
        
        return False
    
    def _eval_contains(self, expr: str) -> bool:
        """Evaluate 'contains' operator."""
        parts = expr.split(" contains ", 1)
        if len(parts) != 2:
            return False
        
        left = self._get_value(parts[0].strip())
        right = self._parse_value(parts[1].strip())
        
        # If left is a list, check if right is in it
        if isinstance(left, list):
            return right in left
        # If left is a string, check if right is a substring
        elif isinstance(left, str):
            return str(right) in left
        
        return False
    
    def _eval_not_contains(self, expr: str) -> bool:
        """Evaluate 'not contains' operator."""
        parts = expr.split(" not contains ", 1)
        if len(parts) != 2:
            return False
        
        left = self._get_value(parts[0].strip())
        right = self._parse_value(parts[1].strip())
        
        # If left is a list, check if right is NOT in it
        if isinstance(left, list):
            return right not in left
        # If left is a string, check if right is NOT a substring
        elif isinstance(left, str):
            return str(right) not in left
        
        return True
    
    def _eval_is_empty(self, expr: str) -> bool:
        """Evaluate 'is empty' operator."""
        parts = expr.split(" is empty")
        if len(parts) < 1:
            return False
        
        value = self._get_value(parts[0].strip())
        
        if value is None:
            return True
        if isinstance(value, (list, dict, str)):
            return len(value) == 0
        
        return False
    
    def _eval_is_not_empty(self, expr: str) -> bool:
        """Evaluate 'is not empty' operator."""
        parts = expr.split(" is not empty")
        if len(parts) < 1:
            return False
        
        value = self._get_value(parts[0].strip())
        
        if value is None:
            return False
        if isinstance(value, (list, dict, str)):
            return len(value) > 0
        
        return True
    
    def _eval_signal_type_contains(self, expr: str) -> bool:
        """Evaluate signal type check: 'signals contains type="ENDPOINT_FOUND"'."""
        match = re.search(r'signals\s+contains\s+type="([^"]+)"', expr)
        if not match:
            return False
        
        signal_type = match.group(1)
        signals = self._get_value("signals")
        
        if not isinstance(signals, list):
            return False
        
        # Check if any signal has this type
        for signal in signals:
            if isinstance(signal, dict) and signal.get("type") == signal_type:
                return True
        
        return False
    
    def _parse_value(self, value_str: str) -> Any:
        """Parse a value string into appropriate type."""
        value_str = value_str.strip()
        
        # String literal (quoted)
        if (value_str.startswith('"') and value_str.endswith('"')) or \
           (value_str.startswith("'") and value_str.endswith("'")):
            return value_str[1:-1]
        
        # Boolean
        if value_str.lower() == "true":
            return True
        if value_str.lower() == "false":
            return False
        
        # Number
        try:
            if "." in value_str:
                return float(value_str)
            return int(value_str)
        except ValueError:
            pass
        
        # Default: treat as string
        return value_str


class RulesEngine:
    """
    Evaluates extensions against policy rules deterministically.
    
    Pipeline Stage 7: Takes facts, signals, context, and rulepacks
    and produces rule_results.json with ALLOW/BLOCK/NEEDS_REVIEW verdicts.
    """
    
    def __init__(self, rulepacks: List[Dict[str, Any]]):
        """
        Initialize the Rules Engine.
        
        Args:
            rulepacks: List of rulepack dictionaries loaded from YAML
        """
        self.rulepacks = rulepacks
        self.evaluator = ConditionEvaluator()
        logger.info(f"Initialized Rules Engine with {len(rulepacks)} rulepacks")
    
    @staticmethod
    def load_rulepacks(rulepacks_dir: str) -> List[Dict[str, Any]]:
        """
        Load all rulepacks from a directory.
        
        Args:
            rulepacks_dir: Path to directory containing rulepack YAML files
            
        Returns:
            List of rulepack dictionaries
        """
        import yaml
        
        rulepacks = []
        dir_path = Path(rulepacks_dir)
        
        if not dir_path.exists():
            logger.warning(f"Rulepacks directory not found: {rulepacks_dir}")
            return []
        
        for yaml_file in dir_path.glob("*.yaml"):
            try:
                with open(yaml_file, "r") as f:
                    rulepack = yaml.safe_load(f)
                    if rulepack:
                        rulepacks.append(rulepack)
                        logger.info(f"Loaded rulepack: {rulepack.get('rulepack_id')}")
            except Exception as e:
                logger.error(f"Error loading rulepack {yaml_file}: {e}")
        
        return rulepacks
    
    def evaluate(
        self,
        scan_id: str,
        facts: Dict[str, Any],
        signals: List[Dict[str, Any]],
        store_listing: Dict[str, Any],
        context: Dict[str, Any],
    ) -> RuleResults:
        """
        Evaluate all rules against the provided facts and signals.
        
        Args:
            scan_id: Unique scan identifier
            facts: Facts object (dict form)
            signals: List of signals
            store_listing: Store listing data
            context: Governance context
            
        Returns:
            RuleResults with verdicts for each rule
        """
        logger.info(f"Starting rule evaluation for scan_id={scan_id}")
        
        # Build evaluation context
        eval_context = self._build_eval_context(facts, signals, store_listing)
        
        # Get rulepacks from context
        rulepack_ids = context.get("rulepacks", [])
        active_rulepacks = [
            rp for rp in self.rulepacks 
            if rp.get("rulepack_id") in rulepack_ids
        ]
        
        if not active_rulepacks:
            logger.warning(f"No active rulepacks found for context: {rulepack_ids}")
        
        # Evaluate rules
        rule_results = []
        for rulepack in active_rulepacks:
            for rule in rulepack.get("rules", []):
                result = self._evaluate_rule(rule, eval_context, rulepack.get("rulepack_id"))
                rule_results.append(result)
        
        logger.info(f"Evaluated {len(rule_results)} rules")
        
        return RuleResults(scan_id=scan_id, rule_results=rule_results)
    
    def _build_eval_context(
        self,
        facts: Dict[str, Any],
        signals: List[Dict[str, Any]],
        store_listing: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Build the evaluation context for the DSL evaluator."""
        return {
            "facts": facts,
            "manifest": facts.get("manifest", {}),
            "signals": signals,
            "extraction": store_listing.get("extraction", {}),
            "declared_data_categories": store_listing.get("declared_data_categories", []),
            "declared_purposes": store_listing.get("declared_purposes", []),
            "declared_third_parties": store_listing.get("declared_third_parties", []),
            "privacy_policy_url": store_listing.get("privacy_policy_url"),
        }
    
    def _evaluate_rule(
        self,
        rule: Dict[str, Any],
        eval_context: Dict[str, Any],
        rulepack_id: str,
    ) -> RuleResult:
        """
        Evaluate a single rule against the evaluation context.
        
        Args:
            rule: Rule dictionary from rulepack
            eval_context: Context for condition evaluation
            rulepack_id: ID of the rulepack containing this rule
            
        Returns:
            RuleResult with verdict
        """
        rule_id = rule.get("rule_id")
        condition = rule.get("condition", "")
        
        logger.debug(f"Evaluating rule: {rule_id}")
        
        try:
            # Evaluate condition
            condition_met = self.evaluator.evaluate(condition, eval_context)
            
            # Determine verdict
            if condition_met:
                verdict = rule.get("verdict", "NEEDS_REVIEW")
            else:
                verdict = "ALLOW"
            
            explanation = (
                f"Condition matched. Verdict: {verdict}" 
                if condition_met 
                else f"Condition not matched. Verdict: ALLOW"
            )
            
        except Exception as e:
            logger.error(f"Error evaluating rule {rule_id}: {e}")
            verdict = "NEEDS_REVIEW"
            explanation = f"Error during evaluation: {str(e)}"
        
        return RuleResult(
            rule_id=rule_id,
            rulepack=rulepack_id,
            verdict=verdict,
            confidence=rule.get("confidence", 0.8),
            evidence_refs=rule.get("evidence_refs", []),
            citations=rule.get("citations", []),
            explanation=explanation,
            recommended_action=rule.get("recommended_action", ""),
            triggered_at=datetime.utcnow(),
        )
