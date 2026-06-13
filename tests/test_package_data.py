import tomllib
from pathlib import Path


def test_package_data_includes_react_build_assets():
    pyproject = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
    assert pyproject["project"]["name"] == "llama-pack"

    packages = pyproject["tool"]["setuptools"]["packages"]["find"]["include"]
    assert "llama_pack*" in packages

    package_data = pyproject["tool"]["setuptools"]["package-data"]["llama_pack"]

    assert "ui/*" in package_data
    assert "ui/assets/*" in package_data
    assert "core/model_assets/*.json" in package_data
