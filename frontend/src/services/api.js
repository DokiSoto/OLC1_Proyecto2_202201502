const API = '/api';

export function validateResult(result) {
  if (
    !result ||
    typeof result !== 'object' ||
    typeof result.success !== 'boolean'
  ) {
    throw new Error(
      'El motor devolvió una respuesta inválida. Revisa vite.config.js.'
    );
  }

  for (const key of ['console', 'errors', 'tokens', 'symbols', 'log']) {
    if (!Array.isArray(result[key])) {
      throw new Error(
        `La respuesta del motor está incompleta: falta '${key}'.`
      );
    }
  }

  const infrastructure = result.infrastructure;

  if (
    !infrastructure ||
    !['servers', 'services', 'databases', 'connections'].every(
      (key) => Array.isArray(infrastructure[key])
    )
  ) {
    throw new Error(
      'La respuesta del motor no contiene todos los reportes de infraestructura.'
    );
  }

  if (typeof result.durationMs !== 'number') {
    throw new Error(
      'La respuesta del motor no contiene el tiempo de ejecución.'
    );
  }

  return result;
}

export async function analyzeCode(source, execute = true) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, 35000);

  try {
    const response = await fetch(
      `${API}/${execute ? 'execute' : 'analyze'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source }),
        signal: controller.signal,
      }
    );

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        `La API devolvió una respuesta que no es JSON (HTTP ${response.status}). ` +
        'Revisa vite.config.js y reinicia el frontend.'
      );
    }

    if (!response.ok) {
      throw new Error(
        result.message || `La solicitud falló con HTTP ${response.status}.`
      );
    }

    return validateResult(result);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'La operación superó el límite de 35 segundos. Revisa los ciclos y la recursión.'
      );
    }

    if (
      error instanceof TypeError &&
      /fetch|network/i.test(error.message)
    ) {
      throw new Error(
        'No se pudo conectar con la API de Vite. Reinicia el servidor del frontend.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function downloadFile(
  name,
  text,
  mime = 'text/plain;charset=utf-8'
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = name;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}