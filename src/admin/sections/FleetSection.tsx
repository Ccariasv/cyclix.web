import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import { SectionHeader } from '../components/common'
import { FleetMap } from '../components/FleetMap'
import type { AdminData, LatLngPoint } from '../types'
import { ZACAPA_BOUNDARY } from '../zacapaBoundary'
import {
  formatRelativeTime,
  getBikeLabel,
  getBikeStatusLabel,
  getBikeTone,
  getStationOccupancy,
} from '../utils'

function isPointInsidePolygon(point: LatLngPoint, polygon: LatLngPoint[]) {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]
    const [yj, xj] = polygon[j]
    const intersects =
      yi > point[0] !== yj > point[0] &&
      point[1] < ((xj - xi) * (point[0] - yi)) / ((yj - yi) || Number.EPSILON) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

export function FleetSection({
  data,
  setData,
}: {
  data: AdminData
  setData: Dispatch<SetStateAction<AdminData>>
}) {
  const activeStations = data.stations.filter((station) => station.isActive)
  const activeBikes = data.bikes.filter((bike) => bike.isActive)
  const visibleBikeIds = activeBikes.map((bike) => bike.id)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(data.stations[0]?.id ?? null)
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(data.bikes[0]?.id ?? null)

  const activeStationId =
    selectedStationId && activeStations.some((station) => station.id === selectedStationId)
      ? selectedStationId
      : (activeStations[0]?.id ?? null)
  const activeBikeId =
    selectedBikeId && activeBikes.some((bike) => bike.id === selectedBikeId)
      ? selectedBikeId
      : (activeBikes[0]?.id ?? null)

  const selectedStation = activeStations.find((station) => station.id === activeStationId) ?? null
  const parkedInSelectedStation = selectedStation
    ? activeBikes.filter((bike) => bike.stationId === selectedStation.id)
    : []
  const selectedStationOccupancy = selectedStation ? getStationOccupancy(selectedStation.id, activeBikes) : 0
  const occupiedCapacity = activeStations.reduce(
    (total, station) => total + getStationOccupancy(station.id, activeBikes),
    0,
  )
  const totalCapacity = activeStations.reduce((total, station) => total + station.capacity, 0)
  const selectedStationOpenSlots = selectedStation ? Math.max(selectedStation.capacity - selectedStationOccupancy, 0) : 0
  const selectedStationOccupancyRate =
    selectedStation && selectedStation.capacity > 0
      ? Math.round((selectedStationOccupancy / selectedStation.capacity) * 100)
      : 0
  const selectedStationBatteryAverage =
    parkedInSelectedStation.length > 0
      ? Math.round(parkedInSelectedStation.reduce((total, bike) => total + bike.battery, 0) / parkedInSelectedStation.length)
      : 0
  const selectedStationLastUpdate =
    selectedStation && parkedInSelectedStation.length > 0
      ? [...parkedInSelectedStation.map((bike) => bike.updatedAt), selectedStation.updatedAt]
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
      : selectedStation?.updatedAt ?? null
  const selectedStationAvailableCount = parkedInSelectedStation.filter((bike) => bike.status === 'available').length
  const selectedStationInUseCount = parkedInSelectedStation.filter((bike) => bike.status === 'in_use').length
  const selectedStationMaintenanceCount = parkedInSelectedStation.filter((bike) => bike.status === 'maintenance').length
  const selectedStationOutOfServiceCount = parkedInSelectedStation.filter((bike) => bike.status === 'out_of_service').length
  const outOfPerimeterBikes = activeBikes.filter((bike) => !isPointInsidePolygon([bike.lat, bike.lng], ZACAPA_BOUNDARY))
  const outOfPerimeterBikeIds = outOfPerimeterBikes.map((bike) => bike.id)
  const moveBike = (bikeId: string, lat: number, lng: number) => {
    setData((current) => ({
      ...current,
      bikes: current.bikes.map((bike) =>
        bike.id === bikeId
          ? {
              ...bike,
              stationId: bike.status === 'in_use' ? null : bike.stationId,
              lat,
              lng,
              updatedAt: new Date().toISOString(),
            }
          : bike,
      ),
    }))
  }

  return (
    <>
      <SectionHeader title="Gestion de Flota" />

      <section className="summary-grid">
        <article className="card summary-card">
          <span className="summary-card__label">Bicicletas registradas</span>
          <strong>{activeBikes.length}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Estaciones activas</span>
          <strong>{activeStations.length}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Ocupacion actual</span>
          <strong>{totalCapacity === 0 ? '0%' : `${Math.round((occupiedCapacity / totalCapacity) * 100)}%`}</strong>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Fuera de Zacapa</span>
          <strong>{outOfPerimeterBikes.length}</strong>
        </article>
      </section>

      <section className="card detail-card fleet-shell">
        <div className="fleet-shell__header">
          <div>
            <span className="fleet-shell__eyebrow">Mapa de flota</span>
            <h2>Monitoreo operativo de bicicletas y estaciones</h2>
          </div>
          <span className="tag tag--blue">Mapa real con OpenStreetMap</span>
        </div>

        {outOfPerimeterBikes.length > 0 ? (
          <div className="fleet-alert-banner" role="alert">
            <div className="fleet-alert-banner__head">
              <strong>Alerta de perimetro</strong>
              <span className="tag tag--red">{outOfPerimeterBikes.length} bicicleta(s)</span>
            </div>
            <p>Se detectaron bicicletas fuera del perimetro municipal de Zacapa.</p>
            <div className="fleet-alert-banner__list">
              {outOfPerimeterBikes.map((bike) => (
                <span key={bike.id} className="fleet-alert-chip">
                  {getBikeLabel(bike)} ({bike.lat.toFixed(4)}, {bike.lng.toFixed(4)})
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="fleet-boundary-banner">
            <strong>Perimetro activo</strong>
            <p>Las bicicletas se monitorean dentro del perimetro municipal de Zacapa.</p>
          </div>
        )}

        <div className="fleet-workspace">
          <div className="fleet-workspace__map">
            <FleetMap
              stations={activeStations}
              bikes={activeBikes}
              visibleBikeIds={visibleBikeIds}
              draftStationPoint={null}
              boundaryPoints={ZACAPA_BOUNDARY}
              alertBikeIds={outOfPerimeterBikeIds}
              selectedStationId={activeStationId}
              selectedBikeId={activeBikeId}
              placementTarget={null}
              onSelectStation={setSelectedStationId}
              onSelectBike={setSelectedBikeId}
              onMoveBike={moveBike}
              onPlace={() => undefined}
            />

            <div className="map-legend">
              <span>
                <span className="legend-dot legend-dot--station"></span>
                Estacion
              </span>
              <span>
                <span className="legend-dot legend-dot--blue"></span>
                Disponible
              </span>
              <span>
                <span className="legend-dot legend-dot--green"></span>
                En uso
              </span>
              <span>
                <span className="legend-dot legend-dot--orange"></span>
                Mantenimiento
              </span>
              <span>
                <span className="legend-dot legend-dot--red"></span>
                Fuera de servicio
              </span>
              <span>
                <span className="legend-line legend-line--red"></span>
                Perimetro Zacapa
              </span>
            </div>
          </div>

          <aside className="fleet-sidebar-panel">
            <div className="fleet-spotlight-card">
              <div className="fleet-sidebar-panel__head">
                <div>
                  <span className="fleet-shell__eyebrow">Estacion activa</span>
                  <h3>{selectedStation ? selectedStation.name : 'Sin estacion seleccionada'}</h3>
                </div>
                <span className="tag tag--blue">
                  {selectedStation ? `${selectedStationOccupancy}/${selectedStation.capacity}` : 'Sin foco'}
                </span>
              </div>

              <div className="fleet-spotlight-card__body">
                {!selectedStation ? (
                  <p className="fleet-spotlight-card__empty">
                    Selecciona una estacion del mapa para revisar capacidad y bicicletas parqueadas.
                  </p>
                ) : (
                  <>
                    <div className="summary-grid fleet-station-metrics">
                      <article className="card summary-card fleet-station-metric-card">
                        <span className="summary-card__label">Ocupacion</span>
                        <strong>{selectedStationOccupancyRate}%</strong>
                      </article>
                      <article className="card summary-card fleet-station-metric-card">
                        <span className="summary-card__label">Espacios libres</span>
                        <strong>{selectedStationOpenSlots}</strong>
                      </article>
                      <article className="card summary-card fleet-station-metric-card">
                        <span className="summary-card__label">Bateria promedio</span>
                        <strong>{selectedStationBatteryAverage}%</strong>
                      </article>
                    </div>

                    <div className="fleet-detail-list">
                      <div className="fleet-detail-list__row">
                        <span>Nombre</span>
                        <strong>{selectedStation.name}</strong>
                      </div>
                      <div className="fleet-detail-list__row">
                        <span>Capacidad</span>
                        <strong>{selectedStation.capacity} espacios</strong>
                      </div>
                      <div className="fleet-detail-list__row">
                        <span>Espacios ocupados</span>
                        <strong>{selectedStationOccupancy}</strong>
                      </div>
                      <div className="fleet-detail-list__row">
                        <span>Espacios libres</span>
                        <strong>{selectedStationOpenSlots}</strong>
                      </div>
                      <div className="fleet-detail-list__row">
                        <span>Coordenadas</span>
                        <strong>
                          {selectedStation.lat.toFixed(5)}, {selectedStation.lng.toFixed(5)}
                        </strong>
                      </div>
                      <div className="fleet-detail-list__row">
                        <span>Ultima actualizacion</span>
                        <strong>{selectedStationLastUpdate ? formatRelativeTime(selectedStationLastUpdate) : 'Sin registro'}</strong>
                      </div>
                    </div>

                    <div className="fleet-status-grid">
                      <div className="fleet-status-chip fleet-status-chip--blue">
                        <span>Disponibles</span>
                        <strong>{selectedStationAvailableCount}</strong>
                      </div>
                      <div className="fleet-status-chip fleet-status-chip--green">
                        <span>En uso</span>
                        <strong>{selectedStationInUseCount}</strong>
                      </div>
                      <div className="fleet-status-chip fleet-status-chip--orange">
                        <span>Mantenimiento</span>
                        <strong>{selectedStationMaintenanceCount}</strong>
                      </div>
                      <div className="fleet-status-chip fleet-status-chip--red">
                        <span>Fuera de servicio</span>
                        <strong>{selectedStationOutOfServiceCount}</strong>
                      </div>
                    </div>

                    <div className="inline-list">
                      <strong>Bicicletas asignadas</strong>
                      {parkedInSelectedStation.length === 0 ? (
                        <p>Esta estacion no tiene bicicletas asignadas.</p>
                      ) : (
                        parkedInSelectedStation.map((bike) => (
                          <div key={bike.id} className="fleet-station-bike-card">
                            <div className="fleet-station-bike-card__head">
                              <div>
                                <strong>{getBikeLabel(bike)}</strong>
                                <p>
                                  {bike.bikeType} / {bike.color} / {bike.size}
                                </p>
                              </div>
                              <span className={`tag tag--${getBikeTone(bike.status)}`}>
                                {getBikeStatusLabel(bike.status)}
                              </span>
                            </div>
                            <div className="fleet-detail-list">
                              <div className="fleet-detail-list__row">
                                <span>Bateria</span>
                                <strong>{bike.battery}%</strong>
                              </div>
                              <div className="fleet-detail-list__row">
                                <span>Ultima actualizacion</span>
                                <strong>{formatRelativeTime(bike.updatedAt)}</strong>
                              </div>
                            </div>
                            {bike.notes ? (
                              <div className="fleet-note-card fleet-note-card--compact">
                                <strong>Notas</strong>
                                <p>{bike.notes}</p>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
