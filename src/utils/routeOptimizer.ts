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

function nearestNeighborTSP(nodes: Node[]): Node[] {
  if (nodes.length <= 1) return nodes;

  const unvisited = [...nodes];
  const route: Node[] = [];
  let current = unvisited.shift()!;
  route.push(current);

  while (unvisited.length > 0) {
    let nearest = unvisited[0];
    let nearestDistance = euclideanDistance(current, nearest);

    for (let i = 1; i < unvisited.length; i++) {
      const distance = euclideanDistance(current, unvisited[i]);
      if (distance < nearestDistance) {
        nearest = unvisited[i];
        nearestDistance = distance;
      }
    }

    route.push(nearest);
    const index = unvisited.indexOf(nearest);
    unvisited.splice(index, 1);
    current = nearest;
  }

  return route;
}

export function optimizeRoute(nodes: Node[]): Node[] {
  if (nodes.length <= 2) return nodes;
  return nearestNeighborTSP(nodes);
}
