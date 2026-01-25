interface Node {
  id: string;
  lat: number;
  lng: number;
}

function euclideanDistance(node1: Node, node2: Node): number {
  const dx = node1.lng - node2.lng;
  const dy = node1.lat - node2.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

function insertionHeuristic(nodes: Node[]): Node[] {
  if (nodes.length <= 2) return nodes;

  const unvisited = [...nodes];
  const route: Node[] = [];

  const first = unvisited.shift()!;
  const second = unvisited.shift()!;
  route.push(first, second);

  while (unvisited.length > 0) {
    const newNode = unvisited.shift()!;
    let bestInsertionIndex = route.length;
    let minAddedDistance = Infinity;

    for (let i = 0; i < route.length - 1; i++) {
      const current = route[i];
      const next = route[i + 1];

      const originalDistance = euclideanDistance(current, next);
      const newDistance =
        euclideanDistance(current, newNode) + euclideanDistance(newNode, next);
      const addedDistance = newDistance - originalDistance;

      if (addedDistance < minAddedDistance) {
        minAddedDistance = addedDistance;
        bestInsertionIndex = i + 1;
      }
    }

    const insertAtStartDistance = euclideanDistance(newNode, route[0]);
    if (insertAtStartDistance < minAddedDistance) {
      minAddedDistance = insertAtStartDistance;
      bestInsertionIndex = 0;
    }

    const insertAtEndDistance = euclideanDistance(route[route.length - 1], newNode);
    if (insertAtEndDistance < minAddedDistance) {
      minAddedDistance = insertAtEndDistance;
      bestInsertionIndex = route.length;
    }

    route.splice(bestInsertionIndex, 0, newNode);
  }

  return route;
}

export function optimizeRoute(nodes: Node[]): Node[] {
  if (nodes.length <= 2) return nodes;
  return insertionHeuristic(nodes);
}
