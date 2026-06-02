from __future__ import annotations

import argparse
from pathlib import Path

from llama_manager.core.config import load_config
from llama_manager.core.persistence.auth_store_orm import AuthStoreOrm
from llama_manager.core.persistence.db_infra import resolve_persistence_urls


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m llama_manager.auth")
    parser.add_argument(
        "--config",
        help="Path to a Neuraxis config file. Defaults to NEURAXIS_CONFIG/config.yaml/config.example.yaml.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    create_admin = subcommands.add_parser("create-admin", help="Create an admin API key for UI login and API access.")
    create_admin.add_argument("username")
    create_test_chat = subcommands.add_parser(
        "create-test-chat-key",
        help="Create a scoped API key for the no-login routed chat test page.",
    )
    create_test_chat.add_argument("--username", default="test-chat")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = load_config(Path(args.config) if args.config else None)
    urls = resolve_persistence_urls(config)
    store = AuthStoreOrm(db_url=urls.auth)

    if args.command == "create-admin":
        created = store.create_key(args.username, "admin")
        print(f"Created admin key for {created['username']}")
        print(f"Key ID: {created['id']}")
        print(f"API key: {created['key']}")
        print("Store this key now; it will not be shown again.")
        return 0

    if args.command == "create-test-chat-key":
        created = store.create_key(args.username, "test_chat")
        print(f"Created test chat key for {created['username']}")
        print(f"Key ID: {created['id']}")
        print(f"API key: {created['key']}")
        print("Set NEURAXIS_TEST_CHAT_API_KEY to this value for /ui/test-chat bootstrap injection.")
        print("Store this key now; it will not be shown again by the auth database.")
        return 0

    return 2


if __name__ == "__main__":
    raise SystemExit(main())
