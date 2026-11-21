export interface Coords { lat: number; lng: number }

export function haversineKm(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** ~1.1 km precision. This is all the server ever receives. */
export function roundCoords(c: Coords, decimals = 2): Coords {
  const f = 10 ** decimals
  return { lat: Math.round(c.lat * f) / f, lng: Math.round(c.lng * f) / f }
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.max(1, Math.round(km * 10)) * 100} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`
}

export function directionsUrl(c: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`
}

export type LocationErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure'
export class LocationError extends Error {
  constructor(public kind: LocationErrorKind, message: string) { super(message) }
}

const MESSAGES: Record<LocationErrorKind, string> = {
  insecure: 'Your browser only shares location on secure pages. Open the app at http://localhost:3000 (not an IP address) or over https.',
  unsupported: 'This browser cannot share your location.',
  denied: 'Location is blocked for this site. Click the lock icon next to the address bar, allow Location, then try again.',
  unavailable: 'Your device could not work out where you are. Turn on Location services in your system settings and try again.',
  timeout: 'Finding your location took too long.',
}

function once(opts: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => {
        const kind: LocationErrorKind = e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable'
        reject(new LocationError(kind, MESSAGES[kind]))
      },
      opts,
    )
  })
}

/**
 * Browser Geolocation API: free, needs a user permission prompt and a secure
 * page (https or localhost). Desktop browsers often fail the first, low-accuracy
 * attempt, so a timeout or "unavailable" is retried once with high accuracy.
 */
export async function getPosition(): Promise<Coords> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) throw new LocationError('unsupported', MESSAGES.unsupported)
  if (!window.isSecureContext) throw new LocationError('insecure', MESSAGES.insecure)
  try {
    return await once({ enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 })
  } catch (e) {
    if (e instanceof LocationError && (e.kind === 'timeout' || e.kind === 'unavailable')) {
      return once({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 })
    }
    throw e
  }
}

export interface PlaceMatch { label: string; lat: number; lng: number }
