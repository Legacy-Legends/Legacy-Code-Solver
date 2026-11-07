"""ENG-1 Java parser: class-level dependencies, without Java type resolution."""
import logging
from pathlib import Path
from typing import Iterator

import networkx as nx
from tree_sitter import Language, Node as ASTNode, Parser
import tree_sitter_java

from .models import Node

logger = logging.getLogger(__name__)
DECLARATIONS = {"class_declaration", "interface_declaration", "enum_declaration", "record_declaration", "annotation_type_declaration"}
DECISIONS = {"if_statement", "for_statement", "enhanced_for_statement", "while_statement", "do_statement", "catch_clause", "ternary_expression"}
PRIORITY = {"imports": 0, "calls": 1, "implements": 2, "extends": 3}


def walk(node: ASTNode) -> Iterator[ASTNode]:
    stack = [node]
    while stack:
        current = stack.pop()
        yield current
        stack.extend(reversed(current.named_children))


def text(node: ASTNode) -> str:
    return node.text.decode("utf-8") if node.text else ""


def class_contents(node: ASTNode) -> Iterator[ASTNode]:
    """Nested types own their methods and decisions, not their enclosing class."""
    stack = list(reversed(node.named_children))
    while stack:
        child = stack.pop()
        if child.type not in DECLARATIONS:
            yield child
            stack.extend(reversed(child.named_children))


def parse_repo(repo_path: str) -> nx.DiGraph:
    """Parse sorted Java files, recording diagnostics for skipped files.

    Stable IDs are package-qualified class names (nested classes use dots).
    Import and inheritance relationships are supported; only explicit class-
    qualified calls are resolved in ENG-1. Instance dispatch, overload resolution,
    wildcard external imports and reflection are intentionally not guessed.
    """
    root = Path(repo_path).resolve()
    if not root.is_dir():
        raise ValueError(f"Not a repository directory: {root}")
    parser = Parser(Language(tree_sitter_java.language()))
    graph = nx.DiGraph()
    graph.graph["diagnostics"] = []
    records = []
    for path in sorted(root.rglob("*.java")):
        if path.is_symlink() or any(p in {".git", "build", "target", "node_modules"} for p in path.relative_to(root).parts):
            continue
        relative = path.relative_to(root).as_posix()
        try:
            source = path.read_bytes()
            source.decode("utf-8")
            tree = parser.parse(source)
            if tree.root_node.has_error:
                raise ValueError("Java syntax errors")
        except (OSError, UnicodeError, ValueError) as exc:
            diagnostic = {"path": relative, "error": str(exc)}
            graph.graph["diagnostics"].append(diagnostic)
            logger.warning("Skipping %s: %s", relative, exc)
            continue
        package = ""
        imports = []
        for item in tree.root_node.named_children:
            if item.type == "package_declaration":
                package = text(item).removeprefix("package").strip().rstrip(";").strip()
            elif item.type == "import_declaration":
                value = text(item).removeprefix("import").strip().rstrip(";").strip()
                if value.startswith("static "):
                    value = value.removeprefix("static ").rsplit(".", 1)[0]
                imports.append(value)
        for declaration in walk(tree.root_node):
            if declaration.type not in DECLARATIONS:
                continue
            name_node = declaration.child_by_field_name("name")
            if name_node is None:
                continue
            names = [text(name_node)]
            parent = declaration.parent
            while parent:
                if parent.type in DECLARATIONS:
                    outer = parent.child_by_field_name("name")
                    if outer:
                        names.insert(0, text(outer))
                parent = parent.parent
            node_id = ".".join(([package] if package else []) + names)
            if node_id in graph:
                graph.graph["diagnostics"].append({"path": relative, "error": f"Duplicate class ID: {node_id}"})
                continue
            contents = list(class_contents(declaration))
            methods = [text(n.child_by_field_name("name")) for n in contents
                       if n.type in {"method_declaration", "constructor_declaration"} and n.child_by_field_name("name")]
            complexity = len(methods) + sum(n.type in DECISIONS for n in contents)
            complexity += sum(n.type == "binary_expression" and any(c.type in {"&&", "||"} for c in n.children) for n in contents)
            complexity += sum(n.type == "switch_label" and not text(n).startswith("default") for n in contents)
            data = Node(id=node_id, name=names[-1], path=relative,
                        loc=declaration.end_point.row - declaration.start_point.row + 1,
                        complexity=complexity).model_dump()
            graph.add_node(node_id, **data, methods=methods, imports=imports)
            records.append((node_id, package, imports, declaration, contents))

    internal = set(graph)

    def resolve(name: str, package: str, imports: list[str], owner: str) -> str | None:
        if name in internal:
            return name
        # Lexical enclosing types, then explicit imports and same package.
        scope = owner
        while scope and scope != package:
            if f"{scope}.{name}" in internal:
                return f"{scope}.{name}"
            scope = scope.rpartition(".")[0]
        matches = [imp for imp in imports if not imp.endswith(".*") and imp.rsplit(".", 1)[-1] == name]
        if len(matches) == 1:
            return matches[0]
        local = f"{package}.{name}" if package else name
        if local in internal:
            return local
        wildcard = [f"{imp[:-2]}.{name}" for imp in imports if imp.endswith(".*") and f"{imp[:-2]}.{name}" in internal]
        if len(wildcard) == 1:
            return wildcard[0]
        return name if "." in name and name.split(".")[0][:1].islower() else None

    def connect(source: str, target: str, kind: str) -> None:
        if source == target:
            return  # intra-class method calls are not inter-class cycles
        if target not in graph:
            graph.add_node(target, **Node(id=target, name=target.rsplit(".", 1)[-1], path="", type="external").model_dump())
        old = graph.get_edge_data(source, target)
        if old:
            old["weight"] += 1.0
            if PRIORITY[kind] > PRIORITY[old["type"]]:
                old["type"] = kind
        else:
            graph.add_edge(source, target, type=kind, weight=1.0)

    for owner, package, imports, declaration, contents in records:
        for imported in imports:
            if not imported.endswith(".*"):
                connect(owner, imported, "imports")
        for child in declaration.named_children:
            if child.type in {"superclass", "super_interfaces", "extends_interfaces"}:
                kind = "implements" if child.type == "super_interfaces" else "extends"
                # Top-level generic type names only; type arguments are not parents.
                candidates = child.named_children
                if candidates and candidates[0].type == "type_list":
                    candidates = candidates[0].named_children
                for candidate in candidates:
                    name = text(candidate).split("<", 1)[0].strip()
                    target = resolve(name, package, imports, owner)
                    if target:
                        connect(owner, target, kind)
        for item in contents:
            if item.type == "method_invocation":
                receiver = item.child_by_field_name("object")
                if receiver:
                    name = text(receiver)
                    # Only class-qualified receivers; variable receivers need a symbol table.
                    if name.rsplit(".", 1)[-1][:1].isupper():
                        target = resolve(name, package, imports, owner)
                        if target:
                            connect(owner, target, "calls")
    return graph
