import { useState } from 'react'
import { bikeStatusOptions } from '../constants'
import { EmptyState, SectionHeader } from '../components/common'
import type { AdminData, MarkerTone } from '../types'
import { getBikeLabel, getBikeTone, getStationOccupancy } from '../utils'

const TONE_COLORS: Record<MarkerTone, string> = {
  blue: '#2a7bda',
  green: '#11a84f',
  orange: '#ef7d14',
  red: '#e74d5b',
}

function formatLabel(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function DonutChart({
  segments,
  total,
}: {
  segments: Array<{ color: string; value: number }>
  total: number
}) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const arcSegments = segments.reduce<Array<{ color: string; length: number; offset: number }>>((items, segment) => {
    const previousOffset = items.at(-1)?.offset ?? 0
    const previousLength = items.at(-1)?.length ?? 0
    const offset = previousOffset + previousLength
    const length = total === 0 ? 0 : (segment.value / total) * circumference

    items.push({
      color: segment.color,
      length,
      offset,
    })

    return items
  }, [])

  return (
    <div className="analytics-donut">
      <svg viewBox="0 0 140 140" className="analytics-donut__svg" aria-hidden="true">
        <circle cx="70" cy="70" r={radius} className="analytics-donut__track" />
        <g transform="rotate(-90 70 70)">
          {arcSegments.map((segment, index) => (
            <circle
              key={`${segment.color}-${index}`}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${segment.length} ${circumference}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
      </svg>

      <div className="analytics-donut__center">
        <strong>{total}</strong>
        <span>Bicicletas</span>
      </div>
    </div>
  )
}

export function AnalyticsSection({ data }: { data: AdminData }) {
  const activeStations = data.stations.filter((station) => station.isActive)
  const activeBikes = data.bikes.filter((bike) => bike.isActive)
  const [selectedStationId, setSelectedStationId] = useState<string>('all')
  const effectiveStationId =
    selectedStationId === 'all' || activeStations.some((station) => station.id === selectedStationId)
      ? selectedStationId
      : 'all'
  const selectedStation =
    effectiveStationId === 'all'
      ? null
      : activeStations.find((station) => station.id === effectiveStationId) ?? null
  const scopedBikes =
    effectiveStationId === 'all'
      ? activeBikes
      : activeBikes.filter((bike) => bike.stationId === effectiveStationId)
  const scopedBikeIdSet = new Set(scopedBikes.map((bike) => bike.id))
  const scopedMaintenance = data.maintenance.filter((item) => {
    const bike = data.bikes.find((entry) => entry.id === item.bikeId)
    return bike?.isActive !== false && scopedBikeIdSet.has(item.bikeId)
  })
  const openIssues = scopedMaintenance.filter((item) => item.status !== 'resolved').length
  const averageBattery =
    scopedBikes.length === 0
      ? 0
      : Math.round(scopedBikes.reduce((total, bike) => total + bike.battery, 0) / scopedBikes.length)
  const occupiedSlots =
    effectiveStationId === 'all'
      ? activeStations.reduce((total, station) => total + getStationOccupancy(station.id, activeBikes), 0)
      : (selectedStation ? getStationOccupancy(selectedStation.id, activeBikes) : 0)
  const totalCapacity =
    effectiveStationId === 'all'
      ? activeStations.reduce((total, station) => total + station.capacity, 0)
      : (selectedStation?.capacity ?? 0)
  const occupancyRate = totalCapacity === 0 ? 0 : Math.round((occupiedSlots / totalCapacity) * 100)
  const inUseCount = scopedBikes.filter((bike) => bike.status === 'in_use').length
  const statusDistribution = bikeStatusOptions.map((option) => {
    const value = scopedBikes.filter((bike) => bike.status === option.value).length
    const tone = getBikeTone(option.value)

    return {
      label: option.label,
      tone,
      color: TONE_COLORS[tone],
      value,
      percentage: scopedBikes.length === 0 ? 0 : Math.round((value / scopedBikes.length) * 100),
    }
  })
  const chartSegments = statusDistribution.filter((item) => item.value > 0)
  const stationActivity = activeStations
    .map((station) => {
      const stationBikes = activeBikes.filter((bike) => bike.stationId === station.id)
      const inUse = stationBikes.filter((bike) => bike.status === 'in_use').length
      const occupancy = station.capacity === 0 ? 0 : Math.round((stationBikes.length / station.capacity) * 100)
      const openReports = data.maintenance.filter(
        (item) =>
          stationBikes.some((bike) => bike.id === item.bikeId) && item.status !== 'resolved',
      ).length

      return {
        id: station.id,
        name: station.name,
        bikes: stationBikes.length,
        inUse,
        capacity: station.capacity,
        occupancy,
        openReports,
      }
    })
    .sort(
      (left, right) =>
        right.inUse - left.inUse ||
        right.occupancy - left.occupancy ||
        right.bikes - left.bikes,
    )
    .slice(0, 6)
  const commonFailures = Array.from(
    scopedMaintenance.reduce((map, item) => {
      const label = formatLabel(item.title || 'Sin clasificar')
      const current = map.get(label) ?? 0
      map.set(label, current + 1)
      return map
    }, new Map<string, number>()),
  )
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6)
  const highestFailureCount = Math.max(1, ...commonFailures.map((item) => item.count))
  const bikesWithReports = scopedBikes
    .map((bike) => {
      const reports = scopedMaintenance.filter((item) => item.bikeId === bike.id)
      const openReportsForBike = reports.filter((item) => item.status !== 'resolved').length

      return {
        id: bike.id,
        label: getBikeLabel(bike),
        statusTone: getBikeTone(bike.status),
        reports: reports.length,
        openReports: openReportsForBike,
        battery: bike.battery,
      }
    })
    .filter((bike) => bike.reports > 0)
    .sort(
      (left, right) =>
        right.reports - left.reports ||
        right.openReports - left.openReports ||
        left.label.localeCompare(right.label),
    )
    .slice(0, 6)

  return (
    <>
      <SectionHeader
        title="Analitica"
      />

      <section className="card detail-card analytics-filter-panel">
        <div className="card-head">
          <h2>Filtro por estacion</h2>
          <span className="tag tag--blue">{activeStations.length} activas</span>
        </div>

        {activeStations.length === 0 ? (
          <EmptyState
            title="Sin estaciones activas"
            copy="Registra estaciones para poder intercalar la analitica entre ubicaciones especificas."
          />
        ) : (
          <div className="analytics-filter-bar">
            <button
              type="button"
              className={`analytics-filter-chip${effectiveStationId === 'all' ? ' analytics-filter-chip--active' : ''}`}
              onClick={() => setSelectedStationId('all')}
            >
              Todas las estaciones
            </button>
            {activeStations.map((station) => (
              <button
                key={station.id}
                type="button"
                className={`analytics-filter-chip${effectiveStationId === station.id ? ' analytics-filter-chip--active' : ''}`}
                onClick={() => setSelectedStationId(station.id)}
              >
                {station.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="stats-grid">
        <article className="card summary-card">
          <span className="summary-card__label">{selectedStation ? 'Estacion seleccionada' : 'Estaciones activas'}</span>
          <strong>{selectedStation ? selectedStation.name : activeStations.length}</strong>
          <p>{selectedStation ? `${selectedStation.capacity} espacios disponibles` : 'Vista consolidada de toda la red activa.'}</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Bicicletas en alcance</span>
          <strong>{scopedBikes.length}</strong>
          <p>{inUseCount} en uso y {openIssues} con incidencias activas.</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Ocupacion actual</span>
          <strong>{occupancyRate}%</strong>
          <p>
            {occupiedSlots}/{totalCapacity || 0} espacios ocupados.
          </p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Bateria promedio</span>
          <strong>{averageBattery}%</strong>
          <p>Promedio de carga de las bicicletas dentro del filtro actual.</p>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="card detail-card analytics-panel">
          <div className="card-head">
            <h2>Estado de bicicletas</h2>
            <span className="tag tag--blue">{scopedBikes.length} unidades</span>
          </div>

          {scopedBikes.length === 0 ? (
            <EmptyState
              title="Sin bicicletas en esta vista"
              copy="Selecciona otra estacion o registra bicicletas para ver la distribucion por estado."
            />
          ) : (
            <div className="analytics-distribution">
              <DonutChart
                total={scopedBikes.length}
                segments={chartSegments.map((item) => ({ color: item.color, value: item.value }))}
              />

              <div className="analytics-legend">
                {statusDistribution.map((item) => (
                  <article key={item.label} className="analytics-legend__item">
                    <div className="analytics-legend__title">
                      <span
                        className="analytics-legend__swatch"
                        style={{ backgroundColor: item.color }}
                      ></span>
                      <strong>{item.label}</strong>
                    </div>
                    <div className="analytics-legend__stats">
                      <strong>{item.value}</strong>
                      <span>{item.percentage}%</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="card detail-card analytics-panel">
          <div className="card-head">
            <h2>Estaciones con mayor actividad</h2>
            <span className="tag tag--green">Ranking</span>
          </div>

          {stationActivity.length === 0 ? (
            <EmptyState
              title="Sin actividad de estaciones"
              copy="La actividad se mostrara cuando existan estaciones y bicicletas asignadas."
            />
          ) : (
            <div className="analytics-comparison">
              {stationActivity.map((station) => (
                <article
                  key={station.id}
                  className={`analytics-comparison__item${
                    effectiveStationId === station.id ? ' analytics-comparison__item--active' : ''
                  }`}
                >
                  <div className="analytics-comparison__head">
                    <div>
                      <strong>{station.name}</strong>
                      <p>{station.inUse} en uso, {station.openReports} reportes abiertos</p>
                    </div>
                    <strong>{station.occupancy}%</strong>
                  </div>
                  <div className="analytics-progress">
                    <span
                      className={`analytics-progress__fill analytics-progress__fill--${
                        station.occupancy >= 85 ? 'red' : station.occupancy >= 60 ? 'orange' : 'green'
                      }`}
                      style={{ width: `${Math.min(station.occupancy, 100)}%` }}
                    ></span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="analytics-grid">
        <article className="card detail-card analytics-panel">
          <div className="card-head">
            <h2>Fallas mas comunes</h2>
            <span className="tag tag--orange">{commonFailures.length} tipos</span>
          </div>

          {commonFailures.length === 0 ? (
            <EmptyState
              title="Sin historial de fallas"
              copy="Cuando registres ordenes de mantenimiento, aqui apareceran las incidencias mas repetidas."
            />
          ) : (
            <div className="analytics-ranking-list">
              {commonFailures.map((failure) => (
                <article key={failure.label} className="analytics-ranking-item">
                  <div className="analytics-ranking-item__head">
                    <strong>{failure.label}</strong>
                    <span>{failure.count} reportes</span>
                  </div>
                  <div className="analytics-progress">
                    <span
                      className="analytics-progress__fill analytics-progress__fill--orange"
                      style={{ width: `${(failure.count / highestFailureCount) * 100}%` }}
                    ></span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card detail-card analytics-panel">
          <div className="card-head">
            <h2>Bicicletas con mas reportes</h2>
            <span className="tag tag--red">{bikesWithReports.length} destacadas</span>
          </div>

          {bikesWithReports.length === 0 ? (
            <EmptyState
              title="Sin bicicletas reportadas"
              copy="Las bicicletas con mas incidencias apareceran aqui para priorizar mantenimiento."
            />
          ) : (
            <div className="analytics-report-list">
              {bikesWithReports.map((bike) => (
                <article key={bike.id} className="analytics-report-item">
                  <div className="analytics-report-item__head">
                    <div className="analytics-report-item__title">
                      <span className={`status-dot status-dot--${bike.statusTone}`}></span>
                      <strong>{bike.label}</strong>
                    </div>
                    <span>{bike.reports} reportes</span>
                  </div>
                  <div className="analytics-report-item__meta">
                    <span>{bike.openReports} abiertos</span>
                    <span>{bike.battery}% bateria</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

    </>
  )
}
