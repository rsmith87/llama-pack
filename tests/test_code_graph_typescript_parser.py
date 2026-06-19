from __future__ import annotations

from llama_pack.core.code_graph.typescript_parser import parse_typescript_files


def test_typescript_parser_extracts_component_hook_interface_and_jsx(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    child = src / "Child.tsx"
    child.write_text("export function Child(): JSX.Element { return <span />; }\n", encoding="utf-8")
    app = src / "App.tsx"
    app.write_text(
        "import { Child } from './Child';\n"
        "export interface AppProps { title: string }\n"
        "export function useThing(): string { return 'ok'; }\n"
        "export function App(props: AppProps): JSX.Element { return <Child />; }\n",
        encoding="utf-8",
    )

    parsed = parse_typescript_files(root=tmp_path, files=[app, child])

    names = {symbol.name for file in parsed.files for symbol in file.symbols}
    assert {"App", "AppProps", "useThing", "Child"}.issubset(names)
    assert any(relation.relation_type == "component_uses" for file in parsed.files for relation in file.relations)


def test_typescript_parser_generates_unique_component_relation_ids_on_same_line(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    child = src / "Child.tsx"
    child.write_text("export function Child(): JSX.Element { return <span />; }\n", encoding="utf-8")
    app = src / "App.tsx"
    app.write_text(
        "import { Child } from './Child';\n"
        "export function App(): JSX.Element { return <><Child /><Child /></>; }\n",
        encoding="utf-8",
    )

    parsed = parse_typescript_files(root=tmp_path, files=[app, child])

    relation_ids = [
        relation.id
        for file in parsed.files
        for relation in file.relations
        if relation.relation_type == "component_uses"
    ]
    assert len(relation_ids) == 2
    assert len(set(relation_ids)) == 2
