from __future__ import annotations

from llama_pack.core.agent_tools.live_evals import LiveToolLoopScenario


def default_live_tool_loop_scenarios() -> list[LiveToolLoopScenario]:
    return [
        LiveToolLoopScenario(
            id="live-collaborative-notes-design",
            prompt=(
                "Use the workspace tools to inspect the notes app brief and starter files. "
                "Call search_workspace exactly once with query user_id before writing the design, "
                "so relationship references from the markdown workspace are included. "
                "Create docs/notes-app-design.md with a compact implementation design under 700 words. "
                "The design must include sections named Overview, Data model, API, Frontend, Collaboration, and Risk. "
                "Use 2-3 short bullets per section instead of long tables. "
                "Do not implement registration or account-management flows."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "read_workspace_file",
                "search_workspace",
                "write_notes_app_design",
            ],
            expected_final_substrings=["created", "notes"],
            expected_artifacts=["docs/notes-app-design.md"],
            expected_artifact_substrings={
                "docs/notes-app-design.md": [
                    "Overview",
                    "Data model",
                    "API",
                    "Frontend",
                    "Collaboration",
                    "Risk",
                    "user_id",
                    "note_id",
                    "collaborators",
                    "registration",
                ],
            },
            seed_files={
                "README.md": (
                    "# Collaborative Notes App\n\n"
                    "Create a notes app that allows collaboration between users. "
                    "User account information and registration is not needed. "
                    "Build with future relationships from notes to users using user_id and note_id respectively.\n"
                ),
                "schema-notes.md": (
                    "Entities: users, notes, note_collaborators.\n"
                    "Relationship constraints: notes.user_id, note_collaborators.user_id, note_collaborators.note_id.\n"
                ),
                "api-starter.md": (
                    "Needed API areas: CRUD notes, list notes by user_id, share notes with collaborators, list collaborators by note_id.\n"
                ),
            },
            write_tools={"write_notes_app_design": "docs/notes-app-design.md"},
            search_glob="*.md",
            forbidden_artifact_substrings={
                "docs/notes-app-design.md": [
                    "password",
                    "login form",
                    "signup",
                ],
            },
        ),
        LiveToolLoopScenario(
            id="live-ci-failure-triage",
            prompt=(
                "Use the workspace tools to triage the failing CI run. Search for "
                "test_create_run_requires_model, inspect the CI log, relevant source, and relevant test. "
                "Write docs/ci-triage.md with Root cause, Minimal fix, and Verification sections. "
                "Include the exact failing test name, relevant file path, and command to rerun the focused test. "
                "Do not use unrelated package or frontend notes."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "search_workspace",
                "read_workspace_file",
                "write_ci_triage_report",
            ],
            expected_final_substrings=["triage", "report"],
            expected_artifacts=["docs/ci-triage.md"],
            expected_artifact_substrings={
                "docs/ci-triage.md": [
                    "Root cause",
                    "Minimal fix",
                    "Verification",
                    "tests/test_api.py::test_create_run_requires_model",
                    "llama_pack/api/routes/runs.py",
                    "uv run pytest tests/test_api.py -v",
                ],
            },
            seed_files={
                ".github/workflows/ci.yml": (
                    "name: CI\n"
                    "on: [push]\n"
                    "jobs:\n"
                    "  test:\n"
                    "    runs-on: ubuntu-latest\n"
                    "    steps:\n"
                    "      - uses: actions/checkout@v4\n"
                    "      - run: uv run pytest tests/test_api.py -v\n"
                ),
                "logs/ci-failure.log": (
                    "FAILED tests/test_api.py::test_create_run_requires_model - AssertionError: expected 422, got 200\n"
                    "request payload omitted model but route accepted it\n"
                ),
                "llama_pack/api/routes/runs.py": (
                    "async def create_run(body):\n"
                    "    model = body.get('model')\n"
                    "    return {'status': 'queued', 'model': model}\n"
                ),
                "tests/test_api.py": (
                    "def test_create_run_requires_model(client):\n"
                    "    response = client.post('/lm-api/v1/runs', json={'prompt': 'hello'})\n"
                    "    assert response.status_code == 422\n"
                ),
                "docs/frontend-notes.md": "Frontend bundle cache notes are unrelated to this API validation failure.\n",
                "package-notes.md": "Package publishing notes mention test_create_run_requires_model only as stale migration history.\n",
            },
            write_tools={"write_ci_triage_report": "docs/ci-triage.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/ci-triage.md": ["frontend bundle", "package publishing"]},
            max_iterations=9,
        ),
        LiveToolLoopScenario(
            id="live-config-migration-plan",
            prompt=(
                "Use the workspace tools to compare the existing and target YAML config fixtures. "
                "Search for controller_db_url, read the existing config, target config, and migration notes. "
                "Write docs/config-migration-plan.md with Current state, Migration steps, Compatibility, and Verification sections. "
                "Preserve exact config key names and do not recommend stale legacy_model_path fields."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "search_workspace",
                "read_workspace_file",
                "write_config_migration_plan",
            ],
            expected_final_substrings=["migration", "plan"],
            expected_artifacts=["docs/config-migration-plan.md"],
            expected_artifact_substrings={
                "docs/config-migration-plan.md": [
                    "Current state",
                    "Migration steps",
                    "Compatibility",
                    "Verification",
                    "controller_db_url",
                    "auth_db_url",
                    "agent_tools",
                    "uv run pytest tests/test_persistence_db_infra.py tests/test_alembic_config.py -v",
                ],
            },
            seed_files={
                "fixtures/migration-task7-existing-config.yaml": (
                    "mode: controller\n"
                    "controller_db_url: sqlite:///logs/controller_state.db\n"
                    "auth_db_url: sqlite:///logs/auth_store.db\n"
                    "agent_tools:\n"
                    "  enabled: true\n"
                ),
                "fixtures/migration-task7-config.yaml": (
                    "mode: controller\n"
                    "controller_db_url: sqlite:///data/controller_state.db\n"
                    "auth_db_url: sqlite:///data/auth_store.db\n"
                    "agent_tools:\n"
                    "  enabled: true\n"
                    "  max_iterations: 8\n"
                ),
                "docs/migration-notes.md": (
                    "Keep controller_db_url and auth_db_url explicit. "
                    "Validate with persistence and Alembic config tests. "
                    "legacy_model_path was removed and must not be reintroduced.\n"
                ),
                "docs/stale-config.md": "Old examples mention legacy_model_path and should not be used.\n",
            },
            write_tools={"write_config_migration_plan": "docs/config-migration-plan.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/config-migration-plan.md": ["legacy_model_path"]},
            max_iterations=9,
        ),
        LiveToolLoopScenario(
            id="live-targeted-bugfix-plan",
            prompt=(
                "Use the workspace tools to prepare a targeted bugfix plan. Search for parse_retry_after, "
                "then inspect only the relevant source and test files. Write docs/bugfix-plan.md with "
                "Bug, Minimal patch, Tests, and Risk sections. Avoid broad architecture notes."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "search_workspace",
                "read_workspace_file",
                "write_bugfix_plan",
            ],
            expected_final_substrings=["bugfix", "plan"],
            expected_artifacts=["docs/bugfix-plan.md"],
            expected_artifact_substrings={
                "docs/bugfix-plan.md": [
                    "Bug",
                    "Minimal patch",
                    "Tests",
                    "Risk",
                    "parse_retry_after",
                    "llama_pack/core/runtime/retry.py",
                    "tests/test_retry.py",
                ],
            },
            seed_files={
                "llama_pack/core/runtime/retry.py": (
                    "def parse_retry_after(value: str) -> int:\n"
                    "    return int(value)\n"
                ),
                "tests/test_retry.py": (
                    "def test_parse_retry_after_accepts_http_date():\n"
                    "    assert parse_retry_after('Wed, 21 Oct 2015 07:28:00 GMT') >= 0\n"
                ),
                "docs/architecture.md": "Broad architecture notes are unrelated to this small parser fix.\n",
                "docs/runtime-overview.md": "Runtime overview mentions retries but not parse_retry_after.\n",
            },
            write_tools={"write_bugfix_plan": "docs/bugfix-plan.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/bugfix-plan.md": ["broad architecture", "rewrite runtime"]},
            max_iterations=9,
        ),
        LiveToolLoopScenario(
            id="live-pr-review-findings",
            prompt=(
                "Use the workspace tools to review the proposed change. Inspect the diff, touched source, "
                "and tests. Write docs/pr-review.md with actionable findings ordered by severity. "
                "Do not include style-only comments."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "read_workspace_file",
                "write_pr_review",
            ],
            expected_final_substrings=["review", "findings"],
            expected_artifacts=["docs/pr-review.md"],
            expected_artifact_substrings={
                "docs/pr-review.md": [
                    "P1",
                    "api_key",
                    "llama_pack/auth.py",
                    "tests/test_auth.py",
                    "unauthenticated",
                ],
            },
            seed_files={
                "review/diff.patch": (
                    "diff --git a/llama_pack/auth.py b/llama_pack/auth.py\n"
                    "-    if api_key is None: raise Unauthorized()\n"
                    "+    if api_key is None: return AnonymousUser()\n"
                ),
                "llama_pack/auth.py": (
                    "def require_api_key(api_key):\n"
                    "    if api_key is None:\n"
                    "        return AnonymousUser()\n"
                    "    return validate_key(api_key)\n"
                ),
                "tests/test_auth.py": (
                    "def test_missing_api_key_is_unauthenticated(client):\n"
                    "    assert client.get('/lm-api/v1/runs').status_code == 401\n"
                ),
                "review/style-notes.md": "Line length and import ordering are not actionable for this review.\n",
            },
            write_tools={"write_pr_review": "docs/pr-review.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/pr-review.md": ["line length", "import ordering", "style-only"]},
            max_iterations=8,
        ),
    ]


