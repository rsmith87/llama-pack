# Models Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `models` database for GGUF assets and model records, persist GGUF `model_line` classification there, and establish durable links between downloads, discovered assets, and configured models.

**Architecture:** Introduce a new `models` persistence target, keep YAML as the active launch-config source for now, and refactor the GGUF library to upsert discovered files into the asset store before projecting API payloads. A `models` table will link configured models to GGUF assets now, with schema room for eventual migration of model config out of YAML later. The GGUF library page should eventually read from this database as its primary backend source.

**Tech Stack:** FastAPI, SQLAlchemy ORM, Alembic multi-target migrations, Pydantic config models, React/Vitest for GGUF Library UI verification, existing downloads persistence store.

---

## File Structure

- Create: `llama_pack/core/persistence/model_asset_store_orm.py`
- Create: `llama_pack/core/persistence/models/model_asset.py`
- Create: `llama_pack/core/model_assets/models_db.py`
- Create: `migrations/versions/models/`
- Create: `tests/test_model_asset_store.py`
- Create: `tests/test_models_db_integration.py`
- Modify: `llama_pack/core/persistence/alembic_config.py`
- Modify: `llama_pack/core/persistence/db_infra.py`
- Modify: `llama_pack/core/config/models.py`
- Modify: `llama_pack/core/config/io.py`
- Modify: `llama_pack/main.py`
- Modify: `llama_pack/api/dependencies.py`
- Modify: `llama_pack/core/model_assets/library.py`
- Modify: `llama_pack/api/routes/library.py`
- Modify: `tests/test_api.py`
- Modify: `tests/test_gguf_library.py`
- Modify: `frontend/src/api/library.ts`
- Modify: `frontend/src/pages/GgufLibraryPage/index.tsx`
- Modify: `frontend/src/test/page-tests/GgufLibraryPage.test.tsx`
- Modify: `config.example.yaml`
- Modify: `docs/configuration.md`

### Task 1: Add Models DB Target And ORM Schema

**Files:**
- Modify: `llama_pack/core/persistence/alembic_config.py`
- Modify: `llama_pack/core/persistence/db_infra.py`
- Create: `llama_pack/core/persistence/models/model_asset.py`
- Create: `llama_pack/core/persistence/model_asset_store_orm.py`
- Create: `migrations/versions/models/<revision>_create_model_asset_and_models_tables.py`
- Test: `tests/test_model_asset_store.py`

- [x] **Step 1: Write failing store tests for `model_assets` and `models` table CRUD**
- [x] **Step 2: Run the focused test and verify the new store/module is missing**
- [x] **Step 3: Add a new `models` DB target to persistence URL resolution and Alembic target definitions**
- [x] **Step 4: Define ORM tables for GGUF assets and model records with indexes on path, asset id, model name, and download linkage**
- [x] **Step 5: Implement a focused ORM store with create/upsert/list/update methods for assets and model links**
- [x] **Step 6: Add the Alembic migration for the new target and verify the ORM store test passes**
- [x] **Step 7: Commit**

### Task 2: Add Config Surface For The Models DB

**Files:**
- Modify: `llama_pack/core/config/models.py`
- Modify: `llama_pack/core/config/io.py`
- Modify: `config.example.yaml`
- Modify: `docs/configuration.md`
- Test: `tests/test_config.py`

- [x] **Step 1: Write failing config tests for a new `models_db_url` field and split-config persistence behavior**
- [x] **Step 2: Run the focused config tests and verify the field is missing**
- [x] **Step 3: Add `models_db_url` to `AppConfig` and wire it into grouped persistence config loading/saving**
- [x] **Step 4: Document the new DB URL in the example config and configuration docs**
- [x] **Step 5: Run focused config tests and verify they pass**
- [x] **Step 6: Commit**

### Task 3: Build Models DB Domain Service

**Files:**
- Create: `llama_pack/core/model_assets/models_db.py`
- Modify: `llama_pack/main.py`
- Modify: `llama_pack/api/dependencies.py`
- Test: `tests/test_models_db_integration.py`

- [x] **Step 1: Write failing integration tests for scan-time asset creation, repeated scan upsert, and missing-file marking**
- [x] **Step 2: Run the focused test and verify the models DB service is missing**
- [x] **Step 3: Implement a domain service that reconciles GGUF scan results into asset rows using canonical path first, with future-ready fields for content hash and download provenance**
- [x] **Step 4: Register the models DB store/service in app state and dependency wiring**
- [x] **Step 5: Run the focused integration tests and verify they pass**
- [x] **Step 6: Commit**

### Task 4: Refactor GGUF Library To Use Models DB Inventory

**Files:**
- Modify: `llama_pack/core/model_assets/library.py`
- Modify: `tests/test_gguf_library.py`
- Modify: `tests/test_api.py`

- [x] **Step 1: Write failing tests showing `list_files()` returns stable `asset_id`-backed metadata and preserves rows across repeated scans**
- [x] **Step 2: Run the focused GGUF library tests and verify current filesystem-only behavior fails**
- [x] **Step 3: Refactor `GgufLibrary` to upsert scanned GGUF files into the `model_assets` store before building payloads**
- [x] **Step 4: Prefer persisted asset metadata such as `model_line` while still enriching responses with live runtime/config status**
- [x] **Step 5: Run the focused GGUF library and API tests and verify they pass**
- [x] **Step 6: Commit**

### Task 5: Persist Model-To-Asset Links During Add/Update/Delete Flows

**Files:**
- Modify: `llama_pack/core/model_assets/library.py`
- Modify: `llama_pack/core/config/models.py`
- Modify: `tests/test_gguf_library.py`
- Modify: `tests/test_api.py`

- [x] **Step 1: Write failing tests for add-model linking an asset to a configured model record**
- [x] **Step 2: Run the focused tests and verify no model record link is created today**
- [x] **Step 3: Extend add/update/remove/delete GGUF workflows to maintain `models` rows and asset links while keeping YAML launch config behavior intact**
- [x] **Step 4: Add an optional `model_line` field to `ModelConfig` for future parity, without switching launch reads to DB**
- [x] **Step 5: Run focused backend tests and verify they pass**
- [x] **Step 6: Commit**

### Task 6: Add Backend API For GGUF Asset Reclassification

**Files:**
- Modify: `llama_pack/api/routes/library.py`
- Modify: `llama_pack/api/dependencies.py`
- Modify: `tests/test_api.py`

- [x] **Step 1: Write failing API tests for updating an asset `model_line` and re-reading it through `/library/ggufs`**
- [x] **Step 2: Run the focused API tests and verify the reclassification route is missing**
- [x] **Step 3: Add a typed backend route to update GGUF asset metadata by `asset_id` or file id**
- [x] **Step 4: Make GGUF list responses include persisted `model_line` and stable `asset_id` fields**
- [x] **Step 5: Run focused API tests and verify they pass**
- [x] **Step 6: Commit**

### Task 7: Wire The GGUF Library Frontend To Persist Reclassification

**Files:**
- Modify: `frontend/src/api/library.ts`
- Modify: `frontend/src/pages/GgufLibraryPage/index.tsx`
- Modify: `frontend/src/test/page-tests/GgufLibraryPage.test.tsx`

- [x] **Step 1: Write failing frontend tests showing `Reclassify` performs a backend call and survives refresh**
- [x] **Step 2: Run the focused page test and verify current frontend-only override behavior fails**
- [x] **Step 3: Replace local-only line override state with backend-backed reclassification updates and refreshes**
- [x] **Step 4: Keep navigator selection behavior unchanged: only explicit `Add` opens the modal**
- [x] **Step 5: Run focused frontend tests and verify they pass**
- [x] **Step 6: Commit**

### Task 8: Add Download Linkage To Models DB Assets

**Files:**
- Modify: `llama_pack/core/model_assets/downloads.py`
- Modify: `llama_pack/core/persistence/model_download_store_orm.py`
- Modify: `llama_pack/core/model_assets/models_db.py`
- Modify: `tests/test_downloads.py`
- Modify: `tests/test_models_db_integration.py`

- [x] **Step 1: Write failing tests for linking completed downloads to asset rows through stored provenance**
- [x] **Step 2: Run the focused tests and verify download linkage is absent**
- [x] **Step 3: Persist enough provenance to reconcile download records with assets: `download_id`, repo id, revision, source filename, and local path**
- [x] **Step 4: Update asset upsert logic to attach download linkage when available**
- [x] **Step 5: Run focused tests and verify they pass**
- [x] **Step 6: Commit**

### Task 9: Verification And Migration Safety Pass

**Files:**
- Modify only if verification exposes a concrete issue.

- [x] **Step 1: Run focused backend tests for config, GGUF library, downloads, and models DB store**
- [x] **Step 2: Run the full Python test suite**
- [x] **Step 3: Run focused frontend tests for GGUF Library**
- [x] **Step 4: Run the full frontend test suite**
- [x] **Step 5: Verify Alembic upgrades for the new `models` target alongside existing targets**
- [x] **Step 6: Build the frontend**
- [x] **Step 7: Commit only if verification required fixes**

## Self-Review

- Spec coverage: This plan covers a new `models` DB target, scan-created asset identity, persisted GGUF classification, download linkage, and future-ready model records without moving runtime topology config out of YAML.
- Scope: This is intentionally a hybrid architecture, not a full config-to-DB migration.
- Type consistency: The design uses `asset_id` as the primary cross-system link and keeps downloads and model records as related but distinct domains.
- Placeholder scan: No `TBD` or deferred ownership markers remain in the task structure.
