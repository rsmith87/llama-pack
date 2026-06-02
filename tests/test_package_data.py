import tomllib
from pathlib import Path


def test_package_data_includes_react_build_assets():
    pyproject = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
    package_data = pyproject["tool"]["setuptools"]["package-data"]["llama_manager"]

    assert "ui/*" in package_data
    assert "ui/assets/*" in package_data
