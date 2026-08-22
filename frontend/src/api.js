const API_BASE = "";

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) {
    throw new Error(`Failed to fetch models (${res.status})`);
  }
  const data = await res.json();
  return data.models || [];
}

export async function fetchTitle(model, content, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, content }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch title (${res.status})`);
    }
    const data = await res.json();
    return data.title || "";
  } finally {
    clearTimeout(timer);
  }
}

export async function streamGenerate(model, conversation, onChunk) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, conversation }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to start generation (${res.status}): ${body}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function processBuffer() {
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (line) {
        const data = JSON.parse(line.slice(5).trim());
        if (data.error) {
          throw new Error(data.error);
        }
        if (data.content === "[DONE]") {
          return true;
        }
        onChunk(data.content);
      }

      boundary = buffer.indexOf("\n\n");
    }
    return false;
  }

  while (true) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    if (processBuffer()) return;
    if (done) {
      buffer += decoder.decode();
      if (processBuffer()) return;
      break;
    }
  }
}
