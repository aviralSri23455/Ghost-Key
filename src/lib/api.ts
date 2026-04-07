export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function apiUrl(path: string) {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `${API_BASE_URL}/${normalized}`;
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    const preview = text.trim().slice(0, 120) || "<empty response>";
    throw new Error(
      `Expected JSON from ${response.url}, received ${contentType || "unknown content type"} instead. Response started with: ${preview}`,
    );
  }

  if (!text.trim()) {
    throw new Error(`Expected JSON from ${response.url}, but the response body was empty.`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Invalid JSON from ${response.url}: ${message}`);
  }
}
