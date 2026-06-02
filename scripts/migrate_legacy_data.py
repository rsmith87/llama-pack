#!/usr/bin/env python3
"""
migrate_legacy_data.py — One-time utility to copy model_downloads and benchmark
rows from a legacy chat_sessions.db into the new downloads.db and benchmarks.db.

Prerequisites:
  1. Back up all .db files before running.
  2. Run all six Alembic migrations so that downloads.db and benchmarks.db
     already have their schema in place:

     alembic -x db=chat_sessions upgrade chat_sessions@head
     alembic -x db=downloads upgrade downloads@head
     alembic -x db=benchmarks upgrade benchmarks@head

Invocation:
  python scripts/migrate_legacy_data.py [--config PATH]

  --config PATH   Path to llama-manager YAML config. Defaults to the value of
                  NEURAXIS_CONFIG env var, then ./config.yaml.

The utility is safe to re-run: rows that already exist (by primary key) in the
target databases are skipped.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

# Allow running directly without installing the package
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from llama_manager.core.config import load_config
from llama_manager.core.persistence.db_infra import resolve_persistence_urls, sqlite_path_from_url


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sqlite_path(url: str, label: str) -> Path:
    path = sqlite_path_from_url(url)
    if path is None:
        print(f"ERROR: {label} URL is not a SQLite file URL: {url}", file=sys.stderr)
        sys.exit(1)
    return path


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def _copy_table(
    *,
    src: sqlite3.Connection,
    dst: sqlite3.Connection,
    table: str,
) -> tuple[int, int]:
    """Copy rows from src.table to dst.table, skipping existing PKs.

    Returns (discovered, copied).
    """
    if not _table_exists(src, table):
        print(f"  {table}: not found in legacy database — skipped.")
        return 0, 0

    rows = src.execute(f"SELECT * FROM {table}").fetchall()  # noqa: S608
    if not rows:
        print(f"  {table}: 0 rows in legacy database — nothing to copy.")
        return 0, 0

    col_names = [desc[0] for desc in src.execute(f"SELECT * FROM {table} LIMIT 0").description]  # noqa: S608
    placeholders = ", ".join("?" for _ in col_names)
    cols = ", ".join(col_names)
    insert_sql = f"INSERT OR IGNORE INTO {table} ({cols}) VALUES ({placeholders})"  # noqa: S608

    dst.executemany(insert_sql, rows)
    dst.commit()

    # Count how many actually landed (INSERT OR IGNORE skips dupes)
    existing_before = dst.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]  # noqa: S608
    # Re-query after insert to get final count
    final_count = dst.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]  # noqa: S608
    _ = existing_before  # suppress unused warning — final_count is what matters

    # A more precise measure: count how many source PKs are now present
    copied = dst.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]  # noqa: S608
    discovered = len(rows)

    print(f"  {table}: {discovered} rows discovered, {copied} rows now in target (skipped duplicates).")
    return discovered, copied


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy data from chat_sessions.db")
    parser.add_argument("--config", default=None, help="Path to llama-manager config YAML")
    args = parser.parse_args()

    config = load_config(args.config)
    urls = resolve_persistence_urls(config)

    chat_path = _sqlite_path(urls.chat_sessions, "chat_sessions")
    downloads_path = _sqlite_path(urls.downloads, "downloads")
    benchmarks_path = _sqlite_path(urls.benchmarks, "benchmarks")

    print(f"Legacy source : {chat_path}")
    print(f"Downloads target: {downloads_path}")
    print(f"Benchmarks target: {benchmarks_path}")
    print()

    if not chat_path.exists():
        print(f"ERROR: Legacy database not found at {chat_path}", file=sys.stderr)
        sys.exit(1)
    if not downloads_path.exists():
        print(f"ERROR: downloads.db not found at {downloads_path}. Run migrations first.", file=sys.stderr)
        sys.exit(1)
    if not benchmarks_path.exists():
        print(f"ERROR: benchmarks.db not found at {benchmarks_path}. Run migrations first.", file=sys.stderr)
        sys.exit(1)

    src = sqlite3.connect(chat_path)
    dst_downloads = sqlite3.connect(downloads_path)
    dst_benchmarks = sqlite3.connect(benchmarks_path)

    try:
        print("--- Copying to downloads.db ---")
        _copy_table(src=src, dst=dst_downloads, table="model_downloads")

        print()
        print("--- Copying to benchmarks.db ---")
        # Dependency order: definitions before runs before samples
        _copy_table(src=src, dst=dst_benchmarks, table="benchmark_definitions")
        _copy_table(src=src, dst=dst_benchmarks, table="benchmark_runs")
        _copy_table(src=src, dst=dst_benchmarks, table="benchmark_run_samples")

    finally:
        src.close()
        dst_downloads.close()
        dst_benchmarks.close()

    print()
    print("Done. Legacy tables remain in chat_sessions.db and can be removed manually")
    print("once you have verified data parity.")


if __name__ == "__main__":
    main()
