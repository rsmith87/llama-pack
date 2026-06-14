from pathlib import Path

import pytest

from llama_pack.core.config import load_config
from llama_pack.main import create_app
from tests.persistence_db_setup import prepare_all_persistence_dbs


def test_app_start_fails_when_model_catalog_db_is_unavailable(tmp_path: Path):
    prepare_all_persistence_dbs(tmp_path)
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models_db_url": "sqlite+pysqlite:////missing-parent/state/models.db",
        }
    )

    with pytest.raises(RuntimeError, match="DB-authoritative model persistence requires a working database"):
        create_app(config=config)


def test_app_start_succeeds_with_zero_registered_models(tmp_path: Path):
    prepare_all_persistence_dbs(tmp_path)
    config = load_config({"mode": "agent", "log_dir": str(tmp_path)})

    app = create_app(config=config)

    assert app.state.model_asset_store is not None
    assert app.state.model_catalog_service is not None
