import type { BikeStatus, BikeType, StationStatus, SupportImportance, SupportStatus } from './admin/types'

const API_PATH_PREFIX = '/api/v1'
const API_BASE_URL = (import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export function buildApiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

export function buildAuthHeaders(token: string) {
  const normalizedToken = token.trim().toLowerCase().startsWith('bearer ')
    ? token.trim()
    : `Bearer ${token.trim()}`

  return {
    Authorization: normalizedToken,
  }
}

export function buildJsonAuthHeaders(token: string) {
  return {
    ...buildAuthHeaders(token),
    'Content-Type': 'application/json',
  }
}

export function buildSupportTicketStatusEndpoint(id: string) {
  return buildApiUrl(`${API_PATH_PREFIX}/admin/support/tickets/${encodeURIComponent(id)}/status`)
}

export function buildSupportTicketPriorityEndpoint(id: string) {
  return buildApiUrl(`${API_PATH_PREFIX}/admin/support/tickets/${encodeURIComponent(id)}/priority`)
}

export function toApiSupportStatus(status: SupportStatus) {
  if (status === 'in_progress') {
    return 'IN_PROGRESS'
  }

  return status.toUpperCase()
}

export function toApiSupportPriority(priority: SupportImportance) {
  return priority.toUpperCase()
}

export function buildPuestosEndpoint() {
  return buildApiUrl(`${API_PATH_PREFIX}/puestos`)
}

export function buildPuestoUpdateEndpoint(id: string) {
  return buildApiUrl(`${API_PATH_PREFIX}/puestos/${encodeURIComponent(id)}`)
}

export function buildPuestoStatusEndpoint(id: string, status: StationStatus) {
  const nuevoEstado = encodeURIComponent(toApiStationStatus(status))
  return buildApiUrl(`${API_PATH_PREFIX}/puestos/${encodeURIComponent(id)}/estado?nuevoEstado=${nuevoEstado}`)
}

export function buildBicicletasSinPuestoEndpoint() {
  return buildApiUrl(`${API_PATH_PREFIX}/bicicletas/sin-puesto`)
}

export function buildBicicletasEndpoint() {
  return buildApiUrl(`${API_PATH_PREFIX}/bicicletas`)
}

export function buildBicicletaUpdateEndpoint(id: string) {
  return buildApiUrl(`${API_PATH_PREFIX}/bicicletas/${encodeURIComponent(id)}`)
}

export function toApiStationStatus(status: StationStatus) {
  if (status === 'active') {
    return 'ACTIVO'
  }
  if (status === 'inactive') {
    return 'INACTIVO'
  }
  return 'MANTENIMIENTO'
}

export function toApiBikeType(type: BikeType) {
  if (type === 'Montana') {
    return 'MONTAÑA'
  }
  if (type === 'Electrica') {
    return 'ELECTRICA'
  }
  return 'URBANA'
}

export function toApiBikeStatus(status: BikeStatus) {
  if (status === 'available') {
    return 'DISPONIBLE'
  }
  if (status === 'in_use') {
    return 'EN_USO'
  }
  if (status === 'maintenance') {
    return 'MANTENIMIENTO'
  }
  if (status === 'out_of_service') {
    return 'FUERA_DE_SERVICIO'
  }
  return 'RESERVADA'
}

export const LOGIN_ENDPOINT = buildApiUrl(`${API_PATH_PREFIX}/auth/login`)
export const SUPPORT_TICKETS_ENDPOINT = buildApiUrl(`${API_PATH_PREFIX}/admin/support/tickets`)
