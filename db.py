from __future__ import annotations
import sqlite3
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Tuple, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Korea Standard Time (UTC+9)
KST = timezone(timedelta(hours=9))

# Database file path (relative to project root)
DB_PATH = os.getenv("DB_PATH", "notes.db")


def init_db(path: str = DB_PATH) -> None:
    """Create notes and history tables if not exists.

    Legacy notes table uses (user_id, pattern, variant_id) as composite primary key.
    New notes table (new_notes) uses (user_id, task_id) as composite primary key for V2 schema.
    """
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        # Legacy schema with user_id + pattern + variant_id composite key
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                user_id TEXT NOT NULL,
                pattern TEXT NOT NULL,
                variant_id TEXT NOT NULL,
                note TEXT,
                created_at TEXT,
                created_by TEXT,
                updated_at TEXT,
                updated_by TEXT,
                PRIMARY KEY (user_id, pattern, variant_id)
            )
            """
        )
        
        # V2 Schema: new_notes table with user_id + task_id composite key
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS new_notes (
                user_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                PRIMARY KEY (user_id, task_id)
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def init_filter_history_table(path: str = DB_PATH) -> None:
    """Create filter_history table if not exists."""
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS filter_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filters_json TEXT,
                created_at TEXT
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_filter_history(filters: dict, path: str = DB_PATH, keep_last: int = 10) -> None:
    """Insert a filter snapshot and keep only the last `keep_last` records."""
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        js = json.dumps(filters, ensure_ascii=False, sort_keys=True)
        now = datetime.now(KST).isoformat()
        cur.execute("INSERT INTO filter_history(filters_json, created_at) VALUES (?, ?)", (js, now))
        # keep only last `keep_last`
        cur.execute("SELECT id FROM filter_history ORDER BY id DESC LIMIT ?", (keep_last,))
        keep_ids = [r[0] for r in cur.fetchall()]
        if keep_ids:
            min_keep = min(keep_ids)
            cur.execute("DELETE FROM filter_history WHERE id < ?", (min_keep,))
        conn.commit()
    finally:
        conn.close()


def load_filter_history(limit: int = 10, path: str = DB_PATH) -> List[Tuple[int, dict, str]]:
    """Load recent filter history rows: (id, filters_json as dict, created_at)."""
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, filters_json, created_at FROM filter_history ORDER BY id DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
        out: List[Tuple[int, dict, str]] = []
        for r in rows:
            fid = int(r[0])
            try:
                fdict = json.loads(r[1])
            except Exception:
                fdict = {}
            created = r[2] or ""
            out.append((fid, fdict, created))
        return out
    finally:
        conn.close()


def load_notes(
    user_id: str,
    pattern: str,
    variant_ids: List[str],
    path: str = DB_PATH
) -> Dict[str, Tuple[str, str, str, str, str]]:
    """Return mapping variant_id -> (note, created_at, updated_at, created_by, updated_by) for given user_id, pattern and variant_ids.
    
    Args:
        user_id: User ID to filter notes
        pattern: Pattern to filter notes
        variant_ids: List of variant IDs
        path: Database file path
        
    Returns:
        Dict mapping variant_id to (note, created_at, updated_at, created_by, updated_by)
    """
    if not variant_ids or not user_id or not pattern:
        return {}
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        placeholders = ",".join(["?"] * len(variant_ids))
        cur.execute(
            f"SELECT variant_id, note, created_at, updated_at, created_by, updated_by FROM notes "
            f"WHERE user_id = ? AND pattern = ? AND variant_id IN ({placeholders})",
            (user_id, pattern, *variant_ids)
        )
        rows = cur.fetchall()
        return {
            str(r[0]): (
                (r[1] or ""),
                (r[2] or ""),
                (r[3] or ""),
                (r[4] or ""),
                (r[5] or "")
            ) for r in rows
        }
    finally:
        conn.close()


def save_note(
    user_id: str,
    pattern: str,
    variant_id: str,
    note: str,
    current_session_user: str,
    path: str = DB_PATH
) -> Tuple[str, str, str, str]:
    """Upsert note for (user_id, pattern, variant_id). Returns (created_at, updated_at, updated_by, created_by).
    
    Args:
        user_id: Owner user ID (from filter or session)
        pattern: Pattern
        variant_id: Variant ID
        note: Note content
        current_session_user: Current session user ID (who is making this change)
        path: Database file path
        
    Returns:
        Tuple of (created_at, updated_at, updated_by, created_by)
    """
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        now = datetime.now(KST).isoformat()
        
        # Check if note exists
        cur.execute(
            "SELECT created_at, created_by FROM notes WHERE user_id = ? AND pattern = ? AND variant_id = ?",
            (user_id, pattern, variant_id)
        )
        existing = cur.fetchone()
        
        if existing:
            # Update existing note
            created_at = existing[0]  # Keep original creation time
            created_by = existing[1]  # Keep original creator
            cur.execute(
                "UPDATE notes SET note = ?, updated_at = ?, updated_by = ? "
                "WHERE user_id = ? AND pattern = ? AND variant_id = ?",
                (note, now, current_session_user, user_id, pattern, variant_id)
            )
        else:
            # Insert new note
            created_at = now  # Current time is creation time
            created_by = current_session_user  # Current user is the creator
            cur.execute(
                "INSERT INTO notes(user_id, pattern, variant_id, note, created_at, created_by, updated_at, updated_by) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, pattern, variant_id, note, now, current_session_user, now, current_session_user)
            )
        
        conn.commit()
        return (created_at, now, current_session_user, created_by)
    finally:
        conn.close()


def load_notes_v2(
    user_id: str,
    task_ids: List[str],
    path: str = DB_PATH
) -> Dict[str, Tuple[str, str, str, str, str]]:
    """Load notes from new_notes table for V2 schema.
    
    Args:
        user_id: User ID to filter notes
        task_ids: List of MASTER_TASK_IDs
        path: Database file path
        
    Returns:
        Dict mapping task_id to (note, created_at, updated_at, created_by, updated_by)
    """
    if not task_ids or not user_id:
        return {}
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        placeholders = ",".join(["?"] * len(task_ids))
        cur.execute(
            f"SELECT task_id, note, created_at, updated_at, created_by, updated_by FROM new_notes "
            f"WHERE user_id = ? AND task_id IN ({placeholders})",
            (user_id, *task_ids)
        )
        rows = cur.fetchall()
        return {
            str(r[0]): (
                (r[1] or ""),
                (r[2] or ""),
                (r[3] or ""),
                (r[4] or ""),
                (r[5] or "")
            ) for r in rows
        }
    finally:
        conn.close()


def save_note_v2(
    user_id: str,
    task_id: str,
    note: str,
    current_session_user: str,
    path: str = DB_PATH
) -> Tuple[str, str, str, str]:
    """Save note to new_notes table for V2 schema.
    
    Args:
        user_id: Owner user ID
        task_id: MASTER_TASK_ID
        note: Note content
        current_session_user: Current session user ID (who is making this change)
        path: Database file path
        
    Returns:
        Tuple of (created_at, updated_at, updated_by, created_by)
    """
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        now = datetime.now(KST).isoformat()
        
        # Check if note exists
        cur.execute(
            "SELECT created_at, created_by FROM new_notes WHERE user_id = ? AND task_id = ?",
            (user_id, task_id)
        )
        existing = cur.fetchone()
        
        if existing:
            # Update existing note
            created_at = existing[0]  # Keep original creation time
            created_by = existing[1]  # Keep original creator
            cur.execute(
                "UPDATE new_notes SET note = ?, updated_at = ?, updated_by = ? "
                "WHERE user_id = ? AND task_id = ?",
                (note, now, current_session_user, user_id, task_id)
            )
        else:
            # Insert new note
            created_at = now  # Current time is creation time
            created_by = current_session_user  # Current user is the creator
            cur.execute(
                "INSERT INTO new_notes(user_id, task_id, note, created_at, created_by, updated_at, updated_by) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, task_id, note, now, current_session_user, now, current_session_user)
            )
        
        conn.commit()
        return (created_at, now, current_session_user, created_by)
    finally:
        conn.close()


def reset_notes_table(path: str = DB_PATH) -> None:
    """Drop and recreate notes table with new schema. DANGEROUS: deletes all notes."""
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS notes")
        cur.execute(
            """
            CREATE TABLE notes (
                user_id TEXT NOT NULL,
                pattern TEXT NOT NULL,
                variant_id TEXT NOT NULL,
                note TEXT,
                created_at TEXT,
                created_by TEXT,
                updated_at TEXT,
                updated_by TEXT,
                PRIMARY KEY (user_id, pattern, variant_id)
            )
            """
        )
        conn.commit()
    finally:
        conn.close()
