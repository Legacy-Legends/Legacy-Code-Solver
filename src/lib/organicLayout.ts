import { GraphNode } from '../types';

/** Stable, organic module neighborhoods with rectangular collision clearance.
 * Layout runs only when the graph changes; manual drags remain authoritative.
 */
export function organicLayout(nodes: GraphNode[], cardWidth: number, cardHeight: number) {
  const groups = [...new Set(nodes.map(node => node.clusterId))].sort();
  const counts = new Map<string, number>();
  const points = [...nodes].sort((a, b) => a.id.localeCompare(b.id)).map(node => {
    const groupIndex = groups.indexOf(node.clusterId);
    const index = counts.get(node.clusterId) || 0;
    counts.set(node.clusterId, index + 1);
    const hash = [...node.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
    const angle = index * 2.399963 + (hash % 100) / 130;
    const radius = Math.sqrt(index + 0.5) * 110;
    const groupAngle = groupIndex * 2.399963;
    const groupRadius = groups.length === 1 ? 0 : Math.sqrt(groupIndex + 1) * 300;
    return { id: node.id, x: Math.cos(groupAngle) * groupRadius + Math.cos(angle) * radius * 1.6,
      y: Math.sin(groupAngle) * groupRadius + Math.sin(angle) * radius };
  });
  // Resolve overlaps along the least-displacement axis, leaving room for arrowheads.
  for (let iteration = 0; iteration < 200; iteration++) {
    let collided = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const overlapX = cardWidth + 42 - Math.abs(dx);
        const overlapY = cardHeight + 40 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        collided = true;
        if (overlapX < overlapY) {
          const shift = (overlapX / 2 + 0.1) * (dx >= 0 ? 1 : -1);
          a.x -= shift; b.x += shift;
        } else {
          const shift = (overlapY / 2 + 0.1) * (dy >= 0 ? 1 : -1);
          a.y -= shift; b.y += shift;
        }
      }
    }
    if (!collided) break;
  }
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / (points.length || 1);
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / (points.length || 1);
  return new Map(points.map(point => [point.id, { x: point.x - centerX, y: point.y - centerY }]));
}
