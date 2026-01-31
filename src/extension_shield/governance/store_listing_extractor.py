"""
Store Listing Extractor - Stage 5 of Governance Pipeline

Extracts Chrome Web Store listing data for governance decisioning.
This includes declared data categories, purposes, and third-party sharing.

IMPORTANT: This stage ALWAYS produces an output file, even when extraction
fails or is skipped. Rules that depend on store listing data MUST check
`extraction.status == "ok"` before relying on declared data fields.

Output: store_listing.json
"""

import hashlib
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from .schemas import StoreListing, ExtractionStatus


logger = logging.getLogger(__name__)


# =============================================================================
# CHROME WEB STORE DATA CATEGORY MAPPINGS
# =============================================================================

# CWS Privacy Practices categories (as displayed on extension pages)
CWS_DATA_CATEGORIES = {
    # Personal Information
    "personally identifiable information": "pii",
    "personal information": "pii",
    "name": "personal_name",
    "email": "email",
    "email address": "email",
    "phone": "phone",
    "phone number": "phone",
    "address": "physical_address",
    "physical address": "physical_address",
    
    # Financial
    "payment": "payment_info",
    "payment information": "payment_info",
    "credit card": "payment_info",
    "financial": "financial_info",
    "financial information": "financial_info",
    
    # Authentication
    "authentication": "auth_info",
    "authentication information": "auth_info",
    "password": "auth_info",
    "login": "auth_info",
    "credentials": "auth_info",
    
    # Location
    "location": "location",
    "location data": "location",
    "geolocation": "location",
    
    # Browsing
    "web history": "web_history",
    "browsing history": "web_history",
    "browsing activity": "browsing_activity",
    "website content": "website_content",
    "page content": "website_content",
    
    # User Activity
    "user activity": "user_activity",
    "activity": "user_activity",
    
    # Health
    "health": "health_info",
    "health information": "health_info",
    
    # Communications
    "communications": "communications",
    "messages": "communications",
}

# Purpose categories from CWS privacy practices
CWS_PURPOSES = {
    "functionality": "functionality",
    "analytics": "analytics",
    "advertising": "advertising",
    "personalization": "personalization",
    "security": "security",
    "fraud prevention": "fraud_prevention",
    "account management": "account_management",
    "developer communications": "developer_communications",
}


class StoreListingExtractor:
    """
    Extracts Chrome Web Store listing data for governance.
    
    Stage 5 of the Governance Decisioning Pipeline.
    
    Usage:
        extractor = StoreListingExtractor()
        
        # From extension URL
        store_listing = extractor.extract_from_url(
            "https://chromewebstore.google.com/detail/extension-name/abc123"
        )
        
        # From extension ID
        store_listing = extractor.extract_from_id("abc123")
        
        # From existing metadata (already fetched)
        store_listing = extractor.extract_from_metadata(metadata_dict)
    """
    
    CWS_BASE_URL = "https://chromewebstore.google.com/detail"
    
    def __init__(self, timeout: int = 15):
        """
        Initialize the Store Listing Extractor.
        
        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = timeout
    
    def extract_from_url(self, store_url: str) -> StoreListing:
        """
        Extract store listing from a Chrome Web Store URL.
        
        Args:
            store_url: Full CWS URL
            
        Returns:
            StoreListing with extraction status
        """
        logger.info("Extracting store listing from URL: %s", store_url)
        
        if not store_url:
            return self._create_skipped_listing("No store URL provided")
        
        if not self._is_valid_cws_url(store_url):
            return self._create_skipped_listing(f"Invalid CWS URL: {store_url}")
        
        try:
            # Use existing ExtensionMetadata class
            from extension_shield.core.extension_metadata import ExtensionMetadata
            
            metadata_fetcher = ExtensionMetadata(store_url)
            metadata = metadata_fetcher.fetch_metadata()
            
            if not metadata:
                return self._create_failed_listing("Failed to fetch CWS page")
            
            return self._build_store_listing(metadata, store_url)
            
        except ImportError:
            logger.warning("ExtensionMetadata not available, using fallback")
            return self._extract_fallback(store_url)
        except Exception as e:
            logger.error("Error extracting store listing: %s", e)
            return self._create_failed_listing(str(e))
    
    def extract_from_id(self, extension_id: str) -> StoreListing:
        """
        Extract store listing from an extension ID.
        
        Args:
            extension_id: Chrome extension ID
            
        Returns:
            StoreListing with extraction status
        """
        if not extension_id:
            return self._create_skipped_listing("No extension ID provided")
        
        # Construct CWS URL
        store_url = f"{self.CWS_BASE_URL}/{extension_id}"
        return self.extract_from_url(store_url)
    
    def extract_from_metadata(
        self,
        metadata: Dict[str, Any],
        store_url: Optional[str] = None
    ) -> StoreListing:
        """
        Build store listing from already-fetched metadata.
        
        Args:
            metadata: Metadata dictionary (from ExtensionMetadata.fetch_metadata())
            store_url: Optional store URL for reference
            
        Returns:
            StoreListing object
        """
        if not metadata:
            return self._create_skipped_listing("No metadata provided")
        
        return self._build_store_listing(metadata, store_url)
    
    def create_local_upload_listing(self) -> StoreListing:
        """
        Create a store listing for locally uploaded extensions.
        
        Returns:
            StoreListing with skipped status
        """
        return self._create_skipped_listing(
            "Extension uploaded locally (not from Chrome Web Store)"
        )
    
    def _is_valid_cws_url(self, url: str) -> bool:
        """Check if URL is a valid Chrome Web Store URL."""
        return url.startswith("https://chromewebstore.google.com/detail/")
    
    def _build_store_listing(
        self,
        metadata: Dict[str, Any],
        store_url: Optional[str] = None
    ) -> StoreListing:
        """
        Build StoreListing from fetched metadata.
        
        Args:
            metadata: Raw metadata from CWS
            store_url: Optional store URL
            
        Returns:
            StoreListing object
        """
        # Extract privacy policy URL and hash
        privacy_text = metadata.get("privacy_policy", "")
        privacy_url, privacy_hash = self._extract_privacy_policy_url(privacy_text)
        
        # Parse data categories from privacy section
        data_categories = self._parse_data_categories(privacy_text)
        
        # Parse purposes from privacy section
        purposes = self._parse_purposes(privacy_text)
        
        # Parse third parties (if declared)
        third_parties = self._parse_third_parties(privacy_text)
        
        return StoreListing(
            extraction=ExtractionStatus(
                status="ok",
                reason="Successfully extracted from Chrome Web Store",
                extracted_at=datetime.utcnow(),
            ),
            declared_data_categories=data_categories,
            declared_purposes=purposes,
            declared_third_parties=third_parties,
            privacy_policy_url=privacy_url,
            privacy_policy_hash=privacy_hash,
        )
    
    def _extract_privacy_policy_url(
        self,
        privacy_text: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract privacy policy URL and compute hash.
        
        Args:
            privacy_text: Privacy section text from CWS
            
        Returns:
            Tuple of (url, hash) or (None, None)
        """
        if not privacy_text:
            return None, None
        
        # Look for URLs in the privacy text
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        urls = re.findall(url_pattern, privacy_text)
        
        # Filter for likely privacy policy URLs
        privacy_keywords = ["privacy", "policy", "legal", "terms"]
        privacy_url = None
        
        for url in urls:
            url_lower = url.lower()
            if any(kw in url_lower for kw in privacy_keywords):
                privacy_url = url.rstrip(".,)")
                break
        
        # If no privacy-specific URL found, use first URL if any
        if not privacy_url and urls:
            privacy_url = urls[0].rstrip(".,)")
        
        # Compute hash of privacy text (for change detection)
        privacy_hash = None
        if privacy_text:
            privacy_hash = f"sha256:{hashlib.sha256(privacy_text.encode()).hexdigest()}"
        
        return privacy_url, privacy_hash
    
    def _parse_data_categories(self, privacy_text: str) -> List[str]:
        """
        Parse data categories from privacy practices text.
        
        The CWS privacy section includes statements like:
        - "This extension collects the following: Personally Identifiable Information"
        - "This developer declares that your data is: Not being sold to third parties"
        
        Args:
            privacy_text: Privacy section text
            
        Returns:
            List of normalized data category codes
        """
        if not privacy_text:
            return []
        
        categories = set()
        text_lower = privacy_text.lower()
        
        # Check for each known category
        for phrase, category_code in CWS_DATA_CATEGORIES.items():
            if phrase in text_lower:
                categories.add(category_code)
        
        # Check for "collects" patterns
        collect_patterns = [
            r"collects?\s+(?:the\s+following[:\s]+)?([^.]+)",
            r"collecting\s+([^.]+)",
            r"gathers?\s+([^.]+)",
        ]
        
        for pattern in collect_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                for phrase, category_code in CWS_DATA_CATEGORIES.items():
                    if phrase in match:
                        categories.add(category_code)
        
        return sorted(categories)
    
    def _parse_purposes(self, privacy_text: str) -> List[str]:
        """
        Parse declared purposes from privacy practices text.
        
        Args:
            privacy_text: Privacy section text
            
        Returns:
            List of normalized purpose codes
        """
        if not privacy_text:
            return []
        
        purposes = set()
        text_lower = privacy_text.lower()
        
        # Check for each known purpose
        for phrase, purpose_code in CWS_PURPOSES.items():
            if phrase in text_lower:
                purposes.add(purpose_code)
        
        # Check for "used for" patterns
        purpose_patterns = [
            r"used\s+for\s+([^.]+)",
            r"purpose\s+of\s+([^.]+)",
            r"to\s+provide\s+([^.]+)",
        ]
        
        for pattern in purpose_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                for phrase, purpose_code in CWS_PURPOSES.items():
                    if phrase in match:
                        purposes.add(purpose_code)
        
        return sorted(purposes)
    
    def _parse_third_parties(self, privacy_text: str) -> List[str]:
        """
        Parse declared third parties from privacy practices text.
        
        Args:
            privacy_text: Privacy section text
            
        Returns:
            List of declared third party names/types
        """
        if not privacy_text:
            return []
        
        third_parties = set()
        text_lower = privacy_text.lower()
        
        # Common third party patterns
        third_party_patterns = [
            r"shared\s+with\s+([^.]+)",
            r"third\s+part(?:y|ies)[:\s]+([^.]+)",
            r"partners?[:\s]+([^.]+)",
        ]
        
        for pattern in third_party_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                # Clean and add
                cleaned = match.strip().strip(",").strip()
                if cleaned and len(cleaned) < 100:  # Reasonable length
                    third_parties.add(cleaned)
        
        # Known analytics/advertising services
        known_services = [
            "google analytics", "firebase", "facebook", "mixpanel",
            "amplitude", "segment", "hotjar", "sentry", "bugsnag",
            "crashlytics", "appsflyer", "adjust", "branch"
        ]
        
        for service in known_services:
            if service in text_lower:
                third_parties.add(service.title())
        
        return sorted(third_parties)
    
    def _extract_fallback(self, store_url: str) -> StoreListing:
        """
        Fallback extraction using requests directly.
        
        Args:
            store_url: CWS URL
            
        Returns:
            StoreListing (may be partial)
        """
        try:
            import requests
            from bs4 import BeautifulSoup
            
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
            }
            
            response = requests.get(store_url, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Try to find privacy section
            privacy_text = ""
            h2 = soup.find("h2", string="Privacy")
            if h2:
                section = h2.parent.parent
                if section:
                    privacy_text = section.get_text(separator="\n", strip=True)
            
            # Build listing from extracted data
            privacy_url, privacy_hash = self._extract_privacy_policy_url(privacy_text)
            data_categories = self._parse_data_categories(privacy_text)
            purposes = self._parse_purposes(privacy_text)
            third_parties = self._parse_third_parties(privacy_text)
            
            return StoreListing(
                extraction=ExtractionStatus(
                    status="ok",
                    reason="Extracted via fallback method",
                    extracted_at=datetime.utcnow(),
                ),
                declared_data_categories=data_categories,
                declared_purposes=purposes,
                declared_third_parties=third_parties,
                privacy_policy_url=privacy_url,
                privacy_policy_hash=privacy_hash,
            )
            
        except Exception as e:
            logger.error("Fallback extraction failed: %s", e)
            return self._create_failed_listing(f"Fallback extraction failed: {e}")
    
    def _create_skipped_listing(self, reason: str) -> StoreListing:
        """Create a StoreListing with skipped status."""
        return StoreListing(
            extraction=ExtractionStatus(
                status="skipped",
                reason=reason,
                extracted_at=datetime.utcnow(),
            ),
            declared_data_categories=[],
            declared_purposes=[],
            declared_third_parties=[],
            privacy_policy_url=None,
            privacy_policy_hash=None,
        )
    
    def _create_failed_listing(self, reason: str) -> StoreListing:
        """Create a StoreListing with failed status."""
        return StoreListing(
            extraction=ExtractionStatus(
                status="failed",
                reason=reason,
                extracted_at=datetime.utcnow(),
            ),
            declared_data_categories=[],
            declared_purposes=[],
            declared_third_parties=[],
            privacy_policy_url=None,
            privacy_policy_hash=None,
        )
    
    def save(self, store_listing: StoreListing, output_path: str) -> None:
        """
        Save store listing to a JSON file.
        
        Args:
            store_listing: The StoreListing object to save
            output_path: Path to save the store_listing.json file
        """
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(store_listing.model_dump(mode="json"), f, indent=2, default=str)
        
        logger.info("Store listing saved to %s", output_path)


def extract_store_listing(
    extension_id: Optional[str] = None,
    store_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    is_local_upload: bool = False,
) -> StoreListing:
    """
    Convenience function to extract store listing.
    
    This function determines the best extraction method based on
    available inputs and always returns a StoreListing object.
    
    Args:
        extension_id: Chrome extension ID
        store_url: Full CWS URL
        metadata: Pre-fetched metadata dict
        is_local_upload: Whether extension was uploaded locally
        
    Returns:
        StoreListing object (never None)
    """
    extractor = StoreListingExtractor()
    
    if is_local_upload:
        return extractor.create_local_upload_listing()
    
    if metadata:
        return extractor.extract_from_metadata(metadata, store_url)
    
    if store_url:
        return extractor.extract_from_url(store_url)
    
    if extension_id:
        return extractor.extract_from_id(extension_id)
    
    return extractor.create_local_upload_listing()

