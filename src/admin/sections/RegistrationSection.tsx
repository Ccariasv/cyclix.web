import { useEffect, useRef, useState } from 'react'
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { bikeSizeOptions, bikeStatusOptions, bikeTypeOptions, DEFAULT_CENTER } from '../constants'
import { DataTable, EmptyState } from '../components/common'
import { FleetMap } from '../components/FleetMap'
import type { AdminData, Bike, BikeStatus, BikeType, PlacementTarget, Station, StationStatus } from '../types'
import {
  buildAuthHeaders,
  buildBicicletaUpdateEndpoint,
  buildBicicletasEndpoint,
  buildBicicletasSinPuestoEndpoint,
  buildJsonAuthHeaders,
  buildPuestosEndpoint,
  buildPuestoStatusEndpoint,
  buildPuestoUpdateEndpoint,
  toApiBikeStatus,
  toApiBikeType,
} from '../../api'
import {
  clamp,
  generateId,
  getNowIso,
  peekNextBikeSerial,
  reserveNextBikeSerial,
  getBikeLabel,
  getBikeStatusLabel,
  getBikeTone,
  getStationStatusLabel,
  getStationTone,
  normalizeBikes,
} from '../utils'

type RegistryTableView = 'stations' | 'bikes'

type StationFormState = {
  name: string
  zone: string
  capacity: string
  lat: string
  lng: string
}

type BikeFormState = {
  color: string
  size: string
  bikeType: BikeType
  status: BikeStatus
  stationId: string
  notes: string
}

type AssignBikeFormState = {
  bikeId: string
}

type RegistryMenuAction = {
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

type RegistryMenuPosition = {
  top: number
  left: number
  direction: 'up' | 'down'
}

const createEmptyStationForm = (): StationFormState => ({
  name: '',
  zone: '',
  capacity: '10',
  lat: '',
  lng: '',
})

const createBikeForm = (stationId: string): BikeFormState => ({
  color: '',
  size: 'Mediana',
  bikeType: 'Urbana',
  status: 'available',
  stationId,
  notes: '',
})

const createAssignBikeForm = (): AssignBikeFormState => ({
  bikeId: '',
})

function getInUseBikeCoordinates(station: Station) {
  return {
    lat: clamp(station.lat + 0.00115, -90, 90),
    lng: clamp(station.lng + 0.00135, -180, 180),
  }
}

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

function ensureOk(response: Response, payload: unknown, fallback: string) {
  if (response.ok) {
    return
  }

  throw new Error(getApiErrorMessage(payload) ?? fallback)
}

function extractBikeArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const candidates = [record.bicicletas, record.data, record.items, record.results, record.content]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  return null
}

function RegistryTableMenu({
  menuId,
  openMenuId,
  setOpenMenuId,
  actions,
}: {
  menuId: string
  openMenuId: string | null
  setOpenMenuId: Dispatch<SetStateAction<string | null>>
  actions: RegistryMenuAction[]
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<RegistryMenuPosition | null>(null)
  const isOpen = openMenuId === menuId

  const toggleMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (isOpen) {
      setOpenMenuId(null)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const estimatedHeight = actions.length * 44 + 20
    const direction = rect.bottom + estimatedHeight > window.innerHeight - 16 ? 'up' : 'down'

    setPosition({
      top: direction === 'down' ? rect.bottom + 8 : rect.top - 8,
      left: rect.right,
      direction,
    })
    setOpenMenuId(menuId)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }

      setOpenMenuId(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
      }
    }

    const handleResize = () => {
      setOpenMenuId(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen, setOpenMenuId])

  return (
    <>
      <div className="registry-table-menu">
        <button
          ref={triggerRef}
          type="button"
          className="registry-table-menu__trigger"
          aria-label="Opciones"
          aria-expanded={isOpen}
          onClick={toggleMenu}
        >
          ...
        </button>
      </div>
      {isOpen && position
        ? createPortal(
            <div
              ref={menuRef}
              className={`registry-floating-menu registry-floating-menu--${position.direction}`}
              style={{ top: position.top, left: position.left }}
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={`registry-floating-menu__item${
                    action.danger ? ' registry-floating-menu__item--danger' : ''
                  }`}
                  disabled={action.disabled}
                  onClick={() => {
                    setOpenMenuId(null)
                    action.onSelect()
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function RegistrationSection({
  authToken,
  data,
  setData,
}: {
  authToken: string
  data: AdminData
  setData: Dispatch<SetStateAction<AdminData>>
}) {
  const activeStations = data.stations.filter((station) => station.isActive)
  const activeBikes = data.bikes.filter((bike) => bike.isActive)
  const operationalStationId = activeStations[0]?.id ?? ''
  const [placementTarget, setPlacementTarget] = useState<PlacementTarget>(null)
  const [showStationModal, setShowStationModal] = useState(false)
  const [showBikeModal, setShowBikeModal] = useState(false)
  const [showAssignBikeModal, setShowAssignBikeModal] = useState(false)
  const [registryTableView, setRegistryTableView] = useState<RegistryTableView>('stations')
  const [editingStationId, setEditingStationId] = useState<string | null>(null)
  const [editingBikeId, setEditingBikeId] = useState<string | null>(null)
  const [assignStationId, setAssignStationId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [stationForm, setStationForm] = useState<StationFormState>(createEmptyStationForm)
  const [bikeForm, setBikeForm] = useState<BikeFormState>(() => createBikeForm(operationalStationId))
  const [assignBikeForm, setAssignBikeForm] = useState<AssignBikeFormState>(createAssignBikeForm)
  const [assignableBikesSource, setAssignableBikesSource] = useState<Bike[] | null>(null)

  const hasStationLocation = stationForm.lat !== '' && stationForm.lng !== ''
  const nextBikeSerial = peekNextBikeSerial(data.bikes)
  const isEditingStation = editingStationId !== null
  const isEditingBike = editingBikeId !== null
  const assignStation = assignStationId
    ? data.stations.find((station) => station.id === assignStationId && station.isActive) ?? null
    : null
  const assignableBikes = (assignableBikesSource ?? activeBikes)
    .filter((bike) => bike.stationId !== assignStationId)
    .sort((left, right) => getBikeLabel(left).localeCompare(getBikeLabel(right)))

  useEffect(() => {
    if (!showAssignBikeModal) {
      return
    }

    let isCancelled = false

    const loadAssignableBikes = async () => {
      try {
        const response = await fetch(buildBicicletasSinPuestoEndpoint(), {
          headers: buildAuthHeaders(authToken),
        })
        const payload = await parseResponsePayload(response)
        ensureOk(response, payload, 'No se pudieron cargar las bicicletas sin puesto.')
        const rawBikes = extractBikeArray(payload)

        if (!rawBikes || isCancelled) {
          return
        }

        setAssignableBikesSource(normalizeBikes(rawBikes))
      } catch {
        if (!isCancelled) {
          setAssignableBikesSource(null)
        }
      }
    }

    void loadAssignableBikes()

    return () => {
      isCancelled = true
    }
  }, [authToken, showAssignBikeModal])

  const resetStationForm = () => {
    setEditingStationId(null)
    setStationForm(createEmptyStationForm())
    setPlacementTarget(null)
  }

  const resetBikeForm = () => {
    setEditingBikeId(null)
    setBikeForm(createBikeForm(activeStations[0]?.id ?? ''))
  }

  const resetAssignBikeForm = () => {
    setAssignStationId(null)
    setAssignBikeForm(createAssignBikeForm())
    setAssignableBikesSource(null)
  }

  const closeStationModal = () => {
    setShowStationModal(false)
    resetStationForm()
  }

  const closeBikeModal = () => {
    setShowBikeModal(false)
    resetBikeForm()
  }

  const closeAssignBikeModal = () => {
    setShowAssignBikeModal(false)
    resetAssignBikeForm()
  }

  const openCreateStationModal = () => {
    resetStationForm()
    setShowStationModal(true)
  }

  const openEditStationModal = (station: Station) => {
    setEditingStationId(station.id)
    setStationForm({
      name: station.name,
      zone: station.zone,
      capacity: String(station.capacity),
      lat: station.lat.toFixed(5),
      lng: station.lng.toFixed(5),
    })
    setPlacementTarget(null)
    setShowStationModal(true)
  }

  const openCreateBikeModal = (stationId?: string) => {
    setEditingBikeId(null)
    setBikeForm(createBikeForm(stationId ?? activeStations[0]?.id ?? ''))
    setShowBikeModal(true)
  }

  const openAssignBikeModal = (stationId: string) => {
    setAssignStationId(stationId)
    setAssignBikeForm(createAssignBikeForm())
    setAssignableBikesSource(null)
    setShowAssignBikeModal(true)
  }

  const openEditBikeModal = (bike: Bike) => {
    setEditingBikeId(bike.id)
    setBikeForm({
      color: bike.color,
      size: bike.size,
      bikeType: bike.bikeType,
      status: bike.status,
      stationId: bike.stationId ?? activeStations[0]?.id ?? '',
      notes: bike.notes,
    })
    setShowBikeModal(true)
  }

  const saveStation = async () => {
    if (!stationForm.name.trim() || !stationForm.zone.trim() || !hasStationLocation) {
      return
    }

    const now = getNowIso()
    const payload = {
      nombre: stationForm.name.trim(),
      ubicacion: stationForm.zone.trim(),
      capacidad: clamp(Number(stationForm.capacity) || 0, 1, 500),
      latitud: clamp(Number(stationForm.lat) || DEFAULT_CENTER[0], -90, 90),
      longitud: clamp(Number(stationForm.lng) || DEFAULT_CENTER[1], -180, 180),
    }

    if (editingStationId) {
      const response = await fetch(buildPuestoUpdateEndpoint(editingStationId), {
        method: 'PUT',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify(payload),
      })
      const responsePayload = await parseResponsePayload(response)
      ensureOk(response, responsePayload, 'No se pudo actualizar el puesto.')

      setData((current) => ({
        ...current,
        stations: current.stations.map((station) =>
          station.id === editingStationId
            ? {
                ...station,
                name: payload.nombre,
                zone: payload.ubicacion,
                capacity: payload.capacidad,
                lat: payload.latitud,
                lng: payload.longitud,
                updatedAt: now,
              }
            : station,
        ),
        bikes: current.bikes.map((bike) =>
          bike.stationId === editingStationId
            ? {
                ...bike,
                lat: payload.latitud,
                lng: payload.longitud,
                updatedAt: now,
              }
            : bike,
        ),
      }))
    } else {
      const response = await fetch(buildPuestosEndpoint(), {
        method: 'POST',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify(payload),
      })
      const responsePayload = await parseResponsePayload(response)
      ensureOk(response, responsePayload, 'No se pudo crear el puesto.')

      const station: Station = {
        id: generateId('station'),
        name: payload.nombre,
        zone: payload.ubicacion,
        capacity: payload.capacidad,
        lat: payload.latitud,
        lng: payload.longitud,
        status: 'active',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }

      setData((current) => ({
        ...current,
        stations: [...current.stations, station],
      }))

      setBikeForm((current) => ({
        ...current,
        stationId: current.stationId || station.id,
      }))
    }

    setRegistryTableView('stations')
    closeStationModal()
  }

  const saveBike = async () => {
    if (!bikeForm.color.trim() || !bikeForm.stationId) {
      return
    }

    const station = data.stations.find((item) => item.id === bikeForm.stationId && item.isActive)
    if (!station) {
      return
    }

    const now = getNowIso()
    const currentBike = editingBikeId ? data.bikes.find((bike) => bike.id === editingBikeId) ?? null : null
    const serialNumber = currentBike?.serialNumber ?? reserveNextBikeSerial(data.bikes)
    const isInUse = bikeForm.status === 'in_use'
    const inUseCoordinates = getInUseBikeCoordinates(station)
    const nextStationId = isInUse ? null : station.id
    const nextLat = isInUse ? (currentBike?.stationId === null ? currentBike.lat : inUseCoordinates.lat) : station.lat
    const nextLng = isInUse ? (currentBike?.stationId === null ? currentBike.lng : inUseCoordinates.lng) : station.lng
    const payload = {
      serialNumber,
      color: bikeForm.color.trim(),
      tipo: toApiBikeType(bikeForm.bikeType),
      estado: toApiBikeStatus(bikeForm.status),
      puestoId: nextStationId,
      notas: bikeForm.notes.trim(),
    }

    if (editingBikeId) {
      try {
        const response = await fetch(buildBicicletaUpdateEndpoint(editingBikeId), {
          method: 'PUT',
          headers: buildJsonAuthHeaders(authToken),
          body: JSON.stringify(payload),
        })
        const responsePayload = await parseResponsePayload(response)
        ensureOk(response, responsePayload, 'No se pudo actualizar la bicicleta.')
      } catch {
        // Fallback local para modo demo o API no disponible.
      }

      setData((current) => ({
        ...current,
        bikes: current.bikes.map((bike) =>
          bike.id === editingBikeId
            ? {
                ...bike,
                code: serialNumber,
                serialNumber,
                color: payload.color,
                size: bikeForm.size,
                bikeType: bikeForm.bikeType,
                status: bikeForm.status,
                stationId: nextStationId,
                lat: nextLat,
                lng: nextLng,
                notes: payload.notas,
                isActive: bikeForm.status !== 'out_of_service',
                updatedAt: now,
              }
            : bike,
        ),
      }))
    } else {
      try {
        const response = await fetch(buildBicicletasEndpoint(), {
          method: 'POST',
          headers: buildJsonAuthHeaders(authToken),
          body: JSON.stringify(payload),
        })
        const responsePayload = await parseResponsePayload(response)
        ensureOk(response, responsePayload, 'No se pudo crear la bicicleta.')
      } catch {
        // Fallback local para modo demo o API no disponible.
      }

      const bike: Bike = {
        id: generateId('bike'),
        code: serialNumber,
        serialNumber,
        color: payload.color,
        size: bikeForm.size,
        bikeType: bikeForm.bikeType,
        battery: 100,
        status: bikeForm.status,
        stationId: nextStationId,
        lat: nextLat,
        lng: nextLng,
        notes: payload.notas,
        isActive: bikeForm.status !== 'out_of_service',
        createdAt: now,
        updatedAt: now,
      }

      setData((current) => ({
        ...current,
        bikes: [...current.bikes, bike],
      }))
    }

    setRegistryTableView('bikes')
    closeBikeModal()
  }

  const updateStationStatus = async (station: Station, status: StationStatus) => {
    const response = await fetch(buildPuestoStatusEndpoint(station.id, status), {
      method: 'PATCH',
      headers: buildAuthHeaders(authToken),
    })
    const responsePayload = await parseResponsePayload(response)
    ensureOk(response, responsePayload, 'No se pudo actualizar el estado del puesto.')

    const now = getNowIso()

    setData((current) => ({
      ...current,
      stations: current.stations.map((item) =>
        item.id === station.id
          ? {
              ...item,
              status,
              isActive: status === 'active',
              updatedAt: now,
            }
          : item,
      ),
      bikes: current.bikes.map((bike) =>
        status !== 'active' && bike.stationId === station.id && bike.isActive
          ? {
              ...bike,
              stationId: null,
              lat: station.lat,
              lng: station.lng,
              updatedAt: now,
            }
          : bike,
      ),
    }))
  }

  const markBikeOutOfService = async (bikeId: string) => {
    const bike = data.bikes.find((item) => item.id === bikeId)
    if (!bike) {
      return
    }

    const response = await fetch(buildBicicletaUpdateEndpoint(bike.id), {
      method: 'PUT',
      headers: buildJsonAuthHeaders(authToken),
      body: JSON.stringify({
        serialNumber: bike.serialNumber,
        color: bike.color,
        tipo: toApiBikeType(bike.bikeType),
        estado: toApiBikeStatus('out_of_service'),
        puestoId: bike.stationId,
        notas: bike.notes,
      }),
    })
    const responsePayload = await parseResponsePayload(response)
    ensureOk(response, responsePayload, 'No se pudo actualizar el estado de la bicicleta.')

    const now = getNowIso()

    setData((current) => ({
      ...current,
      bikes: current.bikes.map((item) =>
        item.id === bikeId
          ? {
              ...item,
              status: 'out_of_service',
              isActive: false,
              updatedAt: now,
            }
          : item,
      ),
    }))
  }

  const assignExistingBike = async () => {
    if (!assignStation || !assignBikeForm.bikeId) {
      return
    }

    const bike = data.bikes.find((item) => item.id === assignBikeForm.bikeId)
    if (!bike) {
      return
    }

    const response = await fetch(buildBicicletaUpdateEndpoint(bike.id), {
      method: 'PUT',
      headers: buildJsonAuthHeaders(authToken),
      body: JSON.stringify({
        serialNumber: bike.serialNumber,
        color: bike.color,
        tipo: toApiBikeType(bike.bikeType),
        estado: toApiBikeStatus(bike.status),
        puestoId: assignStation.id,
        notas: bike.notes,
      }),
    })
    const responsePayload = await parseResponsePayload(response)
    ensureOk(response, responsePayload, 'No se pudo asignar la bicicleta al puesto.')

    const now = getNowIso()

    setData((current) => ({
      ...current,
      bikes: current.bikes.map((item) =>
        item.id === assignBikeForm.bikeId
          ? {
              ...item,
              stationId: assignStation.id,
              lat: assignStation.lat,
              lng: assignStation.lng,
              updatedAt: now,
            }
          : item,
      ),
    }))

    setRegistryTableView('stations')
    closeAssignBikeModal()
  }

  const placeOnMap = (lat: number, lng: number) => {
    if (!placementTarget || (placementTarget.type !== 'new_station' && placementTarget.type !== 'station')) {
      return
    }

    setStationForm((current) => ({
      ...current,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
    }))
    setPlacementTarget(null)
  }

  const sortedStations = [...data.stations].sort(
    (left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name),
  )
  const sortedBikes = [...data.bikes].sort(
    (left, right) => Number(right.isActive) - Number(left.isActive) || getBikeLabel(left).localeCompare(getBikeLabel(right)),
  )

  return (
    <>
      <header className="page-header registry-header">
        <h1>Registro</h1>
        <div className="registry-header__actions">
          <button type="button" className="secondary-button" onClick={openCreateStationModal}>
            Registrar puesto
          </button>
          <button
            type="button"
            className="primary-button registry-header__primary-action"
            onClick={() => openCreateBikeModal()}
            disabled={activeStations.length === 0}
          >
            Registrar bicicleta
          </button>
        </div>
      </header>

      <section className="summary-grid">
        <article className="card summary-card">
          <span className="summary-card__label">Puestos registrados</span>
          <strong>{data.stations.length}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Bicicletas registradas</span>
          <strong>{data.bikes.length}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Proximo numero de serie</span>
          <strong>{nextBikeSerial}</strong>
        </article>
      </section>

      <section className="card detail-card">
        <div className="card-head">
          <h2>Registros existentes</h2>
          <div className="registry-table-switch" role="tablist" aria-label="Cambiar tabla de registro">
            <button
              type="button"
              className={`registry-table-switch__button${
                registryTableView === 'stations' ? ' registry-table-switch__button--active' : ''
              }`}
              onClick={() => setRegistryTableView('stations')}
            >
              Puestos
            </button>
            <button
              type="button"
              className={`registry-table-switch__button${
                registryTableView === 'bikes' ? ' registry-table-switch__button--active' : ''
              }`}
              onClick={() => setRegistryTableView('bikes')}
            >
              Bicicletas
            </button>
          </div>
        </div>

        {registryTableView === 'stations' ? (
          sortedStations.length === 0 ? (
            <EmptyState title="Sin puestos" copy="Cuando registres el primer puesto, aparecera aqui." />
          ) : (
            <DataTable
              columns={['Nombre', 'Ubicacion', 'Capacidad', 'Estado', 'Opciones']}
              rowKeys={sortedStations.map((station) => station.id)}
              rows={sortedStations.map((station) => [
                station.name,
                station.zone,
                `${station.capacity} espacios`,
                <span key={`${station.id}-status`} className={`tag tag--${getStationTone(station.status)}`}>
                  {getStationStatusLabel(station.status)}
                </span>,
                <RegistryTableMenu
                  key={`${station.id}-actions`}
                  menuId={`station-${station.id}`}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  actions={[
                    {
                      label: 'Editar',
                      onSelect: () => openEditStationModal(station),
                    },
                    {
                      label: 'Agregar bicicleta',
                      disabled: station.status !== 'active' || activeBikes.length === 0,
                      onSelect: () => openAssignBikeModal(station.id),
                    },
                    {
                      label: 'Activar',
                      disabled: station.status === 'active',
                      onSelect: () => void updateStationStatus(station, 'active'),
                    },
                    {
                      label: 'Mantenimiento',
                      disabled: station.status === 'maintenance',
                      onSelect: () => void updateStationStatus(station, 'maintenance'),
                    },
                    {
                      label: 'Desactivar',
                      danger: true,
                      disabled: station.status === 'inactive',
                      onSelect: () => void updateStationStatus(station, 'inactive'),
                    },
                  ]}
                />,
              ])}
            />
          )
        ) : sortedBikes.length === 0 ? (
          <EmptyState title="Sin bicicletas" copy="Cuando registres la primera bicicleta, aparecera aqui." />
        ) : (
          <DataTable
            columns={['Serie', 'Tipo', 'Color', 'Puesto', 'Estado', 'Opciones']}
            rowKeys={sortedBikes.map((bike) => bike.id)}
            rows={sortedBikes.map((bike) => [
              getBikeLabel(bike),
              bike.bikeType,
              bike.color,
              data.stations.find((station) => station.id === bike.stationId)?.name ?? 'Sin puesto',
              <span key={`${bike.id}-status`} className={`tag tag--${getBikeTone(bike.status)}`}>
                {getBikeStatusLabel(bike.status)}
              </span>,
              <RegistryTableMenu
                key={`${bike.id}-actions`}
                menuId={`bike-${bike.id}`}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                actions={[
                  {
                    label: 'Editar',
                    onSelect: () => openEditBikeModal(bike),
                  },
                    {
                      label: 'Fuera de servicio',
                      danger: true,
                      disabled: bike.status === 'out_of_service',
                      onSelect: () => void markBikeOutOfService(bike.id),
                    },
                  ]}
                />,
            ])}
          />
        )}
      </section>

      {showStationModal && (
        <div className="registry-location-modal" role="dialog" aria-modal="true" aria-labelledby="station-register-title">
          <div className="registry-location-modal__backdrop" onClick={closeStationModal}></div>
          <div className="registry-location-modal__panel">
            <div className="registry-location-modal__header">
              <div>
                <span className="fleet-shell__eyebrow">{isEditingStation ? 'Edicion de puesto' : 'Nuevo puesto'}</span>
                <h2 id="station-register-title">{isEditingStation ? 'Editar puesto' : 'Registrar puesto'}</h2>
                <p>Completa la informacion y asigna la ubicacion desde el mapa.</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeStationModal}>
                Cerrar
              </button>
            </div>

            <div className="registry-location-modal__body">
              <div className="card detail-card">
                <div className="card-head">
                  <h2>Datos del puesto</h2>
                  <span
                    className={`tag tag--${
                      placementTarget
                        ? 'blue'
                        : hasStationLocation
                          ? 'green'
                          : 'orange'
                    }`}
                  >
                    {placementTarget
                      ? 'Seleccionando en mapa'
                      : hasStationLocation
                        ? 'Ubicacion seleccionada'
                        : 'Ubicacion pendiente'}
                  </span>
                </div>

                <div className="form-grid">
                  <label className="control">
                    <span>Nombre</span>
                    <input
                      value={stationForm.name}
                      onChange={(event) => setStationForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Puesto Centro"
                    />
                  </label>
                  <label className="control">
                    <span>Ubicacion</span>
                    <input
                      value={stationForm.zone}
                      onChange={(event) => setStationForm((current) => ({ ...current, zone: event.target.value }))}
                      placeholder="Parque Central, Zacapa"
                    />
                  </label>
                  <label className="control">
                    <span>Cuantas bicicletas tendra</span>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={stationForm.capacity}
                      onChange={(event) =>
                        setStationForm((current) => ({ ...current, capacity: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <p className="fleet-form-hint">
                  La ubicacion se define desde un menu flotante con mapa. Abre la seleccion y marca el punto exacto.
                </p>

                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setPlacementTarget((current) =>
                        current
                          ? null
                          : isEditingStation && editingStationId
                            ? { type: 'station', id: editingStationId }
                            : { type: 'new_station' },
                      )
                    }
                  >
                    {placementTarget ? 'Cancelar seleccion en mapa' : 'Seleccionar ubicacion en mapa'}
                  </button>
                  <button type="button" className="primary-button" onClick={() => void saveStation()} disabled={!hasStationLocation}>
                    {isEditingStation ? 'Guardar cambios' : 'Crear puesto'}
                  </button>
                </div>
              </div>

              <aside className="registry-location-modal__aside">
                <div className="fleet-sidebar-panel__block">
                  <div className="fleet-sidebar-panel__head">
                    <div>
                      <span className="fleet-shell__eyebrow">Resumen</span>
                      <h3>{stationForm.name || (isEditingStation ? 'Puesto en edicion' : 'Nuevo puesto')}</h3>
                      <p>{stationForm.zone || 'Agrega una referencia de ubicacion antes de guardar el puesto.'}</p>
                    </div>
                    <span className={`tag tag--${hasStationLocation ? 'green' : 'orange'}`}>
                      {hasStationLocation ? 'Punto seleccionado' : 'Punto pendiente'}
                    </span>
                  </div>

                  <div className="fleet-detail-list">
                    <div className="fleet-detail-list__row">
                      <span>Puestos activos</span>
                      <strong>{activeStations.length}</strong>
                    </div>
                    <div className="fleet-detail-list__row">
                      <span>Capacidad planificada</span>
                      <strong>{stationForm.capacity || '0'} espacios</strong>
                    </div>
                    <div className="fleet-detail-list__row">
                      <span>Coordenadas</span>
                      <strong>{hasStationLocation ? `${stationForm.lat}, ${stationForm.lng}` : 'Pendientes'}</strong>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {showBikeModal && (
        <div className="registry-location-modal" role="dialog" aria-modal="true" aria-labelledby="bike-register-title">
          <div className="registry-location-modal__backdrop" onClick={closeBikeModal}></div>
          <div className="registry-location-modal__panel registry-location-modal__panel--narrow">
            <div className="registry-location-modal__header">
              <div>
                <span className="fleet-shell__eyebrow">{isEditingBike ? 'Edicion de bicicleta' : 'Nueva bicicleta'}</span>
                <h2 id="bike-register-title">{isEditingBike ? 'Editar bicicleta' : 'Registrar bicicleta'}</h2>
                <p>Completa los datos de la bicicleta y asignala a un puesto.</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeBikeModal}>
                Cerrar
              </button>
            </div>

            {activeStations.length === 0 ? (
              <EmptyState
                title="No hay puestos activos"
                copy="Necesitas al menos un puesto activo para registrar o reasignar bicicletas."
              />
            ) : (
              <>
                <div className="form-grid">
                  <label className="control">
                    <span>Numero de serie</span>
                    <input
                      value={
                        isEditingBike
                          ? getBikeLabel(data.bikes.find((bike) => bike.id === editingBikeId) as Bike)
                          : nextBikeSerial
                      }
                      readOnly
                    />
                  </label>
                  <label className="control">
                    <span>Color</span>
                    <input
                      value={bikeForm.color}
                      onChange={(event) => setBikeForm((current) => ({ ...current, color: event.target.value }))}
                      placeholder="Azul"
                    />
                  </label>
                  <label className="control">
                    <span>Tamano</span>
                    <select
                      value={bikeForm.size}
                      onChange={(event) => setBikeForm((current) => ({ ...current, size: event.target.value }))}
                    >
                      {bikeSizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control">
                    <span>Tipo</span>
                    <select
                      value={bikeForm.bikeType}
                      onChange={(event) => setBikeForm((current) => ({ ...current, bikeType: event.target.value as BikeType }))}
                    >
                      {bikeTypeOptions.map((bikeType) => (
                        <option key={bikeType} value={bikeType}>
                          {bikeType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control">
                    <span>Estado</span>
                    <select
                      value={bikeForm.status}
                      onChange={(event) =>
                        setBikeForm((current) => ({ ...current, status: event.target.value as BikeStatus }))
                      }
                    >
                      {bikeStatusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control">
                    <span>Puesto</span>
                    <select
                      value={bikeForm.stationId}
                      onChange={(event) => setBikeForm((current) => ({ ...current, stationId: event.target.value }))}
                    >
                      <option value="">Selecciona un puesto</option>
                      {activeStations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control control--full">
                    <span>Notas</span>
                    <textarea
                      rows={3}
                      value={bikeForm.notes}
                      onChange={(event) => setBikeForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Observaciones de la bicicleta"
                    />
                  </label>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void saveBike()}
                    disabled={!bikeForm.color.trim() || !bikeForm.stationId}
                  >
                    {isEditingBike ? 'Guardar cambios' : 'Registrar bicicleta'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAssignBikeModal && (
        <div className="registry-location-modal" role="dialog" aria-modal="true" aria-labelledby="assign-bike-title">
          <div className="registry-location-modal__backdrop" onClick={closeAssignBikeModal}></div>
          <div className="registry-location-modal__panel registry-location-modal__panel--narrow">
            <div className="registry-location-modal__header">
              <div>
                <span className="fleet-shell__eyebrow">Bicicleta existente</span>
                <h2 id="assign-bike-title">Agregar bicicleta a puesto</h2>
                <p>
                  {assignStation
                    ? `Selecciona una bicicleta ya creada para asignarla a ${assignStation.name}.`
                    : 'Selecciona un puesto valido para continuar.'}
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={closeAssignBikeModal}>
                Cerrar
              </button>
            </div>

            {!assignStation ? (
              <EmptyState title="Puesto no disponible" copy="El puesto seleccionado ya no esta activo." />
            ) : assignableBikes.length === 0 ? (
              <EmptyState
                title="No hay bicicletas disponibles"
                copy="Primero registra bicicletas o deja alguna sin puesto para poder agregarla aqui."
              />
            ) : (
              <>
                <div className="form-grid">
                  <label className="control">
                    <span>Puesto</span>
                    <input value={assignStation.name} readOnly />
                  </label>
                  <label className="control">
                    <span>Bicicleta creada</span>
                    <select
                      value={assignBikeForm.bikeId}
                      onChange={(event) =>
                        setAssignBikeForm((current) => ({ ...current, bikeId: event.target.value }))
                      }
                    >
                      <option value="">Selecciona una bicicleta</option>
                      {assignableBikes.map((bike) => {
                        const currentStation =
                          bike.stationId
                            ? data.stations.find((station) => station.id === bike.stationId)?.name ?? 'Puesto eliminado'
                            : 'Sin puesto'

                        return (
                          <option key={bike.id} value={bike.id}>
                            {getBikeLabel(bike)} - {bike.color} - {currentStation}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void assignExistingBike()}
                    disabled={!assignBikeForm.bikeId}
                  >
                    Agregar bicicleta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {placementTarget && (placementTarget.type === 'new_station' || placementTarget.type === 'station') && (
        <div className="registry-location-modal" role="dialog" aria-modal="true" aria-labelledby="station-map-title">
          <div className="registry-location-modal__backdrop" onClick={() => setPlacementTarget(null)}></div>
          <div className="registry-location-modal__panel">
            <div className="registry-location-modal__header">
              <div>
                <span className="fleet-shell__eyebrow">Ubicacion de puesto</span>
                <h2 id="station-map-title">Seleccionar ubicacion en mapa</h2>
                <p>Haz clic en el mapa para fijar la ubicacion exacta del puesto.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setPlacementTarget(null)}>
                Cerrar
              </button>
            </div>

            <div className="registry-location-modal__body">
              <div className="registry-location-modal__map">
                <FleetMap
                  stations={activeStations}
                  bikes={activeBikes}
                  visibleBikeIds={[]}
                  draftStationPoint={
                    hasStationLocation
                      ? [Number(stationForm.lat) || DEFAULT_CENTER[0], Number(stationForm.lng) || DEFAULT_CENTER[1]]
                      : null
                  }
                  selectedStationId={editingStationId}
                  selectedBikeId={null}
                  placementTarget={placementTarget}
                  onSelectStation={() => undefined}
                  onSelectBike={() => undefined}
                  onPlace={placeOnMap}
                />
              </div>

              <aside className="registry-location-modal__aside">
                <div className="fleet-sidebar-panel__block">
                  <div className="fleet-sidebar-panel__head">
                    <div>
                      <span className="fleet-shell__eyebrow">Resumen</span>
                      <h3>{stationForm.name || (isEditingStation ? 'Puesto en edicion' : 'Nuevo puesto')}</h3>
                      <p>{stationForm.zone || 'Agrega una referencia de ubicacion antes de guardar el puesto.'}</p>
                    </div>
                    <span className={`tag tag--${hasStationLocation ? 'green' : 'orange'}`}>
                      {hasStationLocation ? 'Punto seleccionado' : 'Punto pendiente'}
                    </span>
                  </div>

                  <div className="fleet-detail-list">
                    <div className="fleet-detail-list__row">
                      <span>Puestos activos</span>
                      <strong>{activeStations.length}</strong>
                    </div>
                    <div className="fleet-detail-list__row">
                      <span>Capacidad planificada</span>
                      <strong>{stationForm.capacity || '0'} espacios</strong>
                    </div>
                    <div className="fleet-detail-list__row">
                      <span>Coordenadas</span>
                      <strong>{hasStationLocation ? `${stationForm.lat}, ${stationForm.lng}` : 'Pendientes'}</strong>
                    </div>
                  </div>

                  <p className="fleet-form-hint">
                    Cuando hagas clic en el mapa, el punto quedara guardado y podras volver al formulario.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
