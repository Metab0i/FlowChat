export function getOutgoers(nodeId, nodes, edges) {
  const out = [];
  for (const e of edges.values()) {
    if (e.source === nodeId) out.push(e.target);
  }
  return out;
}

export function getIncomers(nodeId, nodes, edges) {
  const inc = [];
  for (const e of edges.values()) {
    if (e.target === nodeId) inc.push(e.source);
  }
  return inc;
}

export function findAllDescendants(nodeId, nodes, edges) {
  const result = [];
  const stack = [...getOutgoers(nodeId, nodes, edges)];
  while (stack.length) {
    const id = stack.pop();
    if (result.includes(id)) continue;
    result.push(id);
    for (const o of getOutgoers(id, nodes, edges)) stack.push(o);
  }
  return result;
}

export function findAllPrecedents(nodeId, nodes, edges) {
  const result = [];
  const stack = [...getIncomers(nodeId, nodes, edges)];
  while (stack.length) {
    const id = stack.pop();
    if (result.includes(id)) continue;
    result.push(id);
    for (const i of getIncomers(id, nodes, edges)) stack.push(i);
  }
  return result;
}

export function getConversationHistory(node, nodes, edges) {
  const included = new Set();
  const order = [];

  function visit(currentNode) {
    if (!currentNode || included.has(currentNode.id)) return;
    included.add(currentNode.id);

    for (const inc of getIncomers(currentNode.id, nodes, edges)) {
      visit(nodes.get(inc));
    }

    order.push(currentNode);
  }

  visit(node);

  const depth = new Map([[node.id, 0]]);
  const queue = [node.id];
  while (queue.length) {
    const cur = queue.shift();
    const next = depth.get(cur) + 1;
    for (const inc of getIncomers(cur, nodes, edges)) {
      if (!depth.has(inc)) {
        depth.set(inc, next);
        queue.push(inc);
      }
    }
  }

  return order.map((n) => ({
    id: n.id,
    role: n.type === "userInput" ? "user" : "assistant",
    parent: getIncomers(n.id, nodes, edges).filter((id) => included.has(id)),
    content: n.text || "",
    children:
      n.id === node.id
        ? []
        : getOutgoers(n.id, nodes, edges).filter((id) => included.has(id)),
    depth: depth.has(n.id) ? depth.get(n.id) : 0,
  }));
}
