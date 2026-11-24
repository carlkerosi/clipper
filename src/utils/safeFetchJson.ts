export async function parseJsonResponse<T = any>(
  response: Response,
  fallbackErrorPrefix = 'Request failed'
): Promise<T> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!') ||
    trimmed.toLowerCase().startsWith('<html');

  if (looksLikeHtml) {
    if (response.status === 413) {
      throw new Error(
        'Video file or payload is too large for a single request. Try a smaller file or shorter clip.'
      );
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(
        `Server timed out or was temporarily unavailable (HTTP ${response.status}). Please retry in a moment.`
      );
    }
    throw new Error(
      `${fallbackErrorPrefix}: Server returned an unexpected HTML page (HTTP ${response.status}). Please retry.`
    );
  }

  if (!trimmed) {
    if (!response.ok) {
      throw new Error(`${fallbackErrorPrefix} (HTTP ${response.status})`);
    }
    return {} as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (!response.ok) {
      throw new Error(`${fallbackErrorPrefix} (HTTP ${response.status}): ${trimmed.slice(0, 140)}`);
    }
    throw new Error(`${fallbackErrorPrefix}: Invalid JSON received from server.`);
  }
}
