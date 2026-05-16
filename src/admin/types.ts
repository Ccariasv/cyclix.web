import type { ReactNode } from 'react'

export type AdminSection = 'dashboard' | 'registry' | 'fleet' | 'maintenance' | 'analytics' | 'support'
export type StationStatus = 'active' | 'inactive' | 'maintenance'
export type BikeType = 'Urbana' | 'Montana' | 'Electrica'
export type BikeStatus =
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'out_of_service'
  | 'reserved'
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved'
export type SupportStatus = 'open' | 'in_progress' | 'resolved'
export type SupportImportance = 'low' | 'medium' | 'high'
export type SupportTicketType =
  | 'bike_issue'
  | 'station_issue'
  | 'payment_issue'
  | 'account_access'
  | 'safety_report'
  | 'other'
export type MarkerTone = 'green' | 'blue' | 'orange' | 'red'

export type IconName =
  | 'bike'
  | 'users'
  | 'tool'
  | 'grid'
  | 'map'
  | 'chart'
  | 'support'
  | 'ticket'
  | 'clock'
  | 'logout'
  | 'chevron-left'
  | 'chevron-right'

export type NavItem<T extends string> = {
  key: T
  label: string
  icon?: IconName
  imageSrc?: string
}

export type AuthenticatedAppProps = {
  authToken: string
  userEmail: string
  onLogout: () => void
}

export type Station = {
  id: string
  name: string
  zone: string
  capacity: number
  lat: number
  lng: number
  status: StationStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type Bike = {
  id: string
  code: string
  serialNumber: string
  color: string
  size: string
  bikeType: BikeType
  battery: number
  status: BikeStatus
  stationId: string | null
  lat: number
  lng: number
  notes: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type MaintenanceItem = {
  id: string
  bikeId: string
  supportTicketId?: string
  title: string
  technician: string
  notes: string
  status: MaintenanceStatus
  createdAt: string
  updatedAt: string
}

export type SupportTicket = {
  id: string
  subject: string
  requester: string
  channel: string
  notes: string
  bikeId?: string
  bikeCode?: string
  type: SupportTicketType
  status: SupportStatus
  importance: SupportImportance
  createdAt: string
  updatedAt: string
}

export type AdminData = {
  stations: Station[]
  bikes: Bike[]
  maintenance: MaintenanceItem[]
  support: SupportTicket[]
}

export type SupportSyncState = {
  isLoading: boolean
  error: string | null
  lastUpdated: string | null
}

export type SupportUpdateHandlers = {
  onRefreshSupport: () => Promise<void>
  onUpdateSupportStatus: (ticketId: string, status: SupportStatus) => Promise<void>
  onUpdateSupportPriority: (ticketId: string, priority: SupportImportance) => Promise<void>
}

export type ActivityItem = {
  id: string
  title: string
  subtitle: string
  time: string
  icon: 'bike' | 'tool' | 'ticket'
  tone: 'blue' | 'green' | 'orange' | 'red'
}

export type PlacementTarget =
  | {
      type: 'station'
      id: string
    }
  | {
      type: 'bike'
      id: string
    }
  | {
      type: 'new_station'
    }
  | null

export type EmptyStateProps = {
  title: string
  copy: string
}

export type DataTableProps = {
  columns: string[]
  rows: ReactNode[][]
  rowKeys?: string[]
}

export type LatLngPoint = [number, number]
