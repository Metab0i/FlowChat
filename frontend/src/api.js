const API_BASE = "";

export async function detectKey(apiKey) {
  const res = await fetch(`${API_BASE}/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Key detection failed (${res.status})`);
  }
  return data;
}

export async function fetchDefaultPrompt() {
  const res = await fetch(`${API_BASE}/defaults/system-prompt`);
  if (!res.ok) {
    throw new Error(`Failed to load default prompt (${res.status})`);
  }
  return res.text();
}

export async function fetchDefaultPersonality() {
  const res = await fetch(`${API_BASE}/defaults/personality`);
  if (!res.ok) {
    throw new Error(`Failed to load default personality (${res.status})`);
  }
  return res.text();
}

export async function fetchTitle(apiKey, model, content, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, model, content }),
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

export async function streamGenerate(apiKey, model, systemPrompt, conversation, onChunk) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, model, system_prompt: systemPrompt, conversation }),
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
