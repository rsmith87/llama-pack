# Alembic migrations

This project uses one Alembic environment with multiple DB targets.

Targets:
- `controller`
- `auth`
- `audit`
- `chat_sessions`
- `downloads`
- `benchmarks`

Baseline branches:
- `controller@head` -> `20260513_0001` controller baseline
- `auth@head` -> `20260513_0002` auth baseline
- `audit@head` -> `20260513_0003` audit baseline
- `chat_sessions@head` -> `20260513_0004` chat sessions baseline
- `downloads@head` -> `20260523_0001` downloads baseline
- `benchmarks@head` -> `20260611_0004` benchmark runs plus tool-loop eval history

Choose a target with `-x db=<target>`.

Examples:

```bash
# Show current revision for controller DB
alembic -x db=controller current

# Generate a revision in a target-specific versions folder
alembic -x db=auth revision -m "auth baseline" --version-path migrations/versions/auth

# Upgrade a specific target to its branch head
alembic -x db=audit upgrade audit@head

# Upgrade downloads and benchmarks stores
alembic -x db=downloads upgrade downloads@head
alembic -x db=benchmarks upgrade benchmarks@head

# Downgrade one step for chat sessions target
alembic -x db=chat_sessions downgrade -1

# Stamp an existing DB at the target branch head
alembic -x db=controller stamp controller@head
```

Default target when `-x db=` is omitted is `controller`. Use target-qualified heads such as `auth@head`; unqualified `head` is ambiguous because each target has its own branch.

## Fresh install workflow

For normal controller setup, prefer:

```bash
scripts/onboard_controller.sh
```

That script runs all fresh-install migration targets before creating the first
admin API key. Run the commands below only when handling migrations manually.

Run this once per target database:

```bash
alembic -x db=controller upgrade controller@head
alembic -x db=auth upgrade auth@head
alembic -x db=audit upgrade audit@head
alembic -x db=chat_sessions upgrade chat_sessions@head
alembic -x db=downloads upgrade downloads@head
alembic -x db=benchmarks upgrade benchmarks@head
```

## Existing install workflow

For pre-Alembic databases already created by legacy stores:

```bash
alembic -x db=controller stamp controller@head
alembic -x db=auth stamp auth@head
alembic -x db=audit stamp audit@head
alembic -x db=chat_sessions stamp chat_sessions@head
alembic -x db=downloads stamp downloads@head
alembic -x db=benchmarks stamp benchmarks@head

alembic -x db=controller upgrade controller@head
alembic -x db=auth upgrade auth@head
alembic -x db=audit upgrade audit@head
alembic -x db=chat_sessions upgrade chat_sessions@head
alembic -x db=downloads upgrade downloads@head
alembic -x db=benchmarks upgrade benchmarks@head
```
