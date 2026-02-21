const MEMORY_SERVER_URL = process.env.MEMORY_SERVER_URL || "http://localhost:8000";
const NAMESPACE = "24agents";
const TIMEOUT_MS = 2000;

async function memoryFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${MEMORY_SERVER_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function isMemoryServerAvailable(): Promise<boolean> {
  try {
    const res = await memoryFetch("/v1/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function putWorkingMemory(
  sessionId: string,
  data: {
    messages: { role: string; content: string }[];
  },
): Promise<void> {
  try {
    await memoryFetch(`/v1/working-memory/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: data.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        namespace: NAMESPACE,
      }),
    });
  } catch {
    // Fail silently — memory server is optional
  }
}

export async function getWorkingMemory(
  sessionId: string,
): Promise<{ messages: { role: string; content: string }[] } | null> {
  try {
    const res = await memoryFetch(`/v1/working-memory/${sessionId}?namespace=${NAMESPACE}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteWorkingMemory(sessionId: string): Promise<void> {
  try {
    await memoryFetch(`/v1/working-memory/${sessionId}?namespace=${NAMESPACE}`, {
      method: "DELETE",
    });
  } catch {
    // Fail silently
  }
}

export async function createLongTermMemory(
  memories: {
    text: string;
    session_id?: string;
    namespace?: string;
    user_id?: string;
  }[],
): Promise<void> {
  try {
    await memoryFetch("/v1/long-term-memory/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memories: memories.map((m) => ({
          ...m,
          namespace: m.namespace || NAMESPACE,
        })),
        deduplicate: true,
      }),
    });
  } catch {
    // Fail silently
  }
}

export async function searchLongTermMemory(
  text: string,
  opts: { namespace?: string; limit?: number; session_id?: string } = {},
): Promise<{ memories: unknown[]; total: number }> {
  try {
    const res = await memoryFetch("/v1/long-term-memory/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        namespace: opts.namespace || NAMESPACE,
        limit: opts.limit || 10,
        session_id: opts.session_id,
      }),
    });
    if (!res.ok) return { memories: [], total: 0 };
    return await res.json();
  } catch {
    return { memories: [], total: 0 };
  }
}

export async function getMemoryPrompt(
  query: string,
  sessionId?: string,
): Promise<{ role: string; content: string }[] | null> {
  try {
    const body: Record<string, unknown> = {
      query,
      long_term_search: {
        text: query,
        namespace: NAMESPACE,
        limit: 5,
      },
    };
    if (sessionId) {
      body.session = { session_id: sessionId, namespace: NAMESPACE };
    }

    const res = await memoryFetch("/v1/memory/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.messages ?? null;
  } catch {
    return null;
  }
}
