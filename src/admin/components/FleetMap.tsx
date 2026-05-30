import { useEffect } from 'react'
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import bikeMapIcon from '../../assets/bike-map-icon.png'
import stationMapIcon from '../../assets/station-map-icon.png'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../constants'
import type { Bike, LatLngPoint, MarkerTone, PlacementTarget, Station, Zone } from '../types'
import { getBikeLabel, getBikeStatusLabel, getBikeTone } from '../utils'

function createStationIcon(active: boolean) {
  return divIcon({
    className: 'leaflet-div-marker-reset',
    html: `
      <div class="map-marker map-marker--station${active ? ' map-marker--active' : ''}">
        <img src="${stationMapIcon}" alt="" class="map-marker__station-icon" />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

function createBikeIcon(tone: MarkerTone, active: boolean, alert: boolean) {
  return divIcon({
    className: 'leaflet-div-marker-reset',
    html: `
      <div class="map-marker map-marker--bike map-marker--${tone}${active ? ' map-marker--active' : ''}${
        alert ? ' map-marker--alert' : ''
      }">
        <img src="${bikeMapIcon}" alt="" class="map-marker__bike-icon" />
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

function createDraftStationIcon() {
  return divIcon({
    className: 'leaflet-div-marker-reset',
    html: `
      <div class="map-marker map-marker--draft-station map-marker--active">
        <span class="map-marker__title">Nueva estacion</span>
        <span class="map-marker__meta">Punto seleccionado</span>
      </div>
    `,
    iconSize: [132, 48],
    iconAnchor: [66, 24],
  })
}

function MapViewportSync({ points }: { points: LatLngPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }

    if (points.length === 1) {
      map.setView(points[0], 16)
      return
    }

    map.fitBounds(latLngBounds(points), { padding: [32, 32] })
  }, [map, points])

  return null
}

function MapClickHandler({
  placementTarget,
  onPlace,
}: {
  placementTarget: PlacementTarget
  onPlace: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(event) {
      if (!placementTarget) {
        return
      }

      onPlace(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

type FleetMapProps = {
  stations: Station[]
  bikes: Bike[]
  zones?: Zone[]
  visibleBikeIds: string[]
  draftStationPoint: LatLngPoint | null
  boundaryPoints?: LatLngPoint[]
  alertBikeIds?: string[]
  selectedStationId: string | null
  selectedBikeId: string | null
  placementTarget: PlacementTarget
  onSelectStation: (stationId: string) => void
  onSelectBike: (bikeId: string) => void
  onMoveBike?: (bikeId: string, lat: number, lng: number) => void
  onPlace: (lat: number, lng: number) => void
}

export function FleetMap({
  stations,
  bikes,
  zones = [],
  visibleBikeIds,
  draftStationPoint,
  boundaryPoints = [],
  alertBikeIds = [],
  selectedStationId,
  selectedBikeId,
  placementTarget,
  onSelectStation,
  onSelectBike,
  onMoveBike,
  onPlace,
}: FleetMapProps) {
  const visibleBikeIdSet = new Set(visibleBikeIds)
  const alertBikeIdSet = new Set(alertBikeIds)
  const visibleBikes = bikes.filter((bike) => visibleBikeIdSet.has(bike.id))
  const zoneBounds: LatLngPoint[] = zones.flatMap((zone) => {
    const latDelta = zone.radiusMeters / 111320
    const longitudeMeters = Math.max(Math.cos((zone.centerLatitude * Math.PI) / 180) * 111320, 1)
    const lngDelta = zone.radiusMeters / Math.abs(longitudeMeters)

    return [
      [zone.centerLatitude + latDelta, zone.centerLongitude],
      [zone.centerLatitude - latDelta, zone.centerLongitude],
      [zone.centerLatitude, zone.centerLongitude + lngDelta],
      [zone.centerLatitude, zone.centerLongitude - lngDelta],
    ]
  })
  const points: LatLngPoint[] = [
    ...boundaryPoints,
    ...zoneBounds,
    ...stations.map((station) => [station.lat, station.lng] as LatLngPoint),
    ...visibleBikes.map((bike) => [bike.lat, bike.lng] as LatLngPoint),
  ]

  return (
    <div className={`fleet-map${placementTarget ? ' fleet-map--placing' : ''}`}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="fleet-map__leaflet">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewportSync points={points} />
        <MapClickHandler placementTarget={placementTarget} onPlace={onPlace} />

        {boundaryPoints.length >= 3 ? (
          <Polygon
            positions={boundaryPoints}
            pathOptions={{
              color: '#e74d5b',
              weight: 3,
              opacity: 0.95,
              fillColor: '#e74d5b',
              fillOpacity: 0.08,
              dashArray: '10 8',
            }}
          />
        ) : null}

        {zones.map((zone) => (
          <Circle
            key={`fleet-zone-${zone.id}`}
            center={[zone.centerLatitude, zone.centerLongitude]}
            radius={zone.radiusMeters}
            pathOptions={{
              color: zone.active ? '#2a7bda' : '#98a8bd',
              weight: 2,
              opacity: zone.active ? 0.9 : 0.6,
              fillColor: zone.active ? '#2a7bda' : '#cad5e1',
              fillOpacity: zone.active ? 0.09 : 0.05,
              dashArray: zone.active ? undefined : '8 8',
            }}
          >
            <Popup>
              <strong>{zone.name}</strong>
              <div>{zone.active ? 'Zona activa' : 'Zona inactiva'}</div>
              <div>Radio: {Math.round(zone.radiusMeters)} m</div>
            </Popup>
          </Circle>
        ))}

        {stations.map((station) => {
          const parkedBikes = bikes.filter((bike) => bike.stationId === station.id && bike.status !== 'in_use')

          return (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={createStationIcon(selectedStationId === station.id)}
              eventHandlers={{
                click: () => onSelectStation(station.id),
              }}
            >
              <Popup className="station-popup" offset={[0, -18]}>
                <div className="station-popup__menu">
                  <div className="station-popup__header">
                    <strong>{station.name}</strong>
                    <span className="tag tag--blue">
                      {parkedBikes.length}/{station.capacity}
                    </span>
                  </div>
                  <p className="station-popup__location">{station.zone}</p>

                  {parkedBikes.length === 0 ? (
                    <p className="station-popup__empty">No hay bicicletas asignadas en esta estacion.</p>
                  ) : (
                    <div className="station-popup__list">
                      {parkedBikes.map((bike) => (
                        <button
                          key={bike.id}
                          type="button"
                          className="station-popup__item station-popup__button"
                          onClick={() => onSelectBike(bike.id)}
                        >
                          <div>
                            <strong>{getBikeLabel(bike)}</strong>
                            <span>Bateria {bike.battery}%</span>
                          </div>
                          <span className={`tag tag--${getBikeTone(bike.status)}`}>
                            {getBikeStatusLabel(bike.status)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {visibleBikes.map((bike) => {
          const station = stations.find((item) => item.id === bike.stationId) ?? null

          return (
            <Marker
              key={bike.id}
              position={[bike.lat, bike.lng]}
              icon={createBikeIcon(getBikeTone(bike.status), selectedBikeId === bike.id, alertBikeIdSet.has(bike.id))}
              draggable={bike.status === 'in_use'}
              eventHandlers={{
                click: () => onSelectBike(bike.id),
                dragend: (event) => {
                  if (!onMoveBike || bike.status !== 'in_use') {
                    return
                  }

                  const { lat, lng } = event.target.getLatLng()
                  onMoveBike(bike.id, lat, lng)
                },
              }}
            >
              <Popup>
                <strong>{getBikeLabel(bike)}</strong>
                <div>Estado: {getBikeStatusLabel(bike.status)}</div>
                {alertBikeIdSet.has(bike.id) ? <div>Alerta: fuera de las zonas activas</div> : null}
                <div>Bateria: {bike.battery}%</div>
                <div>
                  Estacion: {station ? station.name : 'Sin estacion'}
                </div>
                <div>
                  Coordenadas base: {bike.lat.toFixed(5)}, {bike.lng.toFixed(5)}
                </div>
                {bike.status === 'in_use' ? <div>Arrastra el icono para mover la bicicleta.</div> : null}
              </Popup>
            </Marker>
          )
        })}

        {placementTarget?.type === 'new_station' && draftStationPoint && (
          <Marker position={draftStationPoint} icon={createDraftStationIcon()}>
            <Popup>
              <strong>Nueva estacion</strong>
              <div>
                Coordenadas: {draftStationPoint[0].toFixed(5)}, {draftStationPoint[1].toFixed(5)}
              </div>
              <div>Haz clic de nuevo para ajustar el punto y luego crea la estacion.</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {stations.length === 0 && bikes.length === 0 && (
        <div className="fleet-map__empty">
          <strong>Sin elementos en el mapa</strong>
          <p>Crea una estacion y una bicicleta para empezar a visualizar la flota en el mapa real.</p>
        </div>
      )}

      {placementTarget?.type === 'new_station' && (
        <div className="fleet-map__guide">
          <strong>Seleccion de estacion activa</strong>
          <p>Haz clic sobre el mapa para fijar o ajustar el punto de la nueva estacion.</p>
        </div>
      )}
    </div>
  )
}
