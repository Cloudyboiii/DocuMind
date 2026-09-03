const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";

function getSessionId() {
  if (typeof window === "undefined") return "default";
  let sessionId = localStorage.getItem("documind_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("documind_session_id", sessionId);
  }
  return sessionId;
}

async function request(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set("X-Session-ID", getSessionId());

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/api/upload", { method: "POST", body: formData });
}

export async function queryDocument(question: string) {
  return request("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export async function getDocuments() {
  return request("/api/documents");
}

export async function deleteDocument(documentId: string) {
  return request(`/api/documents/${documentId}`, { method: "DELETE" });
}

export async function healthCheck() {
  return request("/api/health");
}
