"""
Extension Analyzer

This module provides the main analyzer class for Chrome extensions.
"""

import logging
import concurrent.futures
from typing import Optional, Dict
from extension_shield.core.analyzers.permissions import PermissionsAnalyzer
from extension_shield.core.analyzers.sast import JavaScriptAnalyzer
from extension_shield.core.analyzers.webstore import WebstoreAnalyzer
from extension_shield.core.analyzers.virustotal import VirusTotalAnalyzer
from extension_shield.core.analyzers.entropy import EntropyAnalyzer
from extension_shield.core.analyzers.chromestats import ChromeStatsAnalyzer

logger = logging.getLogger(__name__)

# Timeout for any single analyzer (seconds).
# VirusTotal and LLM-based permission analysis are the slowest (~3-10s each).
_ANALYZER_TIMEOUT = 30


class ExtensionAnalyzer:
    """Analyzes Chrome extensions using multiple specialized analyzers."""

    def __init__(
        self,
        extension_dir: str,
        manifest: Optional[Dict] = None,
        metadata: Optional[Dict] = None,
    ):
        self.extension_dir = extension_dir
        self.manifest = manifest
        self.metadata = metadata
        self.permissions_analyzer = PermissionsAnalyzer()
        self.javascript_analyzer = JavaScriptAnalyzer()
        self.webstore_analyzer = WebstoreAnalyzer()
        self.virustotal_analyzer = VirusTotalAnalyzer()
        self.entropy_analyzer = EntropyAnalyzer()
        self.chromestats_analyzer = ChromeStatsAnalyzer()

    def analyze(self) -> Optional[Dict]:
        """
        Analyze the Chrome extension located in the specified directory.

        All six analyzers run in parallel using a thread pool. Each analyzer
        is independent (no shared mutable state) so concurrent execution is
        safe. If any single analyzer fails or times out, the others still
        return their results — the failed slot is set to None.

        Returns:
            Optional[Dict]: Analysis results including findings and metadata
        """
        # Define the analyzer tasks: (result_key, callable, kwargs)
        tasks = {
            "permissions_analysis": (
                self.permissions_analyzer.analyze,
                {"extension_dir": self.extension_dir, "manifest": self.manifest},
            ),
            "webstore_analysis": (
                self.webstore_analyzer.analyze,
                {"extension_dir": self.extension_dir, "manifest": self.manifest, "metadata": self.metadata},
            ),
            "javascript_analysis": (
                self.javascript_analyzer.analyze,
                {"extension_dir": self.extension_dir, "manifest": self.manifest},
            ),
            "virustotal_analysis": (
                self.virustotal_analyzer.analyze,
                {"extension_dir": self.extension_dir, "manifest": self.manifest, "metadata": self.metadata},
            ),
            "entropy_analysis": (
                self.entropy_analyzer.analyze,
                {"extension_dir": self.extension_dir, "manifest": self.manifest, "metadata": self.metadata},
            ),
            "chromestats_analysis": (
                self.chromestats_analyzer.analyze,
                {"extension_dir": self.extension_dir, "manifest": self.manifest, "metadata": self.metadata},
            ),
        }

        results: Dict[str, Optional[Dict]] = {}

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            future_to_key = {
                executor.submit(fn, **kwargs): key
                for key, (fn, kwargs) in tasks.items()
            }

            for future in concurrent.futures.as_completed(future_to_key):
                key = future_to_key[future]
                try:
                    results[key] = future.result(timeout=_ANALYZER_TIMEOUT)
                except concurrent.futures.TimeoutError:
                    logger.warning("Analyzer %s timed out after %ds", key, _ANALYZER_TIMEOUT)
                    results[key] = None
                except Exception as exc:
                    logger.warning("Analyzer %s failed: %s", key, exc)
                    results[key] = None

        return results
