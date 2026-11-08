"""Java parser: class-level dependencies with lightweight local type resolution."""
import logging
import re
import subprocess
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
SENSITIVE_PATTERNS = (
    re.compile(r'(?i)(?:select|insert|update|delete)\b[^;]*\+\s*'),
    re.compile(r'(?i)MessageDigest\.getInstance\s*\(\s*"MD5"'),
    re.compile(r'(?i)(?:password|passwd|secret|api[_-]?key)\s*=\s*"[^"]+"'),
    re.compile(r'\b(?:Hashtable|Vector)\b'),
)


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
        relative_parts = path.relative_to(root).parts
        if path.is_symlink() or any(p in {".git", "build", "target", "node_modules"} for p in relative_parts):
            continue
        if len(relative_parts) >= 2 and relative_parts[:2] == ("src", "test"):
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
        churn = _git_churn(root, relative)
        vuln_count = min(5, sum(len(pattern.findall(source.decode("utf-8"))) for pattern in SENSITIVE_PATTERNS))
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
                        churn=churn, vuln_count=vuln_count,
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
        uses_service_locator = any(
            item.type == "method_invocation"
            and item.child_by_field_name("name")
            and text(item.child_by_field_name("name")).startswith("get")
            and item.child_by_field_name("object")
            and item.child_by_field_name("object").type == "method_invocation"
            for item in contents
        )
        for imported in imports:
            if not imported.endswith(".*") and not (uses_service_locator and imported.endswith(".AppContext")):
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
            if item.type == "type_identifier":
                if item.parent and item.parent.type in {
                    "superclass", "super_interfaces", "extends_interfaces", "type_list"
                }:
                    continue
                target = resolve(text(item), package, imports, owner)
                if target:
                    connect(owner, target, "calls")
            elif item.type == "object_creation_expression":
                created_type = item.child_by_field_name("type")
                if created_type:
                    target = resolve(text(created_type), package, imports, owner)
                    if target:
                        connect(owner, target, "calls")
            if item.type == "method_invocation":
                method_name = item.child_by_field_name("name")
                receiver = item.child_by_field_name("object")
                if method_name and text(method_name).startswith("get") and receiver and receiver.type == "method_invocation":
                    getter_target = resolve(text(method_name)[3:], package, imports, owner)
                    if getter_target:
                        connect(owner, getter_target, "calls")
                if method_name and text(method_name) == "getInstance" and item.parent and item.parent.type == "method_invocation":
                    continue
                if receiver:
                    name = text(receiver)
                    # Only simple class-qualified receivers; chained calls and fields
                    # are handled by their own AST nodes.
                    if receiver.type in {"identifier", "scoped_identifier"} and name.rsplit(".", 1)[-1][:1].isupper():
                        target = resolve(name, package, imports, owner)
                        if target:
                            connect(owner, target, "calls")
    return graph


def _git_churn(root: Path, relative: str) -> int:
    """Return file commit count when the uploaded checkout includes Git history."""
    git_dir = root / ".git"
    if not git_dir.exists():
        return 0
    result = subprocess.run(
        ["git", "-C", str(root), "log", "--format=%H", "--", relative],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        logger.warning("Unable to read Git churn for %s: %s", relative, result.stderr.strip())
        return 0
    return len([line for line in result.stdout.splitlines() if line])
