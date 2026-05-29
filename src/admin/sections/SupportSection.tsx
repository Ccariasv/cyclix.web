import { useMemo, useState } from 'react'
import { EmptyState, SectionHeader } from '../components/common'
import { supportImportanceOptions, supportStatusOptions } from '../constants'
import type { AdminData, SupportImportance, SupportStatus, SupportSyncState } from '../types'
import {
  formatDateTime,
  getSupportImportanceLabel,
  getSupportImportanceTone,
  getSupportStatusLabel,
  getSupportTone,
  getSupportTypeLabel,
} from '../utils'

type SupportFilter = 'all' | SupportImportance

export function SupportSection({
  data,
  syncState,
  onRefreshSupport,
  onUpdateSupportStatus,
  onUpdateSupportPriority,
}: {
  data: AdminData
  syncState: SupportSyncState
  onRefreshSupport: () => Promise<void>
  onUpdateSupportStatus: (ticketId: string, status: SupportStatus) => Promise<void>
  onUpdateSupportPriority: (ticketId: string, priority: SupportImportance) => Promise<void>
}) {
  const [importanceFilter, setImportanceFilter] = useState<SupportFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [ticketPendingAction, setTicketPendingAction] = useState<Record<string, 'status' | 'priority' | null>>({})
  const [ticketErrors, setTicketErrors] = useState<Record<string, string | null>>({})

  const filteredTickets = useMemo(() => {
    const tickets =
      importanceFilter === 'all'
        ? data.support
        : data.support.filter((ticket) => ticket.importance === importanceFilter)

    const importanceOrder: Record<SupportImportance, number> = {
      high: 3,
      medium: 2,
      low: 1,
    }

    return [...tickets].sort((left, right) => {
      const importanceDiff = importanceOrder[right.importance] - importanceOrder[left.importance]

      if (importanceDiff !== 0) {
        return importanceDiff
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
  }, [data.support, importanceFilter])

  const ticketStats = useMemo(
    () => ({
      total: data.support.length,
      high: data.support.filter((ticket) => ticket.importance === 'high').length,
      medium: data.support.filter((ticket) => ticket.importance === 'medium').length,
      low: data.support.filter((ticket) => ticket.importance === 'low').length,
    }),
    [data.support],
  )

  const currentFilterLabel =
    importanceFilter === 'all' ? 'Todos' : getSupportImportanceLabel(importanceFilter)

  const handleFilterChange = (filter: SupportFilter) => {
    setImportanceFilter(filter)
    setShowFilters(false)
  }

  const handleStatusChange = async (ticketId: string, status: SupportStatus) => {
    setTicketPendingAction((current) => ({ ...current, [ticketId]: 'status' }))
    setTicketErrors((current) => ({ ...current, [ticketId]: null }))

    try {
      await onUpdateSupportStatus(ticketId, status)
    } catch (error) {
      setTicketErrors((current) => ({
        ...current,
        [ticketId]: error instanceof Error ? error.message : 'No se pudo actualizar el estado.',
      }))
    } finally {
      setTicketPendingAction((current) => ({ ...current, [ticketId]: null }))
    }
  }

  const handlePriorityChange = async (ticketId: string, priority: SupportImportance) => {
    setTicketPendingAction((current) => ({ ...current, [ticketId]: 'priority' }))
    setTicketErrors((current) => ({ ...current, [ticketId]: null }))

    try {
      await onUpdateSupportPriority(ticketId, priority)
    } catch (error) {
      setTicketErrors((current) => ({
        ...current,
        [ticketId]: error instanceof Error ? error.message : 'No se pudo actualizar la prioridad.',
      }))
    } finally {
      setTicketPendingAction((current) => ({ ...current, [ticketId]: null }))
    }
  }

  return (
    <>
      <SectionHeader title="Soporte" />

      <section className="stack-grid support-grid">
        <article className="card detail-card">
          <div className="card-head support-card-head">
            <div>
              <h2>Tickets registrados</h2>
              <p className="support-card-copy">Usa el filtro para revisar tickets por importancia.</p>
            </div>
            <span className="tag tag--blue">{filteredTickets.length} visibles</span>
          </div>

          <div className="support-toolbar">
            <div className="support-sync">
              <span className={`tag tag--${syncState.error ? 'red' : syncState.isLoading ? 'orange' : 'green'}`}>
                {syncState.isLoading ? 'Actualizando tickets' : syncState.error ? 'Sin sincronizar' : 'Sincronizado'}
              </span>
              {syncState.error ? (
                <p className="support-sync__copy support-sync__copy--error">{syncState.error}</p>
              ) : syncState.lastUpdated ? (
                <p className="support-sync__copy">Ultima actualizacion: {formatDateTime(syncState.lastUpdated)}</p>
              ) : (
                <p className="support-sync__copy">Cargando tickets desde la API.</p>
              )}
            </div>

            <div className="support-toolbar__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onRefreshSupport()}
                disabled={syncState.isLoading}
              >
                {syncState.isLoading ? 'Actualizando...' : 'Actualizar'}
              </button>

              <div className="support-filter-dropdown">
                <button
                  type="button"
                  className="secondary-button support-filter-toggle"
                  onClick={() => setShowFilters((current) => !current)}
                  aria-expanded={showFilters}
                  aria-controls="support-filter-menu"
                >
                  Filtrar: {currentFilterLabel}
                  <span className={`support-filter-arrow${showFilters ? ' support-filter-arrow--open' : ''}`}>v</span>
                </button>

                {showFilters ? (
                  <div id="support-filter-menu" className="support-filter-menu">
                    <button
                      type="button"
                      className={`support-filter-chip${importanceFilter === 'all' ? ' support-filter-chip--active' : ''}`}
                      onClick={() => handleFilterChange('all')}
                    >
                      Todos <strong>{ticketStats.total}</strong>
                    </button>

                    {supportImportanceOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`support-filter-chip support-filter-chip--${getSupportImportanceTone(option.value)}${
                          importanceFilter === option.value ? ' support-filter-chip--active' : ''
                        }`}
                        onClick={() => handleFilterChange(option.value)}
                      >
                        {option.label} <strong>{ticketStats[option.value]}</strong>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <EmptyState title="Sin tickets" copy="Aqui aparecera el listado cuando existan tickets registrados." />
          ) : (
            <div className="record-list">
              {filteredTickets.map((ticket) => (
                <article key={ticket.id} className={`record-card support-ticket support-ticket--${ticket.importance}`}>
                  <div className="record-card__header">
                    <div>
                      <strong>{ticket.subject}</strong>
                      <p>{ticket.requester || 'Sin solicitante'}</p>
                      <span className="support-ticket__type">Tipo: {getSupportTypeLabel(ticket.type)}</span>
                    </div>
                    <div className="support-ticket__tags">
                      <span className={`tag tag--${getSupportImportanceTone(ticket.importance)}`}>
                        {getSupportImportanceLabel(ticket.importance)}
                      </span>
                      <span className={`tag tag--${getSupportTone(ticket.status)}`}>
                        {getSupportStatusLabel(ticket.status)}
                      </span>
                    </div>
                  </div>

                  <div className="record-card__meta">
                    <span>Canal: {ticket.channel || 'No definido'}</span>
                    <span>Creado: {formatDateTime(ticket.createdAt)}</span>
                    <span>Actualizado: {formatDateTime(ticket.updatedAt)}</span>
                  </div>

                  <div className="support-ticket__controls">
                    <label className="control support-ticket__control">
                      <span>Estado</span>
                      <select
                        value={ticket.status}
                        onChange={(event) => void handleStatusChange(ticket.id, event.target.value as SupportStatus)}
                        disabled={ticketPendingAction[ticket.id] !== undefined && ticketPendingAction[ticket.id] !== null}
                      >
                        {supportStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="control support-ticket__control">
                      <span>Prioridad</span>
                      <select
                        value={ticket.importance}
                        onChange={(event) =>
                          void handlePriorityChange(ticket.id, event.target.value as SupportImportance)
                        }
                        disabled={ticketPendingAction[ticket.id] !== undefined && ticketPendingAction[ticket.id] !== null}
                      >
                        {supportImportanceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {ticketPendingAction[ticket.id] ? (
                    <p className="support-ticket__feedback">Guardando cambios...</p>
                  ) : ticketErrors[ticket.id] ? (
                    <p className="support-ticket__feedback support-ticket__feedback--error">{ticketErrors[ticket.id]}</p>
                  ) : null}

                  {ticket.notes ? (
                    <div className="fleet-note-card fleet-note-card--compact">
                      <strong>Descripcion</strong>
                      <p>{ticket.notes}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  )
}
