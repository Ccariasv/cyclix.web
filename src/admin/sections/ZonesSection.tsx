import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, SectionHeader } from '../components/common'
import { ZonesMap, type ZoneMapEditor, type ZonesMapMode } from '../components/ZonesMap'
import { DEFAULT_CENTER } from '../constants'
import type { LatLngPoint, Zone, ZoneValidationResult } from '../types'
import {
  buildAdminZoneEndpoint,
  buildAdminZonesEndpoint,
  buildAdminZoneStatusEndpoint,
  buildAuthHeaders,
  buildJsonAuthHeaders,
  buildZoneValidationEndpoint,
} from '../../api'
import { clamp, formatDateTime } from '../utils'

const RADIUS_PRESETS = [150, 300, 500, 800, 1200]

function getApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const response = payload as Record<string, unknown>
  const message = response.message ?? response.error ?? response.detail

  return typeof message === 'string' && message.trim() ? message : null
}

async function parseResponsePayload(response: Response) {
  const isJson = response.headers.get('content-type')?.includes('application/json')
  return isJson ? ((await response.json()) as unknown) : await response.text()
}

function getStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ''
}

function getNumberValue(source: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = source[key]

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

function getBooleanValue(source: Record<string, unknown>, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'boolean') {
      return value
    }
  }

  return fallback
}

function normalizeDate(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date().toISOString()
}

function normalizeZone(rawZone: unknown): Zone {
  const zone = (rawZone && typeof rawZone === 'object' ? rawZone : {}) as Record<string, unknown>

  return {
    id: getStringValue(zone, ['id', 'zoneId']) || `zone-${Math.random().toString(36).slice(2, 10)}`,
    name: getStringValue(zone, ['name', 'zoneName']) || 'Zona sin nombre',
    description: getStringValue(zone, ['description', 'details', 'detail']),
    centerLatitude: clamp(getNumberValue(zone, ['centerLatitude', 'latitude', 'lat'], DEFAULT_CENTER[0]), -90, 90),
    centerLongitude: clamp(
      getNumberValue(zone, ['centerLongitude', 'longitude', 'lng'], DEFAULT_CENTER[1]),
      -180,
      180,
    ),
    radiusMeters: clamp(getNumberValue(zone, ['radiusMeters', 'radius', 'radiusInMeters'], 500), 50, 5000),
    active: getBooleanValue(zone, ['active', 'enabled'], true),
    createdAt: normalizeDate(zone.createdAt),
    updatedAt: normalizeDate(zone.updatedAt ?? zone.modifiedAt ?? zone.lastUpdatedAt),
  }
}

function extractZoneArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const candidates = [record.zones, record.items, record.results, record.content, record.data]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  return null
}

function extractZone(payload: unknown): unknown | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>

  if (
    'centerLatitude' in record ||
    'centerLongitude' in record ||
    'radiusMeters' in record ||
    'zoneId' in record
  ) {
    return record
  }

  const nested = [record.zone, record.item, record.result, record.data]

  for (const candidate of nested) {
    if (candidate && typeof candidate === 'object') {
      return candidate
    }
  }

  return null
}

function createEditorState(zone?: Partial<Zone>): ZoneMapEditor & { description: string } {
  return {
    name: zone?.name ?? '',
    description: zone?.description ?? '',
    centerLatitude: zone?.centerLatitude ?? DEFAULT_CENTER[0],
    centerLongitude: zone?.centerLongitude ?? DEFAULT_CENTER[1],
    radiusMeters: clamp(zone?.radiusMeters ?? 500, 50, 5000),
    active: zone?.active ?? true,
  }
}

function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return 'Sin dato'
  }

  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(2)} km`
  }

  return `${distanceMeters.toFixed(1)} m`
}

function upsertZone(zones: Zone[], nextZone: Zone) {
  const index = zones.findIndex((zone) => zone.id === nextZone.id)

  if (index === -1) {
    return [...zones, nextZone]
  }

  return zones.map((zone) => (zone.id === nextZone.id ? nextZone : zone))
}

function sortZones(zones: Zone[]) {
  return [...zones].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1
    }

    return left.name.localeCompare(right.name, 'es')
  })
}

function zonesMatch(left: ZoneMapEditor & { description: string }, right: Zone | null) {
  if (!right) {
    return false
  }

  return (
    left.name.trim() === right.name &&
    left.description.trim() === right.description &&
    Math.abs(left.centerLatitude - right.centerLatitude) < 0.000001 &&
    Math.abs(left.centerLongitude - right.centerLongitude) < 0.000001 &&
    Math.round(left.radiusMeters) === Math.round(right.radiusMeters) &&
    left.active === right.active
  )
}

type ZoneEditorState = ZoneMapEditor & {
  description: string
}

export function ZonesSection({ authToken }: { authToken: string }) {
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [editorZone, setEditorZone] = useState<ZoneEditorState | null>(null)
  const [mode, setMode] = useState<ZonesMapMode>('browse')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isStatusUpdating, setIsStatusUpdating] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [validationPoint, setValidationPoint] = useState<LatLngPoint | null>(null)
  const [validationResult, setValidationResult] = useState<ZoneValidationResult | null>(null)

  const isCreating = mode === 'create'
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null
  const hasZones = zones.length > 0

  const loadZones = useCallback(
    async ({ silent = false, preferredZoneId = null }: { silent?: boolean; preferredZoneId?: string | null } = {}) => {
      if (!silent) {
        setIsLoading(true)
      }

      try {
        const response = await fetch(buildAdminZonesEndpoint(), {
          headers: buildAuthHeaders(authToken),
        })
        const payload = await parseResponsePayload(response)

        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload) ?? 'No se pudieron cargar las zonas.')
        }

        const rawZones = extractZoneArray(payload)

        if (!rawZones) {
          throw new Error('La API devolvio un formato de zonas no compatible.')
        }

        const normalizedZones = sortZones(rawZones.map(normalizeZone))

        setZones(normalizedZones)
        setSelectedZoneId((current) => {
          if (preferredZoneId && normalizedZones.some((zone) => zone.id === preferredZoneId)) {
            return preferredZoneId
          }

          if (current && normalizedZones.some((zone) => zone.id === current)) {
            return current
          }

          return normalizedZones[0]?.id ?? null
        })
        setError(null)
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : 'No se pudieron cargar las zonas disponibles.',
        )
      } finally {
        if (!silent) {
          setIsLoading(false)
        }
      }
    },
    [authToken],
  )

  useEffect(() => {
    void loadZones()
  }, [loadZones])

  useEffect(() => {
    if (!selectedZoneId || isCreating) {
      if (!selectedZoneId && !isCreating) {
        setEditorZone(null)
      }
      return
    }

    let isCancelled = false

    const loadZoneDetail = async () => {
      try {
        const response = await fetch(buildAdminZoneEndpoint(selectedZoneId), {
          headers: buildAuthHeaders(authToken),
        })
        const payload = await parseResponsePayload(response)

        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload) ?? 'No se pudo cargar el detalle de la zona.')
        }

        const rawZone = extractZone(payload) ?? payload
        const normalizedZone = normalizeZone(rawZone)

        if (isCancelled) {
          return
        }

        setZones((current) => sortZones(upsertZone(current, normalizedZone)))
        setEditorZone(createEditorState(normalizedZone))
      } catch (requestError) {
        if (isCancelled) {
          return
        }

        setError(
          requestError instanceof Error ? requestError.message : 'No se pudo cargar el detalle de la zona.',
        )
      }
    }

    void loadZoneDetail()

    return () => {
      isCancelled = true
    }
  }, [authToken, isCreating, selectedZoneId])

  const stats = useMemo(() => {
    const activeCount = zones.filter((zone) => zone.active).length
    const averageRadius =
      zones.length > 0 ? Math.round(zones.reduce((total, zone) => total + zone.radiusMeters, 0) / zones.length) : 0
    const largestZone = zones.reduce<Zone | null>(
      (current, zone) => (current === null || zone.radiusMeters > current.radiusMeters ? zone : current),
      null,
    )

    return {
      activeCount,
      averageRadius,
      largestZone,
    }
  }, [zones])

  const isDirty =
    editorZone !== null &&
    (isCreating
      ? editorZone.name.trim().length > 0 ||
        editorZone.description.trim().length > 0 ||
        Math.abs(editorZone.centerLatitude - DEFAULT_CENTER[0]) > 0.000001 ||
        Math.abs(editorZone.centerLongitude - DEFAULT_CENTER[1]) > 0.000001 ||
        Math.round(editorZone.radiusMeters) !== 500 ||
        editorZone.active !== true
      : !zonesMatch(editorZone, selectedZone))

  const canSave =
    editorZone !== null &&
    editorZone.name.trim().length > 0 &&
    editorZone.description.trim().length > 0 &&
    Number.isFinite(editorZone.centerLatitude) &&
    Number.isFinite(editorZone.centerLongitude) &&
    editorZone.radiusMeters >= 50

  const selectZone = (zoneId: string) => {
    if (isCreating) {
      return
    }

    setSelectedZoneId(zoneId)
    setMode('browse')
    setNotice(null)
  }

  const beginCreateZone = () => {
    setMode('create')
    setNotice('Haz clic sobre el mapa para colocar el centro de la nueva zona.')
    setValidationPoint(null)
    setValidationResult(null)
    setEditorZone(
      createEditorState({
        centerLatitude: selectedZone?.centerLatitude ?? DEFAULT_CENTER[0],
        centerLongitude: selectedZone?.centerLongitude ?? DEFAULT_CENTER[1],
        radiusMeters: selectedZone?.radiusMeters ?? 500,
      }),
    )
  }

  const cancelCreateZone = () => {
    setMode('browse')
    setNotice(null)

    if (selectedZone) {
      setEditorZone(createEditorState(selectedZone))
      return
    }

    setEditorZone(null)
  }

  const restoreSelectedZone = () => {
    if (!selectedZone) {
      return
    }

    setEditorZone(createEditorState(selectedZone))
    setNotice('Se restauraron los cambios locales de la zona seleccionada.')
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (mode === 'create') {
      setEditorZone((current) =>
        current
          ? {
              ...current,
              centerLatitude: clamp(lat, -90, 90),
              centerLongitude: clamp(lng, -180, 180),
            }
          : current,
      )
      return
    }

    if (mode === 'validate') {
      void validatePoint(lat, lng)
    }
  }

  const handleEditorMove = (lat: number, lng: number) => {
    setEditorZone((current) =>
      current
        ? {
            ...current,
            centerLatitude: clamp(lat, -90, 90),
            centerLongitude: clamp(lng, -180, 180),
          }
        : current,
    )
  }

  const saveZone = async () => {
    if (!editorZone) {
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const endpoint = isCreating ? buildAdminZonesEndpoint() : buildAdminZoneEndpoint(selectedZoneId ?? '')
      const response = await fetch(endpoint, {
        method: isCreating ? 'POST' : 'PUT',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({
          name: editorZone.name.trim(),
          description: editorZone.description.trim(),
          centerLatitude: editorZone.centerLatitude,
          centerLongitude: editorZone.centerLongitude,
          radiusMeters: Math.round(editorZone.radiusMeters),
          active: editorZone.active,
        }),
      })
      const payload = await parseResponsePayload(response)

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload) ?? 'No se pudo guardar la zona.')
      }

      const rawZone = extractZone(payload)
      const savedZone = rawZone ? normalizeZone(rawZone) : null

      if (savedZone) {
        setZones((current) => sortZones(upsertZone(current, savedZone)))
      }

      const preferredZoneId = savedZone?.id ?? selectedZoneId

      await loadZones({
        silent: true,
        preferredZoneId,
      })

      if (preferredZoneId) {
        setSelectedZoneId(preferredZoneId)
      }

      setMode('browse')
      setNotice(isCreating ? 'Zona creada correctamente.' : 'Zona actualizada correctamente.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar la zona.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleZoneStatus = async () => {
    if (!selectedZoneId || !editorZone || isCreating) {
      return
    }

    const nextActive = !editorZone.active

    setIsStatusUpdating(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(buildAdminZoneStatusEndpoint(selectedZoneId), {
        method: 'PATCH',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({
          active: nextActive,
        }),
      })
      const payload = await parseResponsePayload(response)

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload) ?? 'No se pudo actualizar el estado de la zona.')
      }

      setZones((current) =>
        sortZones(
          current.map((zone) =>
            zone.id === selectedZoneId
              ? {
                  ...zone,
                  active: nextActive,
                  updatedAt: new Date().toISOString(),
                }
              : zone,
          ),
        ),
      )
      setEditorZone((current) => (current ? { ...current, active: nextActive } : current))
      setNotice(nextActive ? 'Zona activada.' : 'Zona desactivada.')
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'No se pudo actualizar el estado de la zona.',
      )
    } finally {
      setIsStatusUpdating(false)
    }
  }

  async function validatePoint(lat: number, lng: number) {
    setIsValidating(true)
    setError(null)
    setValidationPoint([lat, lng])

    try {
      const response = await fetch(buildZoneValidationEndpoint(), {
        method: 'POST',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
        }),
      })
      const payload = await parseResponsePayload(response)

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload) ?? 'No se pudo validar la ubicacion.')
      }

      const result = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>

      setValidationResult({
        allowed: Boolean(result.allowed),
        zoneId:
          typeof result.zoneId === 'string' || typeof result.zoneId === 'number'
            ? String(result.zoneId)
            : null,
        zoneName: typeof result.zoneName === 'string' ? result.zoneName : null,
        distanceMeters:
          typeof result.distanceMeters === 'number' && Number.isFinite(result.distanceMeters)
            ? result.distanceMeters
            : null,
        message:
          typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : 'La API no devolvio un mensaje de validacion.',
      })
      setNotice('Validacion completada sobre el punto seleccionado.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo validar la ubicacion.')
    } finally {
      setIsValidating(false)
    }
  }

  const zoneCards = sortZones(zones)

  return (
    <>
      <SectionHeader
        title="Zonas de Cobertura"
        subtitle="Administra radios de servicio directamente sobre el mapa, mueve centros con drag y valida ubicaciones con un clic."
      />

      <section className="stats-grid">
        <article className="card stat-card">
          <div className="stat-card__top">
            <p className="stat-card__title">Zonas registradas</p>
          </div>
          <strong className="stat-card__value">{zones.length}</strong>
        </article>

        <article className="card stat-card">
          <div className="stat-card__top">
            <p className="stat-card__title">Zonas activas</p>
          </div>
          <strong className="stat-card__value">{stats.activeCount}</strong>
        </article>

        <article className="card stat-card">
          <div className="stat-card__top">
            <p className="stat-card__title">Radio promedio</p>
          </div>
          <strong className="stat-card__value">{stats.averageRadius} m</strong>
        </article>

        <article className="card stat-card">
          <div className="stat-card__top">
            <p className="stat-card__title">Mayor cobertura</p>
          </div>
          <strong className="stat-card__value">{stats.largestZone ? `${Math.round(stats.largestZone.radiusMeters)} m` : '0 m'}</strong>
          <p>{stats.largestZone?.name ?? 'Sin zonas cargadas'}</p>
        </article>
      </section>

      <section className="card detail-card zones-shell">
        <div className="fleet-shell__header">
          <div>
            <span className="fleet-shell__eyebrow">Mapa editable</span>
            <h2>Gestion visual de zonas</h2>
            <p>
              Crea una zona con un clic, ajusta su radio con presets o slider y prueba cobertura real sin salir del
              mapa.
            </p>
          </div>

          <div className="zones-toolbar">
            <button type="button" className="primary-button" onClick={beginCreateZone}>
              Nueva zona
            </button>
            <button
              type="button"
              className={`secondary-button${mode === 'validate' ? ' zones-toolbar__button--active' : ''}`}
              onClick={() => {
                if (mode === 'validate') {
                  setMode('browse')
                  setNotice(null)
                  return
                }

                setMode('validate')
                setNotice('Haz clic en cualquier punto del mapa para validarlo contra las zonas activas.')
              }}
              disabled={isCreating}
            >
              {mode === 'validate' ? 'Salir validacion' : 'Validar punto'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void loadZones()
                setNotice('Recargando zonas desde la API...')
              }}
            >
              Recargar
            </button>
          </div>
        </div>

        {error ? <div className="zones-banner zones-banner--error">{error}</div> : null}
        {notice ? <div className="zones-banner zones-banner--info">{notice}</div> : null}

        <div className="fleet-workspace zones-workspace">
          <div className="fleet-workspace__map">
            <ZonesMap
              zones={zones}
              selectedZoneId={selectedZoneId}
              editorZone={editorZone}
              isCreating={isCreating}
              mode={mode}
              validationPoint={validationPoint}
              validationResult={validationResult}
              onSelectZone={selectZone}
              onMapClick={handleMapClick}
              onEditorMove={handleEditorMove}
            />

            <div className="map-legend zones-legend">
              <span>
                <span className="legend-dot legend-dot--blue"></span>
                Zona activa
              </span>
              <span>
                <span className="legend-dot zones-legend__dot zones-legend__dot--gray"></span>
                Zona inactiva
              </span>
              <span>
                <span className="legend-dot legend-dot--green"></span>
                Edicion actual
              </span>
              <span>
                <span className="legend-dot zones-legend__dot zones-legend__dot--red"></span>
                Punto validado
              </span>
            </div>
          </div>

          <aside className="fleet-sidebar-panel">
            <div className="fleet-spotlight-card zones-inspector">
              <div className="fleet-sidebar-panel__head">
                <div>
                  <span className="fleet-shell__eyebrow">{isCreating ? 'Nueva zona' : 'Inspector'}</span>
                  <h3>
                    {isCreating
                      ? editorZone?.name.trim() || 'Zona en creacion'
                      : selectedZone?.name ?? 'Selecciona una zona'}
                  </h3>
                  <p>
                    {isCreating
                      ? 'Ajusta nombre, descripcion y radio. El centro se mueve con clic o arrastrando el marcador.'
                      : selectedZone
                        ? 'Edita sobre la marcha y guarda solo cuando el resultado te guste en el mapa.'
                        : 'Elige una zona del mapa o crea una nueva para empezar.'}
                  </p>
                </div>
                {editorZone ? (
                  <button
                    type="button"
                    className={`zones-toggle${editorZone.active ? ' zones-toggle--active' : ''}`}
                    onClick={() => {
                      if (isCreating) {
                        setEditorZone((current) => (current ? { ...current, active: !current.active } : current))
                        return
                      }

                      void toggleZoneStatus()
                    }}
                    disabled={isStatusUpdating}
                  >
                    {editorZone.active ? 'Activa' : 'Inactiva'}
                  </button>
                ) : null}
              </div>

              <div className="fleet-spotlight-card__body">
                {!editorZone ? (
                  <EmptyState
                    title="Sin zona en foco"
                    copy="Crea una zona nueva o selecciona una existente en el mapa para editarla."
                  />
                ) : (
                  <div className="zones-editor">
                    <label className="zones-field">
                      <span>Nombre visible</span>
                      <input
                        type="text"
                        value={editorZone.name}
                        placeholder="Zona Centro"
                        onChange={(event) =>
                          setEditorZone((current) =>
                            current
                              ? {
                                  ...current,
                                  name: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </label>

                    <label className="zones-field">
                      <span>Descripcion operativa</span>
                      <textarea
                        rows={3}
                        value={editorZone.description}
                        placeholder="Cobertura principal para viajes cortos"
                        onChange={(event) =>
                          setEditorZone((current) =>
                            current
                              ? {
                                  ...current,
                                  description: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </label>

                    <div className="zones-radius-card">
                      <div className="zones-radius-card__head">
                        <div>
                          <span>Radio de cobertura</span>
                          <strong>{Math.round(editorZone.radiusMeters)} m</strong>
                        </div>
                        <span className="tag tag--blue">{Math.round(editorZone.radiusMeters / 10) / 100} km</span>
                      </div>

                      <input
                        className="zones-radius-slider"
                        type="range"
                        min="50"
                        max="2500"
                        step="25"
                        value={editorZone.radiusMeters}
                        onChange={(event) =>
                          setEditorZone((current) =>
                            current
                              ? {
                                  ...current,
                                  radiusMeters: clamp(Number(event.target.value), 50, 5000),
                                }
                              : current,
                          )
                        }
                      />

                      <div className="zones-preset-list">
                        {RADIUS_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className={`zones-preset-chip${
                              Math.round(editorZone.radiusMeters) === preset ? ' zones-preset-chip--active' : ''
                            }`}
                            onClick={() =>
                              setEditorZone((current) =>
                                current
                                  ? {
                                      ...current,
                                      radiusMeters: preset,
                                    }
                                  : current,
                              )
                            }
                          >
                            {preset} m
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="zones-coordinate-grid">
                      <article className="zones-coordinate-card">
                        <span>Latitud</span>
                        <strong>{editorZone.centerLatitude.toFixed(6)}</strong>
                      </article>
                      <article className="zones-coordinate-card">
                        <span>Longitud</span>
                        <strong>{editorZone.centerLongitude.toFixed(6)}</strong>
                      </article>
                    </div>

                    {!isCreating && selectedZone ? (
                      <div className="fleet-detail-list zones-detail-list">
                        <div className="fleet-detail-list__row">
                          <span>Estado publicado</span>
                          <strong>{selectedZone.active ? 'Activo' : 'Inactivo'}</strong>
                        </div>
                        <div className="fleet-detail-list__row">
                          <span>Ultima actualizacion</span>
                          <strong>{formatDateTime(selectedZone.updatedAt)}</strong>
                        </div>
                      </div>
                    ) : null}

                    <div className="button-row zones-button-row">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          void saveZone()
                        }}
                        disabled={!canSave || isSaving}
                      >
                        {isSaving ? 'Guardando...' : isCreating ? 'Crear zona' : 'Guardar cambios'}
                      </button>

                      {isCreating ? (
                        <button type="button" className="secondary-button" onClick={cancelCreateZone}>
                          Cancelar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={restoreSelectedZone}
                          disabled={!isDirty}
                        >
                          Deshacer cambios
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="fleet-sidebar-panel__block">
              <div className="fleet-sidebar-panel__head">
                <div>
                  <span className="fleet-shell__eyebrow">Validacion</span>
                  <h3>Punto de prueba</h3>
                  <p>Usa el modo de validacion para comprobar en vivo si una ubicacion cae en una zona activa.</p>
                </div>
                {mode === 'validate' ? <span className="tag tag--green">Modo activo</span> : null}
              </div>

              {validationPoint && validationResult ? (
                <div className={`zones-validation-card${validationResult.allowed ? ' zones-validation-card--allowed' : ' zones-validation-card--blocked'}`}>
                  <strong>{validationResult.allowed ? 'Acceso permitido' : 'Fuera de cobertura'}</strong>
                  <p>{validationResult.message}</p>
                  <div className="zones-validation-meta">
                    <span>
                      Punto: {validationPoint[0].toFixed(5)}, {validationPoint[1].toFixed(5)}
                    </span>
                    <span>Distancia: {formatDistance(validationResult.distanceMeters)}</span>
                    <span>Zona: {validationResult.zoneName ?? 'Sin coincidencia'}</span>
                  </div>
                </div>
              ) : (
                <div className="fleet-sidebar-panel__empty">
                  <strong>{isValidating ? 'Validando...' : 'Sin prueba reciente'}</strong>
                  <p>Activa "Validar punto" y haz clic sobre el mapa para recibir la respuesta de la API.</p>
                </div>
              )}
            </div>

            <div className="fleet-sidebar-panel__block">
              <div className="fleet-sidebar-panel__head">
                <div>
                  <span className="fleet-shell__eyebrow">Listado rapido</span>
                  <h3>Zonas disponibles</h3>
                  <p>Selecciona una tarjeta para enfocar y editar esa cobertura.</p>
                </div>
                <span className="tag tag--blue">{zones.length}</span>
              </div>

              {isLoading && !hasZones ? (
                <div className="fleet-sidebar-panel__empty">
                  <strong>Cargando zonas...</strong>
                  <p>Esperando respuesta de la API admin/zones.</p>
                </div>
              ) : zoneCards.length === 0 ? (
                <div className="fleet-sidebar-panel__empty">
                  <strong>No hay zonas todavia</strong>
                  <p>Crea la primera zona desde el boton superior para comenzar a definir cobertura.</p>
                </div>
              ) : (
                <div className="zones-card-list">
                  {zoneCards.map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      className={`zones-zone-card${selectedZoneId === zone.id && !isCreating ? ' zones-zone-card--selected' : ''}`}
                      onClick={() => selectZone(zone.id)}
                    >
                      <div className="zones-zone-card__head">
                        <strong>{zone.name}</strong>
                        <span className={`tag tag--${zone.active ? 'green' : 'red'}`}>
                          {zone.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <p>{zone.description || 'Sin descripcion operativa'}</p>
                      <div className="zones-zone-card__meta">
                        <span>{Math.round(zone.radiusMeters)} m</span>
                        <span>
                          {zone.centerLatitude.toFixed(4)}, {zone.centerLongitude.toFixed(4)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
