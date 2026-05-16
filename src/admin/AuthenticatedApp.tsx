import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ADMIN_SECTION_STORAGE_KEY, SIDEBAR_COLLAPSED_STORAGE_KEY, STORAGE_KEY, adminNav } from './constants'
import { Icon } from './components/Icon'
import { DashboardSection } from './sections/DashboardSection'
import { RegistrationSection } from './sections/RegistrationSection'
import { FleetSection } from './sections/FleetSection'
import { MaintenanceSection } from './sections/MaintenanceSection'
import { AnalyticsSection } from './sections/AnalyticsSection'
import { SupportSection } from './sections/SupportSection'
import type {
  AdminData,
  AdminSection,
  AuthenticatedAppProps,
  SupportImportance,
  SupportStatus,
  SupportSyncState,
} from './types'
import { extractSupportTickets, getDisplayName, loadAdminData, loadAdminSection, normalizeSupport } from './utils'
import {
  buildAuthHeaders,
  buildJsonAuthHeaders,
  buildSupportTicketPriorityEndpoint,
  buildSupportTicketStatusEndpoint,
  SUPPORT_TICKETS_ENDPOINT,
  toApiSupportPriority,
  toApiSupportStatus,
} from '../api'
import './styles.css'

function getApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const response = payload as Record<string, unknown>
  const message = response.message ?? response.error ?? response.detail

  return typeof message === 'string' && message.trim() ? message : null
}

function getSupportHttpErrorMessage(status: number, payload: unknown, fallback: string): string {
  const apiMessage = getApiErrorMessage(payload)

  if (apiMessage) {
    return apiMessage
  }

  if (status === 401) {
    return 'La API de soporte rechazo la sesion. Vuelve a iniciar sesion.'
  }

  if (status === 403) {
    return 'La API de soporte rechazo este usuario para el endpoint admin/support/tickets.'
  }

  if (status === 404) {
    return 'El endpoint de soporte no existe en la API configurada.'
  }

  if (status >= 500) {
    return 'La API de soporte fallo internamente.'
  }

  return fallback
}

function getRequestErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'No se pudieron cargar los tickets de soporte.'
  }

  const message = error.message.trim()

  if (!message) {
    return 'No se pudieron cargar los tickets de soporte.'
  }

  if (message === 'Bad Gateway') {
    return 'La API de soporte no responde correctamente.'
  }

  if (message === 'Failed to fetch') {
    return 'No se pudo alcanzar el servidor de soporte.'
  }

  return message
}

function AdminSectionView({
  authToken,
  section,
  data,
  setData,
  onQuickAction,
  supportSyncState,
  onRefreshSupport,
  onUpdateSupportStatus,
  onUpdateSupportPriority,
}: {
  authToken: string
  section: AdminSection
  data: AdminData
  setData: Dispatch<SetStateAction<AdminData>>
  onQuickAction: (target: AdminSection) => void
  supportSyncState: SupportSyncState
  onRefreshSupport: () => Promise<void>
  onUpdateSupportStatus: (ticketId: string, status: SupportStatus) => Promise<void>
  onUpdateSupportPriority: (ticketId: string, priority: SupportImportance) => Promise<void>
}) {
  if (section === 'dashboard') {
    return <DashboardSection data={data} onQuickAction={onQuickAction} />
  }

  if (section === 'registry') {
    return <RegistrationSection authToken={authToken} data={data} setData={setData} />
  }

  if (section === 'fleet') {
    return <FleetSection data={data} setData={setData} />
  }

  if (section === 'maintenance') {
    return <MaintenanceSection data={data} setData={setData} />
  }

  if (section === 'analytics') {
    return <AnalyticsSection data={data} />
  }

  return (
    <SupportSection
      data={data}
      syncState={supportSyncState}
      onRefreshSupport={onRefreshSupport}
      onUpdateSupportStatus={onUpdateSupportStatus}
      onUpdateSupportPriority={onUpdateSupportPriority}
    />
  )
}

export function AuthenticatedApp({ authToken, userEmail, onLogout }: AuthenticatedAppProps) {
  const [adminSection, setAdminSection] = useState<AdminSection>(loadAdminSection)
  const [data, setData] = useState<AdminData>(loadAdminData)
  const [supportSyncState, setSupportSyncState] = useState<SupportSyncState>({
    isLoading: false,
    error: null,
    lastUpdated: null,
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  })
  const displayName = getDisplayName(userEmail)
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    window.localStorage.setItem(ADMIN_SECTION_STORAGE_KEY, adminSection)
  }, [adminSection])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const refreshSupportTickets = useCallback(async () => {
    setSupportSyncState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }))

    try {
      const response = await fetch(SUPPORT_TICKETS_ENDPOINT, {
        headers: buildAuthHeaders(authToken),
      })

      const isJson = response.headers.get('content-type')?.includes('application/json')
      const payload: unknown = isJson ? await response.json() : await response.text()

      if (!response.ok) {
        throw new Error(
          getSupportHttpErrorMessage(response.status, payload, 'No se pudieron cargar los tickets de soporte.'),
        )
      }

      const rawTickets = extractSupportTickets(payload)

      if (rawTickets === null) {
        throw new Error('La API de soporte respondio con un formato no compatible.')
      }

      const tickets = normalizeSupport(rawTickets)

      setData((current) => ({
        ...current,
        support: tickets,
      }))
      setSupportSyncState({
        isLoading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      setSupportSyncState((current) => ({
        ...current,
        isLoading: false,
        error: getRequestErrorMessage(error),
      }))
    }
  }, [authToken])

  const updateSupportStatus = useCallback(
    async (ticketId: string, status: SupportStatus) => {
      const response = await fetch(buildSupportTicketStatusEndpoint(ticketId), {
        method: 'PUT',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({
          status: toApiSupportStatus(status),
        }),
      })

      const isJson = response.headers.get('content-type')?.includes('application/json')
      const payload: unknown = isJson ? await response.json() : await response.text()

      if (!response.ok) {
        throw new Error(
          getSupportHttpErrorMessage(response.status, payload, 'No se pudo actualizar el estado del ticket.'),
        )
      }

      setData((current) => ({
        ...current,
        support: current.support.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                status,
                updatedAt: new Date().toISOString(),
              }
            : ticket,
        ),
      }))
    },
    [authToken],
  )

  const updateSupportPriority = useCallback(
    async (ticketId: string, priority: SupportImportance) => {
      const response = await fetch(buildSupportTicketPriorityEndpoint(ticketId), {
        method: 'PUT',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({
          priority: toApiSupportPriority(priority),
        }),
      })

      const isJson = response.headers.get('content-type')?.includes('application/json')
      const payload: unknown = isJson ? await response.json() : await response.text()

      if (!response.ok) {
        throw new Error(
          getSupportHttpErrorMessage(response.status, payload, 'No se pudo actualizar la prioridad del ticket.'),
        )
      }

      setData((current) => ({
        ...current,
        support: current.support.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                importance: priority,
                updatedAt: new Date().toISOString(),
              }
            : ticket,
        ),
      }))
    },
    [authToken],
  )

  useEffect(() => {
    void refreshSupportTickets()
  }, [refreshSupportTickets])

  return (
    <div className={`app-shell${isSidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}`}>
      <aside className={`sidebar${isSidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
        <div className="sidebar__section">
          <div className="sidebar__header">
            <div className="brand brand--with-logo">
              <img className="brand__logo" src="/cyclix-logo-transparent.png" alt="Cyclix" />
              <div className="brand__copy">
                <h2>Cyclix Admin</h2>
              </div>
            </div>

            <button
              type="button"
              className="sidebar-toggle"
              aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
              aria-expanded={!isSidebarCollapsed}
              title={isSidebarCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
            >
              <Icon
                name={isSidebarCollapsed ? 'chevron-right' : 'chevron-left'}
                className="sidebar-toggle__icon"
              />
            </button>
          </div>

          <nav className="sidebar-nav" aria-label="Navegacion lateral">
            {adminNav.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`sidebar-link${adminSection === item.key ? ' sidebar-link--active' : ''}`}
                aria-label={item.label}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => setAdminSection(item.key)}
              >
                {item.imageSrc ? (
                  <img src={item.imageSrc} alt="" aria-hidden="true" className="sidebar-link__image" />
                ) : (
                  <Icon name={item.icon!} className="sidebar-link__icon" />
                )}
                <span className="sidebar-link__label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="system-card" title={isSidebarCollapsed ? 'Datos locales activos' : undefined}>
          <strong className="system-card__title">Datos locales activos</strong>
          <p className="system-card__copy">
            <span className="system-card__dot"></span>
            <span className="system-card__text">Los cambios se guardan en este navegador</span>
          </p>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <strong>Panel Admin</strong>
          </div>

          <div className="topbar-user">
            <div className="user-chip">
              <span className="user-chip__avatar">{initials}</span>
              <div>
                <strong>{displayName}</strong>
                <p>{userEmail}</p>
              </div>
            </div>
            <button type="button" className="logout-button" onClick={onLogout}>
              <Icon name="logout" className="logout-button__icon" />
              <span>Cerrar sesion</span>
            </button>
          </div>
        </header>

        <main className="content-shell">
          <div className="content-scroll">
            <AdminSectionView
              authToken={authToken}
              section={adminSection}
              data={data}
              setData={setData}
              onQuickAction={setAdminSection}
              supportSyncState={supportSyncState}
              onRefreshSupport={refreshSupportTickets}
              onUpdateSupportStatus={updateSupportStatus}
              onUpdateSupportPriority={updateSupportPriority}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
