"""
Runtime mode and feature flags for ExtensionShield open-core.

EXTSHIELD_MODE controls which features are available:
  - "oss"   (default): Core scanner, CLI, local SQLite. Cloud features disabled.
  - "cloud": All features enabled (auth, history, telemetry admin, etc.).

Individual feature flags can override the mode defaults via env vars.

OSS telemetry: In OSS mode, POST /api/telemetry/pageview and /api/telemetry/event
can be enabled for local-only metrics (SQLite) via OSS_TELEMETRY_ENABLED=true.
When false (default), those endpoints return 501. No outbound tracking in OSS.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

from fastapi import Depends, HTTPException

Mode = Literal["oss", "cloud"]


def _parse_mode() -> Mode:
    raw = os.environ.get("EXTSHIELD_MODE", "oss").strip().lower()
    if raw in ("cloud", "enterprise"):
        return "cloud"
    return "oss"


def _flag(env_name: str, default: bool) -> bool:
    val = os.environ.get(env_name, "").strip().lower()
    if val in ("1", "true", "yes"):
        return True
    if val in ("0", "false", "no"):
        return False
    return default


@dataclass(frozen=True)
class FeatureFlags:
    mode: Mode
    auth_enabled: bool
    history_enabled: bool
    telemetry_enabled: bool
    community_queue_enabled: bool
    enterprise_forms_enabled: bool
    # In OSS mode only: allow local metrics (pageview/event) stored in SQLite only. Default False.
    oss_telemetry_enabled: bool


@lru_cache(maxsize=1)
def get_feature_flags() -> FeatureFlags:
    mode = _parse_mode()
    cloud = mode == "cloud"

    return FeatureFlags(
        mode=mode,
        auth_enabled=_flag("AUTH_ENABLED", cloud),
        history_enabled=_flag("HISTORY_ENABLED", cloud),
        telemetry_enabled=_flag("TELEMETRY_ENABLED", cloud),
        community_queue_enabled=_flag("COMMUNITY_QUEUE_ENABLED", cloud),
        enterprise_forms_enabled=_flag("ENTERPRISE_FORMS_ENABLED", cloud),
        oss_telemetry_enabled=_flag("OSS_TELEMETRY_ENABLED", False),
    )


def get_mode() -> Mode:
    """Return current runtime mode: 'oss' or 'cloud'."""
    return get_feature_flags().mode


def is_cloud_mode() -> bool:
    """True when EXTSHIELD_MODE=cloud (or feature flags enable cloud features)."""
    return get_feature_flags().mode == "cloud"


def is_cloud() -> bool:
    """Alias for is_cloud_mode()."""
    return is_cloud_mode()


def is_oss() -> bool:
    return get_feature_flags().mode == "oss"


def is_feature_enabled(feature_name: str) -> bool:
    """
    Return True if the given cloud feature is enabled.

    Recognized: auth, history, telemetry, community_queue, enterprise_forms.
    Unknown features are enabled only when mode is cloud.
    """
    flags = get_feature_flags()
    flag_map = {
        "auth": flags.auth_enabled,
        "history": flags.history_enabled,
        "telemetry": flags.telemetry_enabled,
        "community_queue": flags.community_queue_enabled,
        "enterprise_forms": flags.enterprise_forms_enabled,
    }
    enabled = flag_map.get(feature_name)
    if enabled is None:
        enabled = is_cloud_mode()
    return bool(enabled)


def is_oss_telemetry_allowed() -> bool:
    """
    True when local-only telemetry (pageview/event) is allowed in OSS mode.
    In cloud mode this is not used; telemetry is governed by telemetry_enabled.
    """
    flags = get_feature_flags()
    if flags.mode == "cloud":
        return flags.telemetry_enabled
    return bool(flags.oss_telemetry_enabled)


def require_cloud(feature_name: str) -> None:
    """
    Guard for cloud-only API routes.

    Must be called as the first line in every cloud/ops route handler.
    Raises HTTP 501 with consistent JSON detail when the feature is not enabled,
    so that no cloud logic runs after the guard.

    Response detail: {"error": "not_implemented", "feature": "<name>", "mode": "<oss|cloud>"}
    """
    flags = get_feature_flags()

    flag_map = {
        "auth": flags.auth_enabled,
        "history": flags.history_enabled,
        "telemetry": flags.telemetry_enabled,
        "community_queue": flags.community_queue_enabled,
        "enterprise_forms": flags.enterprise_forms_enabled,
    }

    enabled = flag_map.get(feature_name)
    if enabled is None:
        enabled = is_cloud_mode()

    if not enabled:
        raise HTTPException(
            status_code=501,
            detail={
                "error": "not_implemented",
                "feature": feature_name,
                "mode": flags.mode,
            },
        )


def require_cloud_dep(feature_name: str):
    """
    FastAPI dependency factory for cloud-only routes.

    Use at route or router level so enforcement is mechanical (no per-handler discipline).
    Example: dependencies=[require_cloud_dep("telemetry")]
    """
    def _dependency() -> None:
        require_cloud(feature_name)

    return Depends(_dependency)


def reset_feature_flags_cache() -> None:
    """
    Clear the feature flags cache. Call in tests after changing env vars,
    or when the app reloads config, so get_feature_flags() reads fresh values.
    """
    get_feature_flags.cache_clear()
