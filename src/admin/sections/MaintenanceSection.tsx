import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { EmptyState, SectionHeader } from '../components/common'
import { maintenanceStatusOptions } from '../constants'
import type { AdminData, MaintenanceItem, MaintenanceStatus, SupportTicket } from '../types'
import {
  formatDateTime,
  generateId,
  getBikeLabel,
  getMaintenanceStatusLabel,
  getMaintenanceTone,
  getNowIso,
} from '../utils'

type MaintenanceFormState = {
  supportTicketId: string
  title: string
  technician: string
  bikeId: string
  status: MaintenanceStatus
  notes: string
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

function ticketReferencesBike(ticketText: string, bikeLabel: string, bikeCode: string) {
  const normalizedTicketText = normalizeSearchValue(ticketText)
  const normalizedBikeLabel = normalizeSearchValue(bikeLabel)
  const normalizedBikeCode = normalizeSearchValue(bikeCode)

  return (
    (normalizedBikeLabel.length > 0 && normalizedTicketText.includes(normalizedBikeLabel)) ||
    (normalizedBikeCode.length > 0 && normalizedTicketText.includes(normalizedBikeCode))
  )
}

function resolveTicketBike(ticket: SupportTicket, activeBikes: AdminData['bikes']) {
  if (ticket.bikeId) {
    const bikeById = activeBikes.find((bike) => bike.id === ticket.bikeId)
    if (bikeById) {
      return bikeById
    }
  }

  if (ticket.bikeCode) {
    const normalizedTicketCode = normalizeSearchValue(ticket.bikeCode)
    const bikeByCode =
      activeBikes.find(
        (bike) =>
          normalizeSearchValue(bike.code) === normalizedTicketCode ||
          normalizeSearchValue(bike.serialNumber) === normalizedTicketCode,
      ) ?? null

    if (bikeByCode) {
      return bikeByCode
    }
  }

  return (
    activeBikes.find((bike) =>
      ticketReferencesBike(`${ticket.subject} ${ticket.notes}`, getBikeLabel(bike), bike.code),
    ) ?? null
  )
}

const createEmptyMaintenanceForm = (): MaintenanceFormState => ({
  supportTicketId: '',
  title: '',
  technician: '',
  bikeId: '',
  status: 'open',
  notes: '',
})

type EligibleTicket = {
  ticket: SupportTicket
  bikeId: string
  bikeLabel: string
}

export function MaintenanceSection({
  data,
  setData,
}: {
  data: AdminData
  setData: Dispatch<SetStateAction<AdminData>>
}) {
  const [selectedStatus, setSelectedStatus] = useState<MaintenanceStatus | 'all'>('all')
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceFormState>(createEmptyMaintenanceForm)

  const activeBikes = useMemo(
    () =>
      data.bikes
        .filter((bike) => bike.isActive)
        .sort((left, right) => getBikeLabel(left).localeCompare(getBikeLabel(right))),
    [data.bikes],
  )
  const usedSupportTicketIds = useMemo(
    () => new Set(data.maintenance.map((item) => item.supportTicketId).filter(Boolean)),
    [data.maintenance],
  )
  const eligibleTickets = useMemo<EligibleTicket[]>(() => {
    const activeBikeTickets = data.support.filter(
      (ticket) => ticket.type === 'bike_issue' && ticket.status !== 'resolved' && !usedSupportTicketIds.has(ticket.id),
    )

    return activeBikeTickets
        .map((ticket) => {
        const matchedBike = resolveTicketBike(ticket, activeBikes)

        if (!matchedBike) {
          return null
        }

        return {
          ticket,
          bikeId: matchedBike.id,
          bikeLabel: getBikeLabel(matchedBike),
        }
      })
      .filter((entry): entry is EligibleTicket => entry !== null)
      .sort((left, right) => new Date(right.ticket.createdAt).getTime() - new Date(left.ticket.createdAt).getTime())
  }, [activeBikes, data.support, usedSupportTicketIds])
  const selectedEligibleTicket = useMemo(
    () => eligibleTickets.find((entry) => entry.ticket.id === maintenanceForm.supportTicketId) ?? null,
    [eligibleTickets, maintenanceForm.supportTicketId],
  )

  const stats = useMemo(
    () => ({
      open: data.maintenance.filter((item) => item.status === 'open').length,
      inProgress: data.maintenance.filter((item) => item.status === 'in_progress').length,
      resolved: data.maintenance.filter((item) => item.status === 'resolved').length,
      total: data.maintenance.length,
    }),
    [data.maintenance],
  )

  const filteredMaintenance = useMemo(
    () =>
      data.maintenance
        .filter((item) => {
          const bike = data.bikes.find((entry) => entry.id === item.bikeId)

          if (bike?.isActive === false) {
            return false
          }

          return selectedStatus === 'all' ? true : item.status === selectedStatus
        })
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [data.bikes, data.maintenance, selectedStatus],
  )

  const resetMaintenanceForm = () => {
    setMaintenanceForm(createEmptyMaintenanceForm())
  }

  const closeMaintenanceModal = () => {
    setShowMaintenanceModal(false)
    resetMaintenanceForm()
  }

  const openCreateMaintenanceModal = () => {
    resetMaintenanceForm()
    setShowMaintenanceModal(true)
  }

  const saveNewMaintenance = () => {
    if (!maintenanceForm.supportTicketId || !maintenanceForm.title.trim() || !maintenanceForm.bikeId) {
      return
    }

    if (!selectedEligibleTicket || selectedEligibleTicket.bikeId !== maintenanceForm.bikeId) {
      return
    }

    const now = getNowIso()
    const newMaintenance: MaintenanceItem = {
      id: generateId('maint'),
      supportTicketId: maintenanceForm.supportTicketId,
      bikeId: maintenanceForm.bikeId,
      title: maintenanceForm.title.trim(),
      technician: maintenanceForm.technician.trim(),
      notes: maintenanceForm.notes.trim(),
      status: maintenanceForm.status,
      createdAt: now,
      updatedAt: now,
    }

    setData((current) => ({
      ...current,
      maintenance: [...current.maintenance, newMaintenance],
    }))

    closeMaintenanceModal()
  }

  return (
    <>
      <SectionHeader title="Mantenimiento" />

      <section className="summary-grid">
        <article className="card summary-card">
          <span className="summary-card__label">Total de tickets</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Pendientes</span>
          <strong>{stats.open}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">En proceso</span>
          <strong>{stats.inProgress}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Resueltos</span>
          <strong>{stats.resolved}</strong>
        </article>
      </section>

      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="primary-button" onClick={openCreateMaintenanceModal}>
          Registrar mantenimiento
        </button>
      </div>

      <section className="stack-grid">
        <article className="card detail-card">
          <div className="card-head">
            <h2>Listado de mantenimientos</h2>
            <span className="tag tag--blue">
              {filteredMaintenance.length} {selectedStatus === 'all' ? 'totales' : 'mostrados'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: selectedStatus === 'all' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                backgroundColor: selectedStatus === 'all' ? '#eff6ff' : '#fff',
                cursor: 'pointer',
                fontWeight: selectedStatus === 'all' ? 600 : 400,
              }}
            >
              Todos ({stats.total})
            </button>
            {maintenanceStatusOptions.map((option) => {
              const count =
                option.value === 'open'
                  ? stats.open
                  : option.value === 'in_progress'
                    ? stats.inProgress
                    : stats.resolved

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedStatus(option.value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border:
                      selectedStatus === option.value ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    backgroundColor: selectedStatus === option.value ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    fontWeight: selectedStatus === option.value ? 600 : 400,
                  }}
                >
                  {option.label} ({count})
                </button>
              )
            })}
          </div>

          {filteredMaintenance.length === 0 ? (
            <EmptyState
              title="Sin mantenimientos"
              copy={
                selectedStatus === 'all'
                  ? 'No hay mantenimientos registrados.'
                  : `No hay mantenimientos con estado ${getMaintenanceStatusLabel(selectedStatus)}.`
              }
            />
          ) : (
            <div className="record-list">
              {filteredMaintenance.map((item) => {
                const bike = data.bikes.find((entry) => entry.id === item.bikeId)
                const station = bike ? data.stations.find((entry) => entry.id === bike.stationId) ?? null : null

                return (
                  <article key={item.id} className="record-card">
                    <div className="record-card__header">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{bike ? getBikeLabel(bike) : 'Bicicleta eliminada'}</p>
                      </div>
                      <span className={`tag tag--${getMaintenanceTone(item.status)}`}>
                        {getMaintenanceStatusLabel(item.status)}
                      </span>
                    </div>

                    <div className="record-card__meta">
                      <span>Tecnico: {item.technician || 'Sin asignar'}</span>
                      <span>Creada: {formatDateTime(item.createdAt)}</span>
                      <span>Actualizada: {formatDateTime(item.updatedAt)}</span>
                    </div>

                    <div className="fleet-detail-list">
                      <div className="fleet-detail-list__row">
                        <span>Puesto</span>
                        <strong>{station ? station.name : 'Sin puesto'}</strong>
                      </div>
                      <div className="fleet-detail-list__row">
                        <span>Bicicleta</span>
                        <strong>{bike ? getBikeLabel(bike) : 'Eliminada'}</strong>
                      </div>
                    </div>

                    {item.notes ? (
                      <div className="fleet-note-card fleet-note-card--compact">
                        <strong>Notas</strong>
                        <p>{item.notes}</p>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </article>
      </section>

      {showMaintenanceModal
        ? createPortal(
            <div
              className="registry-location-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="maintenance-register-title"
            >
              <div className="registry-location-modal__backdrop" onClick={closeMaintenanceModal}></div>
              <div className="registry-location-modal__panel registry-location-modal__panel--narrow">
                <div className="registry-location-modal__header">
                  <div>
                    <span className="fleet-shell__eyebrow">Nuevo mantenimiento</span>
                    <h2 id="maintenance-register-title">Registrar mantenimiento</h2>
                    <p>El mantenimiento se crea a partir de un ticket activo de bicicleta que no haya sido usado antes.</p>
                  </div>
                  <button type="button" className="secondary-button" onClick={closeMaintenanceModal}>
                    Cerrar
                  </button>
                </div>

                <div className="registry-location-modal__body">
                  <div className="card detail-card">
                    <div className="card-head">
                      <h2>Datos del mantenimiento</h2>
                    </div>

                    <div className="form-grid">
                      <label className="control control--full">
                        <span>Ticket de bicicleta *</span>
                        <select
                          value={maintenanceForm.supportTicketId}
                          onChange={(event) => {
                            const ticketSelection =
                              eligibleTickets.find((entry) => entry.ticket.id === event.target.value) ?? null

                            setMaintenanceForm((current) => ({
                              ...current,
                              supportTicketId: event.target.value,
                              bikeId: ticketSelection?.bikeId ?? '',
                              title: ticketSelection?.ticket.subject ?? '',
                              notes: ticketSelection?.ticket.notes ?? '',
                            }))
                          }}
                        >
                          <option value="">Seleccionar ticket</option>
                          {eligibleTickets.map((entry) => (
                            <option key={entry.ticket.id} value={entry.ticket.id}>
                              {entry.ticket.subject} - {entry.bikeLabel}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="control control--full">
                        <span>Titulo del mantenimiento *</span>
                        <input
                          type="text"
                          placeholder="Ej: Cambio de llanta"
                          value={maintenanceForm.title}
                          onChange={(event) =>
                            setMaintenanceForm((current) => ({ ...current, title: event.target.value }))
                          }
                        />
                      </label>

                      <label className="control">
                        <span>Tecnico asignado</span>
                        <input
                          type="text"
                          placeholder="Nombre del tecnico"
                          value={maintenanceForm.technician}
                          onChange={(event) =>
                            setMaintenanceForm((current) => ({ ...current, technician: event.target.value }))
                          }
                        />
                      </label>

                      <label className="control">
                        <span>Estado *</span>
                        <select
                          value={maintenanceForm.status}
                          onChange={(event) =>
                            setMaintenanceForm((current) => ({
                              ...current,
                              status: event.target.value as MaintenanceStatus,
                            }))
                          }
                        >
                          {maintenanceStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="control">
                        <span>Bicicleta *</span>
                        <input value={selectedEligibleTicket?.bikeLabel ?? ''} readOnly placeholder="Se completa desde el ticket" />
                      </label>

                      <label className="control control--full">
                        <span>Notas</span>
                        <textarea
                          placeholder="Detalles adicionales..."
                          value={maintenanceForm.notes}
                          onChange={(event) =>
                            setMaintenanceForm((current) => ({ ...current, notes: event.target.value }))
                          }
                          rows={4}
                        />
                      </label>
                    </div>

                    {eligibleTickets.length === 0 ? (
                      <EmptyState
                        title="Sin tickets elegibles"
                        copy="Necesitas tickets activos de tipo bicicleta vinculados por serie/codigo y que no hayan sido usados en otro mantenimiento."
                      />
                    ) : null}

                    <div className="button-row">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={saveNewMaintenance}
                        disabled={!maintenanceForm.supportTicketId || !maintenanceForm.title.trim() || !maintenanceForm.bikeId}
                      >
                        Registrar mantenimiento
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
