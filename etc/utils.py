from __future__ import annotations
from datetime import datetime, timedelta


def utc_iso_to_kst_label(iso_ts: str) -> str:
    """Convert ISO UTC timestamp string to 'YYYY-MM-DD HH:MM:SS' in KST (UTC+9).

    Falls back to a simple best-effort formatting when parsing fails.
    """
    if not iso_ts:
        return ""
    try:
        ts = datetime.fromisoformat(iso_ts)
        kst = ts + timedelta(hours=9)
        return kst.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        raw = iso_ts or ""
        return raw[:19].replace('T', ' ')


