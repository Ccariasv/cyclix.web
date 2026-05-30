export async function parseResponsePayload(response: Response) {
  const isJson = response.headers.get('content-type')?.includes('application/json')
  return isJson ? ((await response.json()) as unknown) : await response.text()
}

export function getApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const response = payload as Record<string, unknown>
  const message = response.message ?? response.error ?? response.detail

  return typeof message === 'string' && message.trim() ? message : null
}

export function ensureOk(response: Response, payload: unknown, fallback: string) {
  if (response.ok) {
    return
  }

  throw new Error(getApiErrorMessage(payload) ?? fallback)
}

export function extractCollection(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const queue: unknown[] = [
    (payload as Record<string, unknown>).data,
    (payload as Record<string, unknown>).items,
    (payload as Record<string, unknown>).results,
    (payload as Record<string, unknown>).content,
    (payload as Record<string, unknown>).records,
    (payload as Record<string, unknown>).users,
    (payload as Record<string, unknown>).trips,
    (payload as Record<string, unknown>).transactions,
  ]

  while (queue.length > 0) {
    const current = queue.shift()

    if (Array.isArray(current)) {
      return current
    }

    if (current && typeof current === 'object') {
      const record = current as Record<string, unknown>
      queue.push(
        record.data,
        record.items,
        record.results,
        record.content,
        record.records,
        record.users,
        record.trips,
        record.transactions,
      )
    }
  }

  return null
}

export function readNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[segment]
  }, source)
}

export function getStringValue(source: Record<string, unknown>, paths: string[], fallback = '') {
  for (const path of paths) {
    const value = readNestedValue(source, path)

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return fallback
}

export function getNumberValue(source: Record<string, unknown>, paths: string[], fallback: number | null = null) {
  for (const path of paths) {
    const value = readNestedValue(source, path)

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)

      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return fallback
}

export function getBooleanValue(source: Record<string, unknown>, paths: string[], fallback = false) {
  for (const path of paths) {
    const value = readNestedValue(source, path)

    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'string') {
      if (value.trim().toLowerCase() === 'true') {
        return true
      }

      if (value.trim().toLowerCase() === 'false') {
        return false
      }
    }
  }

  return fallback
}
