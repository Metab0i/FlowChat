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
  const history = [];

  function process(currentNode) {
    if (!currentNode) return;

    const incomers = getIncomers(currentNode.id, nodes, edges);
    const entry = {
      id: currentNode.id,
      role: currentNode.type === "userInput" ? "user" : "assistant",
      parent: [...incomers],
      content: currentNode.text || "",
      children: [],
    };

    if (node.id !== currentNode.id) {
      entry.children = getOutgoers(currentNode.id, nodes, edges);
    }

    history.unshift(entry);

    for (const inc of incomers) {
      process(nodes.get(inc));
    }
  }

  process(node);
  return history;
}
