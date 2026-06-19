#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "../frontend/node_modules/typescript/lib/typescript.js";

function parseArgs(argv) {
  const args = { root: "", files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") {
      args.root = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--file") {
      args.files.push(argv[index + 1] ?? "");
      index += 1;
    }
  }
  if (!args.root) throw new Error("--root is required");
  if (args.files.length === 0) throw new Error("at least one --file is required");
  return args;
}

function stableId(...parts) {
  return createHash("sha1").update(parts.join("|")).digest("hex");
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function lineSpan(sourceFile, node) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return { startLine: start.line + 1, endLine: end.line + 1 };
}

function hasExportModifier(node) {
  return Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function symbolKind(name, fallback) {
  if (fallback === "function" && /^use[A-Z0-9]/.test(name)) return "hook";
  if (/^[A-Z]/.test(name) && fallback === "function") return "component";
  return fallback;
}

function textUntil(sourceFile, node, token) {
  const text = node.getText(sourceFile);
  const index = text.indexOf(token);
  return (index >= 0 ? text.slice(0, index) : text).trim();
}

function addSymbol(symbols, sourceFile, fileId, relative, node, name, kind, exported, signature) {
  const span = lineSpan(sourceFile, node);
  symbols.push({
    id: stableId("symbol", relative, name, String(span.startLine)),
    file_id: fileId,
    qualified_name: `${relative.replace(/\.[^.]+$/, "").replaceAll("/", ".")}.${name}`,
    name,
    kind,
    language: "typescript",
    start_line: span.startLine,
    end_line: span.endLine,
    signature,
    doc_summary: null,
    exported,
    confidence: 1,
  });
}

function importNameFromBinding(binding) {
  if (ts.isIdentifier(binding)) return binding.text;
  return binding.getText();
}

function recordImports(sourceFile, fileId, relative, imports) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) {
      imports.push({
        id: stableId("import", relative, module, clause.name.text, "default"),
        file_id: fileId,
        module,
        imported_name: "default",
        alias: clause.name.text,
        resolved_file_id: null,
        confidence: 1,
      });
    }
    const namedBindings = clause.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const element of namedBindings.elements) {
      imports.push({
        id: stableId("import", relative, module, element.propertyName?.text ?? element.name.text, element.name.text),
        file_id: fileId,
        module,
        imported_name: element.propertyName?.text ?? element.name.text,
        alias: element.propertyName ? element.name.text : null,
        resolved_file_id: null,
        confidence: 1,
      });
    }
  }
}

function recordTopLevelSymbols(sourceFile, fileId, relative, symbols) {
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      addSymbol(symbols, sourceFile, fileId, relative, statement, statement.name.text, "interface", hasExportModifier(statement), textUntil(sourceFile, statement, "{"));
    } else if (ts.isTypeAliasDeclaration(statement)) {
      addSymbol(symbols, sourceFile, fileId, relative, statement, statement.name.text, "type", hasExportModifier(statement), textUntil(sourceFile, statement, "="));
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      addSymbol(symbols, sourceFile, fileId, relative, statement, name, symbolKind(name, "function"), hasExportModifier(statement), textUntil(sourceFile, statement, "{"));
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      addSymbol(symbols, sourceFile, fileId, relative, statement, statement.name.text, "class", hasExportModifier(statement), textUntil(sourceFile, statement, "{"));
    } else if (ts.isVariableStatement(statement)) {
      recordVariableSymbols(sourceFile, fileId, relative, statement, symbols);
    }
  }
}

function recordVariableSymbols(sourceFile, fileId, relative, statement, symbols) {
  const exported = hasExportModifier(statement);
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) continue;
    const initializer = declaration.initializer;
    if (!initializer || (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))) continue;
    const name = declaration.name.text;
    addSymbol(symbols, sourceFile, fileId, relative, statement, name, symbolKind(name, "function"), exported, textUntil(sourceFile, statement, "="));
  }
}

function enclosingNamedSymbol(node) {
  let current = node.parent;
  while (current) {
    if ((ts.isFunctionDeclaration(current) || ts.isClassDeclaration(current)) && current.name) return current.name.text;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    current = current.parent;
  }
  return null;
}

function recordJsxRelations(sourceFile, fileId, relative, symbols, relations) {
  const symbolIdsByName = new Map(symbols.map((symbol) => [symbol.name, symbol.id]));
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      if (/^[A-Z]/.test(tag)) {
        const span = lineSpan(sourceFile, node);
        const sourceName = enclosingNamedSymbol(node);
        relations.push({
          id: stableId("relation", relative, "component_uses", tag, String(span.startLine)),
          source_symbol_id: sourceName ? symbolIdsByName.get(sourceName) ?? null : null,
          target_symbol_id: symbolIdsByName.get(tag) ?? null,
          source_file_id: fileId,
          target_file_id: null,
          relation_type: "component_uses",
          start_line: span.startLine,
          end_line: span.endLine,
          confidence: symbolIdsByName.has(tag) ? 0.8 : 0.5,
          evidence: { component: tag },
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function parseFile(root, filePath) {
  const absolute = path.resolve(filePath);
  const relative = relativePath(root, absolute);
  const fileId = stableId("file", relative);
  const content = fs.readFileSync(absolute, "utf8");
  const sourceKind = relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(absolute, content, ts.ScriptTarget.Latest, true, sourceKind);
  const symbols = [];
  const imports = [];
  const relations = [];
  recordImports(sourceFile, fileId, relative, imports);
  recordTopLevelSymbols(sourceFile, fileId, relative, symbols);
  recordJsxRelations(sourceFile, fileId, relative, symbols, relations);
  return { path: relative, file_id: fileId, symbols, imports, relations, parse_error: null };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  const files = args.files.map((filePath) => {
    try {
      return parseFile(root, filePath);
    } catch (error) {
      const absolute = path.resolve(filePath);
      const relative = relativePath(root, absolute);
      return {
        path: relative,
        file_id: stableId("file", relative),
        symbols: [],
        imports: [],
        relations: [],
        parse_error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  process.stdout.write(JSON.stringify({ files }));
}

main();
