import { useEffect, useMemo, useState } from 'react'
import { EmptyState, SectionHeader } from '../components/common'
import type { TripRecord } from '../types'
import { buildAuthHeaders, buildAdminTripCancelEndpoint, buildAdminTripsEndpoint } from '../../api'
import { formatDateTime } from '../utils'
import {
  ensureOk,
  extractCollection,
  getNumberValue,
  getStringValue,
  parseResponsePayload,
} from './apiHelpers'

type TripFilter = 'all' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

function normalizeTripStatus(value: unknown): TripRecord['status'] {
  if (value === 'ACTIVE' || value === 'COMPLETED' || value === 'CANCELLED') {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim().toUpperCase()

    if (normalized === 'ACTIVE' || normalized === 'COMPLETED' || normalized === 'CANCELLED') {
      return normalized
    }
  }

  return 'ACTIVE'
}

function normalizeTrip(rawTrip: unknown): TripRecord {
  const trip = (rawTrip && typeof rawTrip === 'object' ? rawTrip : {}) as Record<string, unknown>
  const createdAt = getStringValue(trip, ['createdAt', 'created_at', 'startedAt', 'started_at'], new Date().toISOString())
  const updatedAt = getStringValue(trip, ['updatedAt', 'updated_at', 'endedAt', 'ended_at'], createdAt)

  return {
    id: getStringValue(trip, ['id', 'tripId', 'trip_id']),
    userId: getStringValue(trip, ['userId', 'user_id', 'user.id']),
    bikeId: getStringValue(trip, ['bikeId', 'bike_id', 'bike.id', 'bicicletaId']),
    status: normalizeTripStatus(trip.status),
    startLatitude: getNumberValue(trip, ['startLatitude', 'start_latitude']),
    startLongitude: getNumberValue(trip, ['startLongitude', 'start_longitude']),
    endLatitude: getNumberValue(trip, ['endLatitude', 'end_latitude']),
    endLongitude: getNumberValue(trip, ['endLongitude', 'end_longitude']),
    startedAt: getStringValue(trip, ['startedAt', 'started_at'], '') || null,
    endedAt: getStringValue(trip, ['endedAt', 'ended_at'], '') || null,
    distanceKm: getNumberValue(trip, ['distanceKm', 'distance_km']),
    durationSeconds: getNumberValue(trip, ['durationSeconds', 'duration_seconds']),
    createdAt,
    updatedAt,
  }
}

function getTripStatusTone(status: TripRecord['status']) {
  if (status === 'COMPLETED') {
    return 'green'
  }

  if (status === 'CANCELLED') {
    return 'red'
  }

  return 'blue'
}

function getTripStatusLabel(status: TripRecord['status']) {
  if (status === 'COMPLETED') {
    return 'Completado'
  }

  if (status === 'CANCELLED') {
    return 'Cancelado'
  }

  return 'Activo'
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return 'Sin duracion'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours} h ${minutes} min`
  }

  return `${minutes} min`
}

function formatCoordinate(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) {
    return 'Sin coordenadas'
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function TripsSection({ authToken }: { authToken: string }) {
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TripFilter>('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    const loadTrips = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(buildAdminTripsEndpoint(), {
          headers: buildAuthHeaders(authToken),
        })
        const payload = await parseResponsePayload(response)
        ensureOk(response, payload, 'No se pudieron cargar los viajes.')

        const rawTrips = extractCollection(payload)
        const normalizedTrips = (rawTrips ?? []).map(normalizeTrip).sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        )

        if (isCancelled) {
          return
        }

        setTrips(normalizedTrips)
        setSelectedTripId((current) =>
          current && normalizedTrips.some((trip) => trip.id === current) ? current : (normalizedTrips[0]?.id ?? null),
        )
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los viajes.')
          setTrips([])
          setSelectedTripId(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadTrips()

    return () => {
      isCancelled = true
    }
  }, [authToken])

  const filteredTrips = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return trips.filter((trip) => {
      if (statusFilter !== 'all' && trip.status !== statusFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [trip.id, trip.userId, trip.bikeId, getTripStatusLabel(trip.status)]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [search, statusFilter, trips])

  const selectedTrip =
    (selectedTripId ? filteredTrips.find((trip) => trip.id === selectedTripId) : null) ??
    (selectedTripId ? trips.find((trip) => trip.id === selectedTripId) : null) ??
    filteredTrips[0] ??
    null

  const totalDistanceKm = useMemo(
    () => filteredTrips.reduce((total, trip) => total + (trip.distanceKm ?? 0), 0),
    [filteredTrips],
  )

  const stats = useMemo(
    () => ({
      total: trips.length,
      active: trips.filter((trip) => trip.status === 'ACTIVE').length,
      completed: trips.filter((trip) => trip.status === 'COMPLETED').length,
      cancelled: trips.filter((trip) => trip.status === 'CANCELLED').length,
    }),
    [trips],
  )

  const handleCancelTrip = async (tripId: string) => {
    setIsCancelling(tripId)
    setError(null)

    try {
      const response = await fetch(buildAdminTripCancelEndpoint(tripId), {
        method: 'PUT',
        headers: buildAuthHeaders(authToken),
      })
      const payload = await parseResponsePayload(response)
      ensureOk(response, payload, 'No se pudo cancelar el viaje.')

      const updatedTrip =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? normalizeTrip((payload as Record<string, unknown>).data ?? payload)
          : null

      setTrips((current) =>
        current.map((trip) =>
          trip.id === tripId
            ? {
                ...(updatedTrip ?? trip),
                status: 'CANCELLED',
                updatedAt: updatedTrip?.updatedAt ?? new Date().toISOString(),
              }
            : trip,
        ),
      )
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'No se pudo cancelar el viaje.')
    } finally {
      setIsCancelling(null)
    }
  }

  return (
    <>
      <SectionHeader title="Viajes" subtitle="Consulta viajes reales, filtra por estado y cancela viajes activos." />

      <section className="summary-grid">
        <article className="card summary-card">
          <span className="summary-card__label">Viajes registrados</span>
          <strong>{stats.total}</strong>
          <p>{filteredTrips.length} visibles con los filtros actuales.</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Activos / completados</span>
          <strong>
            {stats.active} / {stats.completed}
          </strong>
          <p>{stats.cancelled} cancelados.</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Distancia visible</span>
          <strong>{totalDistanceKm.toFixed(2)} km</strong>
          <p>Calculada con los viajes que reportan kilometraje.</p>
        </article>
      </section>

      <section className="card detail-card analytics-filter-panel">
        <div className="card-head">
          <h2>Filtros</h2>
          <span className="tag tag--blue">{filteredTrips.length} visibles</span>
        </div>

        <div className="analytics-filter-bar">
          {(['all', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as TripFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`analytics-filter-chip${statusFilter === filter ? ' analytics-filter-chip--active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' ? 'Todos' : getTripStatusLabel(filter)}
            </button>
          ))}
        </div>

        <div className="control-group">
          <label className="control control--full">
            <span>Buscar por viaje, usuario o bicicleta</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. viaje 15, usuario 2 o bici 8"
            />
          </label>
        </div>
      </section>

      <section className="content-grid admin-detail-grid">
        <article className="card detail-card">
          <div className="card-head">
            <h2>Listado de viajes</h2>
            <span className="tag tag--blue">API</span>
          </div>

          {isLoading ? (
            <EmptyState title="Cargando viajes" copy="Consultando viajes reales desde la API." />
          ) : error ? (
            <EmptyState title="No se pudieron cargar viajes" copy={error} />
          ) : filteredTrips.length === 0 ? (
            <EmptyState title="Sin viajes" copy="No hay viajes que coincidan con el filtro actual." />
          ) : (
            <div className="record-list">
              {filteredTrips.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  className={`record-card admin-select-card${
                    selectedTrip?.id === trip.id ? ' admin-select-card--active' : ''
                  }`}
                  onClick={() => setSelectedTripId(trip.id)}
                >
                  <div className="record-card__header">
                    <div>
                      <strong>Viaje #{trip.id}</strong>
                      <p>
                        Usuario #{trip.userId || 'N/D'} / Bici #{trip.bikeId || 'N/D'}
                      </p>
                    </div>
                    <span className={`tag tag--${getTripStatusTone(trip.status)}`}>{getTripStatusLabel(trip.status)}</span>
                  </div>

                  <div className="record-card__meta">
                    <span>Inicio: {trip.startedAt ? formatDateTime(trip.startedAt) : 'Sin fecha'}</span>
                    <span>Duracion: {formatDuration(trip.durationSeconds)}</span>
                    <span>Distancia: {(trip.distanceKm ?? 0).toFixed(2)} km</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="card detail-card">
          <div className="card-head">
            <h2>Detalle</h2>
            <span className={`tag tag--${selectedTrip ? getTripStatusTone(selectedTrip.status) : 'blue'}`}>
              {selectedTrip ? 'Viaje' : 'Sin seleccion'}
            </span>
          </div>

          {!selectedTrip ? (
            <EmptyState title="Sin viaje seleccionado" copy="Selecciona un viaje para ver su detalle completo." />
          ) : (
            <div className="record-list">
              <article className="record-card">
                <div className="record-card__header">
                  <div>
                    <strong>Viaje #{selectedTrip.id}</strong>
                    <p>
                      Usuario #{selectedTrip.userId || 'N/D'} / Bici #{selectedTrip.bikeId || 'N/D'}
                    </p>
                  </div>
                  <span className={`tag tag--${getTripStatusTone(selectedTrip.status)}`}>
                    {getTripStatusLabel(selectedTrip.status)}
                  </span>
                </div>

                <div className="record-card__meta">
                  <span>Creado: {formatDateTime(selectedTrip.createdAt)}</span>
                  <span>Actualizado: {formatDateTime(selectedTrip.updatedAt)}</span>
                </div>

                <div className="admin-kpi-grid">
                  <div className="admin-kpi-chip">
                    <span>Inicio</span>
                    <strong>{selectedTrip.startedAt ? formatDateTime(selectedTrip.startedAt) : 'Sin dato'}</strong>
                  </div>
                  <div className="admin-kpi-chip">
                    <span>Fin</span>
                    <strong>{selectedTrip.endedAt ? formatDateTime(selectedTrip.endedAt) : 'Aun activo'}</strong>
                  </div>
                  <div className="admin-kpi-chip">
                    <span>Duracion</span>
                    <strong>{formatDuration(selectedTrip.durationSeconds)}</strong>
                  </div>
                  <div className="admin-kpi-chip">
                    <span>Distancia</span>
                    <strong>{(selectedTrip.distanceKm ?? 0).toFixed(2)} km</strong>
                  </div>
                </div>

                <div className="fleet-detail-list">
                  <div className="fleet-detail-list__row">
                    <span>Coordenada de salida</span>
                    <strong>{formatCoordinate(selectedTrip.startLatitude, selectedTrip.startLongitude)}</strong>
                  </div>
                  <div className="fleet-detail-list__row">
                    <span>Coordenada de llegada</span>
                    <strong>{formatCoordinate(selectedTrip.endLatitude, selectedTrip.endLongitude)}</strong>
                  </div>
                </div>

                {selectedTrip.status === 'ACTIVE' ? (
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleCancelTrip(selectedTrip.id)}
                      disabled={isCancelling === selectedTrip.id}
                    >
                      {isCancelling === selectedTrip.id ? 'Cancelando...' : 'Cancelar viaje activo'}
                    </button>
                  </div>
                ) : null}
              </article>
            </div>
          )}
        </article>
      </section>
    </>
  )
}
