import { useEffect } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../constants'
import type { LatLngPoint, Zone, ZoneValidationResult } from '../types'

export type ZonesMapMode = 'browse' | 'create' | 'validate'

export type ZoneMapEditor = {
  name: string
  active: boolean
  centerLatitude: number
  centerLongitude: number
  radiusMeters: number
}

function createZoneIcon({ active, selected, draft }: { active: boolean; selected: boolean; draft: boolean }) {
  return divIcon({
    className: 'leaflet-div-marker-reset',
    html: `
      <div class="zone-map-marker${active ? ' zone-map-marker--active' : ''}${
        selected ? ' zone-map-marker--selected' : ''
      }${draft ? ' zone-map-marker--draft' : ''}">
        <span class="zone-map-marker__dot"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function createValidationIcon(allowed: boolean | null) {
  return divIcon({
    className: 'leaflet-div-marker-reset',
    html: `
      <div class="zone-validation-marker${allowed === true ? ' zone-validation-marker--allowed' : ''}${
        allowed === false ? ' zone-validation-marker--blocked' : ''
      }">
        <span></span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function expandCircleBounds(centerLatitude: number, centerLongitude: number, radiusMeters: number): LatLngPoint[] {
  const latDelta = radiusMeters / 111320
  const longitudeMeters = Math.max(Math.cos((centerLatitude * Math.PI) / 180) * 111320, 1)
  const lngDelta = radiusMeters / Math.abs(longitudeMeters)

  return [
    [centerLatitude + latDelta, centerLongitude],
    [centerLatitude - latDelta, centerLongitude],
    [centerLatitude, centerLongitude + lngDelta],
    [centerLatitude, centerLongitude - lngDelta],
  ]
}

function MapViewportSync({ points }: { points: LatLngPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }

    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }

    map.fitBounds(latLngBounds(points), {
      padding: [36, 36],
    })
  }, [map, points])

  return null
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

type ZonesMapProps = {
  zones: Zone[]
  selectedZoneId: string | null
  editorZone: ZoneMapEditor | null
  isCreating: boolean
  mode: ZonesMapMode
  validationPoint: LatLngPoint | null
  validationResult: ZoneValidationResult | null
  onSelectZone: (zoneId: string) => void
  onMapClick: (lat: number, lng: number) => void
  onEditorMove: (lat: number, lng: number) => void
}

export function ZonesMap({
  zones,
  selectedZoneId,
  editorZone,
  isCreating,
  mode,
  validationPoint,
  validationResult,
  onSelectZone,
  onMapClick,
  onEditorMove,
}: ZonesMapProps) {
  const previewZone =
    editorZone !== null
      ? {
          name: editorZone.name,
          active: editorZone.active,
          centerLatitude: editorZone.centerLatitude,
          centerLongitude: editorZone.centerLongitude,
          radiusMeters: editorZone.radiusMeters,
        }
      : null

  const staticZones = zones.filter((zone) => (isCreating ? true : zone.id !== selectedZoneId))
  const focusedPoints: LatLngPoint[] = [
    ...staticZones.flatMap((zone) =>
      expandCircleBounds(zone.centerLatitude, zone.centerLongitude, zone.radiusMeters),
    ),
    ...(previewZone
      ? expandCircleBounds(previewZone.centerLatitude, previewZone.centerLongitude, previewZone.radiusMeters)
      : []),
    ...(validationPoint ? [validationPoint] : []),
  ]

  return (
    <div className={`fleet-map zones-map${mode !== 'browse' ? ' zones-map--interactive' : ''}`}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="fleet-map__leaflet">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewportSync points={focusedPoints} />
        <MapClickHandler onMapClick={onMapClick} />

        {staticZones.map((zone) => (
          <Circle
            key={zone.id}
            center={[zone.centerLatitude, zone.centerLongitude]}
            radius={zone.radiusMeters}
            pathOptions={{
              color: zone.active ? '#2a7bda' : '#98a8bd',
              weight: 2,
              opacity: zone.active ? 0.95 : 0.72,
              fillColor: zone.active ? '#2a7bda' : '#cad5e1',
              fillOpacity: zone.active ? 0.12 : 0.08,
            }}
            eventHandlers={{
              click: () => onSelectZone(zone.id),
            }}
          >
            <Popup>
              <strong>{zone.name}</strong>
              <div>{zone.active ? 'Zona activa' : 'Zona inactiva'}</div>
              <div>Radio: {Math.round(zone.radiusMeters)} m</div>
            </Popup>
          </Circle>
        ))}

        {staticZones.map((zone) => (
          <Marker
            key={`${zone.id}-marker`}
            position={[zone.centerLatitude, zone.centerLongitude]}
            icon={createZoneIcon({
              active: zone.active,
              selected: false,
              draft: false,
            })}
            eventHandlers={{
              click: () => onSelectZone(zone.id),
            }}
          />
        ))}

        {previewZone ? (
          <>
            <Circle
              center={[previewZone.centerLatitude, previewZone.centerLongitude]}
              radius={previewZone.radiusMeters}
              pathOptions={{
                color: previewZone.active ? '#0fae52' : '#e68a00',
                weight: 3,
                opacity: 0.98,
                fillColor: previewZone.active ? '#0fae52' : '#f4a423',
                fillOpacity: 0.16,
                dashArray: isCreating ? '12 8' : undefined,
              }}
            >
              <Popup>
                <strong>{previewZone.name || (isCreating ? 'Nueva zona' : 'Zona seleccionada')}</strong>
                <div>{previewZone.active ? 'Activa' : 'Inactiva'}</div>
                <div>Radio: {Math.round(previewZone.radiusMeters)} m</div>
              </Popup>
            </Circle>

            <Marker
              position={[previewZone.centerLatitude, previewZone.centerLongitude]}
              draggable={mode !== 'validate'}
              icon={createZoneIcon({
                active: previewZone.active,
                selected: true,
                draft: isCreating,
              })}
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng()
                  onEditorMove(lat, lng)
                },
              }}
            />
          </>
        ) : null}

        {validationPoint ? (
          <Marker
            position={validationPoint}
            icon={createValidationIcon(validationResult?.allowed ?? null)}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng()
                onMapClick(lat, lng)
              },
            }}
          >
            <Popup>
              <strong>Ubicacion validada</strong>
              <div>
                {validationPoint[0].toFixed(5)}, {validationPoint[1].toFixed(5)}
              </div>
              <div>{validationResult?.message ?? 'Sin resultado'}</div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>

      {mode === 'create' ? (
        <div className="zones-map__guide">
          <strong>Creacion visual activa</strong>
          <p>Haz clic o arrastra el marcador para definir el centro de la nueva zona.</p>
        </div>
      ) : null}

      {mode === 'validate' ? (
        <div className="zones-map__guide zones-map__guide--validate">
          <strong>Validacion activa</strong>
          <p>Haz clic en el mapa para comprobar si ese punto cae dentro de una zona activa.</p>
        </div>
      ) : null}
    </div>
  )
}
