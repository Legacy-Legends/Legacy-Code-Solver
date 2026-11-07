"""Run `python -m backend.analysis --help` from the repository root."""
import argparse
import json
from pathlib import Path
from . import calculate_metrics, export_graph, generate_mock_graph, graph_model, parse_repo, to_frontend_graph


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a mock graph or analyze Java")
    parser.add_argument("--repo", help="Java repository path; omit for the synthetic fixture")
    parser.add_argument("--output", default="backend/analysis/fixtures/graph.json")
    parser.add_argument("--frontend-output", help="Also write the current frontend contract")
    args = parser.parse_args()
    if args.repo:
        graph = calculate_metrics(parse_repo(args.repo))
        export_graph(graph, args.output)
        model = graph_model(graph)
    else:
        model = generate_mock_graph(args.output)
    if args.frontend_output:
        path = Path(args.frontend_output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(to_frontend_graph(model), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(model.nodes)} nodes, {len(model.edges)} edges; health={model.overall_health}")


if __name__ == "__main__":
    main()
