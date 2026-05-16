import maintenanceTabIcon from '../assets/maintenance-tab-icon.png'
import type {
  AdminSection,
  BikeStatus,
  BikeType,
  LatLngPoint,
  MaintenanceStatus,
  NavItem,
  StationStatus,
  SupportStatus,
  SupportImportance,
  SupportTicketType,
} from './types'

export const STORAGE_KEY = 'cyclix-admin-data-v3'
export const ADMIN_SECTION_STORAGE_KEY = 'cyclix-admin-section'
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'cyclix-admin-sidebar-collapsed'
export const BIKE_SERIAL_COUNTER_STORAGE_KEY = 'cyclix-bike-serial-seq'
export const DEFAULT_CENTER: LatLngPoint = [14.9725, -89.5301]
export const DEFAULT_ZOOM = 14

export const adminNav: NavItem<AdminSection>[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { key: 'registry', label: 'Registro', icon: 'bike' },
  { key: 'fleet', label: 'Flota', icon: 'map' },
  { key: 'maintenance', label: 'Mantenimiento', imageSrc: maintenanceTabIcon },
  { key: 'analytics', label: 'Analitica', icon: 'chart' },
  { key: 'support', label: 'Soporte', icon: 'support' },
]

export const bikeStatusOptions: Array<{ value: BikeStatus; label: string }> = [
  { value: 'available', label: 'Disponible' },
  { value: 'in_use', label: 'En uso' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'out_of_service', label: 'Fuera de servicio' },
  { value: 'reserved', label: 'Reservada' },
]

export const stationStatusOptions: Array<{ value: StationStatus; label: string }> = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'maintenance', label: 'Mantenimiento' },
]

export const maintenanceStatusOptions: Array<{ value: MaintenanceStatus; label: string }> = [
  { value: 'open', label: 'Abierta' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'resolved', label: 'Resuelta' },
]

export const supportStatusOptions: Array<{ value: SupportStatus; label: string }> = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'resolved', label: 'Resuelto' },
]

export const supportImportanceOptions: Array<{ value: SupportImportance; label: string }> = [
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Medio' },
  { value: 'low', label: 'Bajo' },
]

export const supportTypeOptions: Array<{ value: SupportTicketType; label: string; description: string }> = [
  { value: 'bike_issue', label: 'Bicicleta', description: 'Fallas, danos, bateria baja o bici bloqueada.' },
  { value: 'station_issue', label: 'Estacion', description: 'Problemas con anclajes, disponibilidad o ubicacion.' },
  { value: 'payment_issue', label: 'Pago o cobro', description: 'Cobros incorrectos, saldo, reembolsos o facturacion.' },
  { value: 'account_access', label: 'Cuenta o acceso', description: 'Inicio de sesion, verificacion, bloqueo o datos del usuario.' },
  { value: 'safety_report', label: 'Seguridad', description: 'Incidentes, robo, accidente o comportamiento sospechoso.' },
  { value: 'other', label: 'Otro', description: 'Solicitudes generales que no entran en las categorias anteriores.' },
]

export const bikeSizeOptions = ['Pequena', 'Mediana', 'Grande'] as const
export const bikeTypeOptions: readonly BikeType[] = ['Urbana', 'Montana', 'Electrica'] as const

export const quickActions: Array<{
  label: string
  tone: 'blue' | 'orange' | 'green'
  icon: 'bike' | 'tool' | 'support'
  target: AdminSection
}> = [
  { label: 'Registrar\nflota', tone: 'blue', icon: 'bike', target: 'registry' },
  { label: 'Registrar\nmantenimiento', tone: 'orange', icon: 'tool', target: 'maintenance' },
  { label: 'Atender\nsoporte', tone: 'green', icon: 'support', target: 'support' },
]
