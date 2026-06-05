from pathlib import Path

from fastapi.testclient import TestClient

from llama_manager.main import create_app
from llama_manager.api.routes import ui


REACT_PAGE_ROUTES = [
    "/ui/",
    "/ui/chat",
    "/ui/nodes",
    "/ui/gguf-library",
    "/ui/hf-to-gguf",
    "/ui/hf-downloads",
    "/ui/quantization",
    "/ui/controller-ops",
    "/ui/embeddings",
    "/ui/audit",
    "/ui/api-keys",
    "/ui/benchmarks",
    "/ui/runtime",
    "/ui/plugins",
    "/ui/plugins/hello_plugin",
    "/ui/plugins/hello_plugin/settings",
    "/ui/setup",
    "/ui/settings",
    "/ui/test-chat",
]


def test_index_serves_react_build(monkeypatch, tmp_path):
    ui_dir = tmp_path / "ui"
    ui_dir.mkdir(parents=True)
    (ui_dir / "index.html").write_text("<html><body>react build</body></html>", encoding="utf-8")
    monkeypatch.setattr(ui, "UI_DIR", ui_dir)

    response = ui.index()

    assert Path(response.path) == ui_dir / "index.html"


def test_index_path_returns_ui_index(monkeypatch, tmp_path):
    ui_dir = tmp_path / "ui"
    ui_dir.mkdir(parents=True)
    monkeypatch.setattr(ui, "UI_DIR", ui_dir)

    assert ui.index_path() == ui_dir / "index.html"


def test_favicon_returns_empty_response():
    response = ui.favicon()

    assert response.status_code == 204


def test_static_app_does_not_require_built_ui_at_import_time():
    assert Path(ui.static_app.directory) == ui.UI_DIR


def test_index_reports_missing_react_build(monkeypatch, tmp_path):
    ui_dir = tmp_path / "missing-ui"
    monkeypatch.setattr(ui, "UI_DIR", ui_dir)

    response = ui.index()

    assert response.status_code == 503
    assert "UI build not found" in response.body.decode("utf-8")


def test_react_page_routes_fall_back_to_index(monkeypatch, tmp_path):
    ui_dir = tmp_path / "ui"
    ui_dir.mkdir(parents=True)
    (ui_dir / "index.html").write_text("<html><body>react build</body></html>", encoding="utf-8")
    monkeypatch.setattr(ui, "UI_DIR", ui_dir)
    monkeypatch.setattr(ui, "static_app", ui.ReactStaticFiles(directory=ui_dir))
    app = create_app()
    client = TestClient(app)

    for path in REACT_PAGE_ROUTES:
        response = client.get(path)

        assert response.status_code == 200
        assert "react build" in response.text


def test_react_asset_routes_still_use_static_files(monkeypatch, tmp_path):
    ui_dir = tmp_path / "ui"
    assets_dir = ui_dir / "assets"
    assets_dir.mkdir(parents=True)
    (ui_dir / "index.html").write_text("<html><body>react build</body></html>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('asset');", encoding="utf-8")
    monkeypatch.setattr(ui, "UI_DIR", ui_dir)
    monkeypatch.setattr(ui, "static_app", ui.ReactStaticFiles(directory=ui_dir))
    app = create_app()
    client = TestClient(app)

    response = client.get("/ui/assets/app.js")

    assert response.status_code == 200
    assert "console.log('asset');" in response.text
