import type { LatLngPoint } from './types'

const ZACAPA_CITY_CENTER: LatLngPoint = [14.9707219, -89.5297411]
const ZACAPA_CITY_LAT_RADIUS = 0.0115
const ZACAPA_CITY_LNG_RADIUS = 0.0145
const STEP_COUNT = 24

function createEllipseBoundary(center: LatLngPoint, latRadius: number, lngRadius: number, steps: number) {
  const [centerLat, centerLng] = center
  const points: LatLngPoint[] = []

  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2
    points.push([
      Number((centerLat + Math.sin(angle) * latRadius).toFixed(6)),
      Number((centerLng + Math.cos(angle) * lngRadius).toFixed(6)),
    ])
  }

  points.push(points[0])

  return points
}

// Tight urban geofence for Zacapa city core only.
export const ZACAPA_BOUNDARY: LatLngPoint[] = createEllipseBoundary(
  ZACAPA_CITY_CENTER,
  ZACAPA_CITY_LAT_RADIUS,
  ZACAPA_CITY_LNG_RADIUS,
  STEP_COUNT,
)
