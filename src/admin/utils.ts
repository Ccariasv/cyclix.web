import {
  ADMIN_SECTION_STORAGE_KEY,
  BIKE_SERIAL_COUNTER_STORAGE_KEY,
  DEFAULT_CENTER,
  STORAGE_KEY,
  adminNav,
  bikeStatusOptions,
  maintenanceStatusOptions,
  stationStatusOptions,
  supportImportanceOptions,
  supportStatusOptions,
  supportTypeOptions,
} from './constants'
import type {
  ActivityItem,
  AdminData,
  AdminSection,
  Bike,
  BikeStatus,
  BikeType,
  MaintenanceItem,
  MaintenanceStatus,
  MarkerTone,
  Station,
  StationStatus,
  SupportImportance,
  SupportStatus,
  SupportTicket,
  SupportTicketType,
} from './types'

function readNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[segment]
  }, source)
}

function getFirstString(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = readNestedValue(source, path)

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ''
}

function normalizeSupportTypeValue(value: unknown): SupportTicketType {
  if (typeof value !== 'string') {
    return 'other'
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (
    normalized === 'bike_issue' ||
    normalized === 'station_issue' ||
    normalized === 'payment_issue' ||
    normalized === 'account_access' ||
    normalized === 'safety_report' ||
    normalized === 'other'
  ) {
    return normalized
  }

  if (normalized.includes('bike') || normalized.includes('bicycle') || normalized.includes('cycle')) {
    return 'bike_issue'
  }

  if (normalized.includes('station') || normalized.includes('dock') || normalized.includes('anchor')) {
    return 'station_issue'
  }

  if (
    normalized.includes('payment') ||
    normalized.includes('pay') ||
    normalized.includes('charge') ||
    normalized.includes('billing') ||
    normalized.includes('refund')
  ) {
    return 'payment_issue'
  }

  if (
    normalized.includes('account') ||
    normalized.includes('access') ||
    normalized.includes('login') ||
    normalized.includes('password') ||
    normalized.includes('session')
  ) {
    return 'account_access'
  }

  if (
    normalized.includes('safety') ||
    normalized.includes('security') ||
    normalized.includes('incident') ||
    normalized.includes('accident') ||
    normalized.includes('theft')
  ) {
    return 'safety_report'
  }

  return 'other'
}

function normalizeSupportStatusValue(value: unknown): SupportStatus {
  if (typeof value !== 'string') {
    return 'open'
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (normalized === 'resolved' || normalized === 'closed' || normalized === 'done' || normalized === 'solved') {
    return 'resolved'
  }

  if (
    normalized === 'in_progress' ||
    normalized === 'progress' ||
    normalized === 'review' ||
    normalized === 'in_review' ||
    normalized === 'under_review' ||
    normalized === 'processing'
  ) {
    return 'in_progress'
  }

  return 'open'
}

function normalizeSupportImportanceValue(value: unknown): SupportImportance {
  if (typeof value !== 'string') {
    return 'medium'
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (
    normalized === 'high' ||
    normalized === 'important' ||
    normalized === 'critical' ||
    normalized === 'urgent' ||
    normalized === 'severe'
  ) {
    return 'high'
  }

  if (normalized === 'low' || normalized === 'minor') {
    return 'low'
  }

  return 'medium'
}

function normalizeDateValue(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return fallback
}

export function createEmptyAdminData(): AdminData {
  return {
    stations: [],
    bikes: [],
    maintenance: [],
    support: [],
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function getNowIso() {
  return new Date().toISOString()
}

export function formatBikeSerial(sequence: number) {
  return `CX-BIKE-${sequence.toString().padStart(4, '0')}`
}

export function extractBikeSerialSequence(value: string) {
  const match = value.match(/(\d+)(?!.*\d)/)
  return match ? Number(match[1]) : null
}

export function getHighestBikeSerialSequence(bikes: Array<Partial<Bike> & Record<string, unknown>>) {
  return bikes.reduce((highest, bike) => {
    const rawValue =
      typeof bike.serialNumber === 'string' && bike.serialNumber.trim()
        ? bike.serialNumber
        : typeof bike.code === 'string' && bike.code.trim()
          ? bike.code
          : ''
    const sequence = rawValue ? extractBikeSerialSequence(rawValue) : null

    return sequence !== null && Number.isFinite(sequence) ? Math.max(highest, sequence) : highest
  }, 0)
}

export function getNextBikeSerialSequence(bikes: Bike[]) {
  const highestExisting = getHighestBikeSerialSequence(bikes as Array<Partial<Bike> & Record<string, unknown>>)

  if (typeof window === 'undefined') {
    return highestExisting + 1
  }

  const storedValue = Number(window.localStorage.getItem(BIKE_SERIAL_COUNTER_STORAGE_KEY) ?? '0')
  return Math.max(highestExisting + 1, Number.isFinite(storedValue) ? storedValue : 1, 1)
}

export function peekNextBikeSerial(bikes: Bike[]) {
  return formatBikeSerial(getNextBikeSerialSequence(bikes))
}

export function reserveNextBikeSerial(bikes: Bike[]) {
  const nextSequence = getNextBikeSerialSequence(bikes)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BIKE_SERIAL_COUNTER_STORAGE_KEY, String(nextSequence + 1))
  }

  return formatBikeSerial(nextSequence)
}

function normalizeBikeStatus(value: unknown): BikeStatus {
  if (value === 'available' || value === 'DISPONIBLE') {
    return 'available'
  }
  if (value === 'in_use' || value === 'EN_USO') {
    return 'in_use'
  }
  if (value === 'maintenance' || value === 'MANTENIMIENTO') {
    return 'maintenance'
  }
  if (value === 'reserved' || value === 'RESERVADA') {
    return 'reserved'
  }
  if (value === 'out_of_service' || value === 'FUERA_DE_SERVICIO' || value === 'low_battery' || value === 'LOW_BATTERY') {
    return 'out_of_service'
  }

  return 'available'
}

function normalizeBikeType(value: unknown): BikeType {
  if (value === 'Montana' || value === 'MONTAÑA' || value === 'MONTANA') {
    return 'Montana'
  }
  if (value === 'Electrica' || value === 'ELECTRICA') {
    return 'Electrica'
  }

  return 'Urbana'
}

function normalizeStationStatus(value: unknown, fallbackActive = true): StationStatus {
  if (value === 'active' || value === 'ACTIVO') {
    return 'active'
  }
  if (value === 'inactive' || value === 'INACTIVO') {
    return 'inactive'
  }
  if (value === 'maintenance' || value === 'MANTENIMIENTO') {
    return 'maintenance'
  }

  return fallbackActive ? 'active' : 'inactive'
}

export function normalizeBikes(rawBikes: unknown[]) {
  const usedSerials = new Set<string>()
  let nextFallbackSequence = getHighestBikeSerialSequence(
    rawBikes as Array<Partial<Bike> & Record<string, unknown>>,
  ) + 1

  return rawBikes.map((rawBike) => {
    const bike = rawBike as Partial<Bike> & Record<string, unknown>
    const now = getNowIso()
    const preferredSerial =
      typeof bike.serialNumber === 'string' && bike.serialNumber.trim()
        ? bike.serialNumber.trim().toUpperCase()
        : typeof bike.code === 'string' && bike.code.trim()
          ? bike.code.trim().toUpperCase()
          : ''

    let serialNumber = preferredSerial

    if (!serialNumber || usedSerials.has(serialNumber)) {
      while (usedSerials.has(formatBikeSerial(nextFallbackSequence))) {
        nextFallbackSequence += 1
      }

      serialNumber = formatBikeSerial(nextFallbackSequence)
      nextFallbackSequence += 1
    }

    usedSerials.add(serialNumber)

    return {
      id: typeof bike.id === 'string' && bike.id.trim() ? bike.id : generateId('bike'),
      code: serialNumber,
      serialNumber,
      color: typeof bike.color === 'string' && bike.color.trim() ? bike.color.trim() : 'Azul',
      size: typeof bike.size === 'string' && bike.size.trim() ? bike.size.trim() : 'Mediana',
      bikeType: normalizeBikeType(
        typeof bike.bikeType === 'string' && bike.bikeType.trim()
          ? bike.bikeType.trim()
          : bike.tipoBicicleta,
      ),
      battery: clamp(typeof bike.battery === 'number' ? bike.battery : 100, 0, 100),
      status: normalizeBikeStatus(bike.status ?? bike.estado),
      stationId: typeof bike.stationId === 'string' && bike.stationId.trim() ? bike.stationId : null,
      lat: clamp(typeof bike.lat === 'number' ? bike.lat : DEFAULT_CENTER[0], -90, 90),
      lng: clamp(typeof bike.lng === 'number' ? bike.lng : DEFAULT_CENTER[1], -180, 180),
      notes: typeof bike.notes === 'string' ? bike.notes : '',
      isActive: bike.isActive !== false,
      createdAt: typeof bike.createdAt === 'string' && bike.createdAt ? bike.createdAt : now,
      updatedAt: typeof bike.updatedAt === 'string' && bike.updatedAt ? bike.updatedAt : now,
    } satisfies Bike
  })
}

export function normalizeStations(rawStations: unknown[]) {
  return rawStations.map((rawStation) => {
    const station = rawStation as Partial<Station> & Record<string, unknown>
    const now = getNowIso()
    const status = normalizeStationStatus(station.status ?? station.estado, station.isActive !== false)

    return {
      id: typeof station.id === 'string' && station.id.trim() ? station.id : generateId('station'),
      name: typeof station.name === 'string' && station.name.trim() ? station.name.trim() : 'Puesto',
      zone: typeof station.zone === 'string' ? station.zone.trim() : '',
      capacity: clamp(typeof station.capacity === 'number' ? station.capacity : 10, 1, 500),
      lat: clamp(typeof station.lat === 'number' ? station.lat : DEFAULT_CENTER[0], -90, 90),
      lng: clamp(typeof station.lng === 'number' ? station.lng : DEFAULT_CENTER[1], -180, 180),
      status,
      isActive: status === 'active',
      createdAt: typeof station.createdAt === 'string' && station.createdAt ? station.createdAt : now,
      updatedAt: typeof station.updatedAt === 'string' && station.updatedAt ? station.updatedAt : now,
    } satisfies Station
  })
}

export function normalizeMaintenance(rawMaintenance: unknown[]) {
  return rawMaintenance.map((rawItem) => {
    const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Partial<MaintenanceItem> &
      Record<string, unknown>
    const now = getNowIso()

    return {
      id: getFirstString(item, ['id', '_id', 'maintenanceId', 'maintenance_id']) || generateId('maint'),
      bikeId: getFirstString(item, ['bikeId', 'bike_id', 'bicicletaId', 'bicicleta_id']) || '',
      supportTicketId: getFirstString(item, ['supportTicketId', 'support_ticket_id', 'ticketId', 'ticket_id']) || undefined,
      title: getFirstString(item, ['title', 'titulo', 'subject', 'name']) || 'Mantenimiento',
      technician: getFirstString(item, ['technician', 'tecnico', 'assignedTechnician', 'assigned_technician']),
      notes: getFirstString(item, ['notes', 'notas', 'description', 'detail', 'details', 'comment']),
      status:
        item.status === 'open' || item.status === 'in_progress' || item.status === 'resolved'
          ? item.status
          : 'open',
      createdAt: normalizeDateValue(
        readNestedValue(item, 'createdAt') ?? readNestedValue(item, 'created_at'),
        now,
      ),
      updatedAt: normalizeDateValue(
        readNestedValue(item, 'updatedAt') ?? readNestedValue(item, 'updated_at'),
        now,
      ),
    } satisfies MaintenanceItem
  })
}

export function normalizeSupport(rawTickets: unknown[]) {
  return rawTickets.map((rawTicket) => {
    const ticket = (rawTicket && typeof rawTicket === 'object' ? rawTicket : {}) as Partial<SupportTicket> &
      Record<string, unknown>
    const now = getNowIso()

    return {
      id: getFirstString(ticket, ['id', '_id', 'ticketId', 'ticket_id']) || generateId('ticket'),
      subject:
        getFirstString(ticket, ['subject', 'title', 'issue', 'reason', 'summary']) || 'Ticket de soporte',
      requester: getFirstString(ticket, [
        'requester',
        'requesterName',
        'requester_name',
        'name',
        'email',
        'user.name',
        'user.fullName',
        'user.email',
        'customer.name',
        'customer.email',
      ]),
      channel: getFirstString(ticket, ['channel', 'source', 'origin', 'contactMethod', 'contact_method']),
      notes: getFirstString(ticket, ['notes', 'description', 'message', 'detail', 'details', 'body', 'comment']),
      bikeId: getFirstString(ticket, [
        'bikeId',
        'bike_id',
        'bicicletaId',
        'bicicleta_id',
        'bicycleId',
        'bicycle_id',
        'vehicleId',
        'vehicle_id',
        'bike.id',
        'bicicleta.id',
        'bicycle.id',
      ]) || undefined,
      bikeCode: getFirstString(ticket, [
        'bikeCode',
        'bike_code',
        'code',
        'serialNumber',
        'serial_number',
        'bike.code',
        'bike.serialNumber',
        'bike.serial_number',
        'bicicleta.codigo',
        'bicicleta.serialNumber',
        'bicycle.code',
        'bicycle.serialNumber',
      ]) || undefined,
      type: normalizeSupportTypeValue(readNestedValue(ticket, 'type') ?? readNestedValue(ticket, 'category') ?? readNestedValue(ticket, 'issueType') ?? readNestedValue(ticket, 'ticketType')),
      status: normalizeSupportStatusValue(readNestedValue(ticket, 'status') ?? readNestedValue(ticket, 'state')),
      importance: normalizeSupportImportanceValue(
        readNestedValue(ticket, 'importance') ??
          readNestedValue(ticket, 'priority') ??
          readNestedValue(ticket, 'severity') ??
          readNestedValue(ticket, 'level'),
      ),
      createdAt: normalizeDateValue(
        readNestedValue(ticket, 'createdAt') ??
          readNestedValue(ticket, 'created_at') ??
          readNestedValue(ticket, 'openedAt') ??
          readNestedValue(ticket, 'opened_at'),
        now,
      ),
      updatedAt: normalizeDateValue(
        readNestedValue(ticket, 'updatedAt') ??
          readNestedValue(ticket, 'updated_at') ??
          readNestedValue(ticket, 'closedAt') ??
          readNestedValue(ticket, 'closed_at'),
        now,
      ),
    } satisfies SupportTicket
  })
}

export function extractSupportTickets(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const searchQueue: unknown[] = [
    (payload as Record<string, unknown>).tickets,
    (payload as Record<string, unknown>).support,
    (payload as Record<string, unknown>).items,
    (payload as Record<string, unknown>).results,
    (payload as Record<string, unknown>).data,
  ]

  while (searchQueue.length > 0) {
    const current = searchQueue.shift()

    if (Array.isArray(current)) {
      return current
    }

    if (current && typeof current === 'object') {
      const record = current as Record<string, unknown>

      searchQueue.push(record.tickets, record.support, record.items, record.results, record.data)
    }
  }

  return null
}

export function loadAdminData(): AdminData {
  if (typeof window === 'undefined') {
    return createEmptyAdminData()
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return createEmptyAdminData()
    }

    const parsed = JSON.parse(rawValue) as Partial<AdminData>

      return {
        stations: Array.isArray(parsed.stations) ? normalizeStations(parsed.stations) : [],
        bikes: Array.isArray(parsed.bikes) ? normalizeBikes(parsed.bikes) : [],
        maintenance: Array.isArray(parsed.maintenance) ? normalizeMaintenance(parsed.maintenance) : [],
        support: Array.isArray(parsed.support) ? normalizeSupport(parsed.support) : [],
      }
  } catch {
    return createEmptyAdminData()
  }
}

export function loadAdminSection(): AdminSection {
  if (typeof window === 'undefined') {
    return 'dashboard'
  }

  const savedSection = window.localStorage.getItem(ADMIN_SECTION_STORAGE_KEY)

  if (savedSection && adminNav.some((item) => item.key === savedSection)) {
    return savedSection as AdminSection
  }

  return 'dashboard'
}

export function getDisplayName(userEmail: string): string {
  const baseName = userEmail.split('@')[0]?.trim()
  if (!baseName) {
    return 'Usuario'
  }

  return baseName
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ')
}

export function getBikeLabel(bike: Pick<Bike, 'serialNumber' | 'code'>) {
  return bike.serialNumber || bike.code
}

export function getBikeStatusLabel(status: BikeStatus) {
  return bikeStatusOptions.find((option) => option.value === status)?.label ?? status
}

export function getStationStatusLabel(status: StationStatus) {
  return stationStatusOptions.find((option) => option.value === status)?.label ?? status
}

export function getMaintenanceStatusLabel(status: MaintenanceStatus) {
  return maintenanceStatusOptions.find((option) => option.value === status)?.label ?? status
}

export function getSupportStatusLabel(status: SupportStatus) {
  return supportStatusOptions.find((option) => option.value === status)?.label ?? status
}

export function getSupportImportanceLabel(importance: SupportImportance) {
  return supportImportanceOptions.find((option) => option.value === importance)?.label ?? importance
}

export function getSupportTypeLabel(type: SupportTicketType) {
  return supportTypeOptions.find((option) => option.value === type)?.label ?? type
}

export function getBikeTone(status: BikeStatus): MarkerTone {
  if (status === 'available') {
    return 'blue'
  }
  if (status === 'in_use') {
    return 'green'
  }
  if (status === 'maintenance') {
    return 'orange'
  }
  if (status === 'reserved') {
    return 'blue'
  }
  return 'red'
}

export function getStationTone(status: StationStatus): 'green' | 'orange' | 'red' {
  if (status === 'active') {
    return 'green'
  }
  if (status === 'maintenance') {
    return 'orange'
  }
  return 'red'
}

export function getMaintenanceTone(status: MaintenanceStatus): 'green' | 'orange' | 'blue' {
  if (status === 'resolved') {
    return 'green'
  }
  if (status === 'in_progress') {
    return 'orange'
  }
  return 'blue'
}

export function getSupportImportanceTone(importance: SupportImportance): 'blue' | 'orange' | 'red' {
  if (importance === 'high') {
    return 'red'
  }
  if (importance === 'medium') {
    return 'orange'
  }
  return 'blue'
}

export function getSupportTone(status: SupportStatus): 'green' | 'orange' | 'blue' {
  if (status === 'resolved') {
    return 'green'
  }
  if (status === 'in_progress') {
    return 'orange'
  }
  return 'blue'
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `Hace ${diffHours} h`
  }

  const diffDays = Math.round(diffHours / 24)
  return `Hace ${diffDays} d`
}

export function getStationOccupancy(stationId: string, bikes: Bike[]) {
  return bikes.filter((bike) => bike.stationId === stationId).length
}

export function getZoneSummaries(data: AdminData) {
  const zoneMap = new Map<
    string,
    { zone: string; stations: number; bikes: number; capacity: number; occupancy: number }
  >()

  const activeStations = data.stations.filter((station) => station.isActive)
  const activeBikes = data.bikes.filter((bike) => bike.isActive)

  activeStations.forEach((station) => {
    const current = zoneMap.get(station.zone) ?? {
      zone: station.zone,
      stations: 0,
      bikes: 0,
      capacity: 0,
      occupancy: 0,
    }

    const parkedBikes = getStationOccupancy(station.id, activeBikes)
    current.stations += 1
    current.bikes += parkedBikes
    current.capacity += station.capacity
    current.occupancy = current.capacity === 0 ? 0 : Math.round((current.bikes / current.capacity) * 100)

    zoneMap.set(station.zone, current)
  })

  return Array.from(zoneMap.values()).sort((left, right) => left.zone.localeCompare(right.zone))
}

export function buildActivityItems(data: AdminData): ActivityItem[] {
  const bikeActivity: ActivityItem[] = data.bikes.map((bike) => {
    const bikeTone = getBikeTone(bike.status)

    return {
      id: bike.id,
      title: `Bicicleta ${getBikeLabel(bike)}`,
      subtitle:
        bike.stationId !== null
          ? `Asignada a ${data.stations.find((station) => station.id === bike.stationId)?.name ?? 'estacion eliminada'}`
          : `Ubicacion libre (${bike.lat.toFixed(5)}, ${bike.lng.toFixed(5)})`,
      time: bike.updatedAt,
      icon: 'bike',
      tone: bikeTone,
    }
  })

  const maintenanceActivity: ActivityItem[] = data.maintenance.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: `${item.technician || 'Sin tecnico'} - ${getMaintenanceStatusLabel(item.status)}`,
    time: item.updatedAt,
    icon: 'tool',
    tone: getMaintenanceTone(item.status),
  }))

  const supportActivity: ActivityItem[] = data.support.map((ticket) => ({
    id: ticket.id,
    title: ticket.subject,
    subtitle: `${ticket.requester || 'Sin solicitante'} - ${getSupportStatusLabel(ticket.status)}`,
    time: ticket.updatedAt,
    icon: 'ticket',
    tone: getSupportTone(ticket.status),
  }))

  return [...bikeActivity, ...maintenanceActivity, ...supportActivity]
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 6)
    .map((item) => ({
      ...item,
      time: formatRelativeTime(item.time),
    }))
}
