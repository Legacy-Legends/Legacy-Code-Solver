# Two-minute pitch

## Opening (0:00-0:20)

Legacy systems run critical businesses, but engineers often cannot answer a
simple question safely: “What breaks if this component goes down?” AETHER
turns an unfamiliar Java codebase into a living dependency map.

## Demo (0:20-1:20)

1. Start the frontend and API with `.\scripts\run-api.ps1`.
2. Show the 3D graph and health-colored nodes.
3. Ask an impact question such as “What breaks if UserAuth goes down?”
4. Point out the matched nodes, blast percentage, and affected domains.
5. Open a modernization proposal and show its rationale and diff.
6. Apply it and show the health score increase.

## Technical proof (1:20-1:45)

The graph and health metrics are deterministic. The agent resolves language
but does not invent graph numbers. The platform uses typed Pydantic contracts,
dependency injection, WebSockets, and a checked-in offline cache so the demo
still works without network access.

## Closing (1:45-2:00)

AETHER makes legacy modernization explainable: map the risk, preview the
change, and improve the system one safe approval at a time.
