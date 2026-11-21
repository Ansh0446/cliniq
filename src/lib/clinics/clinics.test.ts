import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatKm, haversineKm, roundCoords } from './geo'
import { buildOverpassQuery, nearbyInputSchema, parseOverpass } from './osm'

test('haversine matches a known distance', () => {
  // New Delhi to Gurugram city centre is roughly 27 km.
  const d = haversineKm({ lat: 28.6139, lng: 77.209 }, { lat: 28.4595, lng: 77.0266 })
  assert.ok(d > 24 && d < 30, `got ${d}`)
  assert.equal(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0)
})

test('coordinates are rounded to about a kilometre before leaving the browser', () => {
  assert.deepEqual(roundCoords({ lat: 28.61394, lng: 77.20906 }), { lat: 28.61, lng: 77.21 })
})

test('distance formatting', () => {
  assert.equal(formatKm(0.42), '400 m')
  assert.equal(formatKm(3.26), '3.3 km')
  assert.equal(formatKm(18.4), '18 km')
})

test('overpass query is a cheap bounding-box search for clinics, doctors and hospitals', () => {
  const q = buildOverpassQuery({ lat: 28.61, lng: 77.21 }, 5)
  assert.match(q, /\[timeout:15\]\[maxsize:\d+\]/)
  assert.ok(q.includes('"amenity"~"^(clinic|doctors|hospital)$"'))
  assert.ok(!q.includes('around'))
  const box = q.match(/\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\);/)
  assert.ok(box, 'bounding box present')
  const [south, west, north, east] = box!.slice(1).map(Number) as [number, number, number, number]
  assert.ok(south < 28.61 && north > 28.61 && west < 77.21 && east > 77.21)
  assert.ok(Math.abs((north - south) * 111.32 - 10) < 0.2, 'about 10 km tall (5 km each way)')
  assert.match(q, /out center tags qt 120;/)
})

test('parser keeps named places, uses way centres, drops junk and duplicates', () => {
  const out = parseOverpass({
    elements: [
      { type: 'node', id: 1, lat: 28.6, lon: 77.2, tags: { amenity: 'clinic', name: 'Sunrise Clinic', phone: '+91 11 5550 0000', website: 'sunrise.example', 'addr:street': 'MG Road', 'addr:housenumber': '12', 'addr:city': 'Delhi' } },
      { type: 'way', id: 2, center: { lat: 28.61, lon: 77.21 }, tags: { amenity: 'hospital', name: 'City Hospital', website: 'javascript:alert(1)' } },
      { type: 'node', id: 3, lat: 28.6, lon: 77.2, tags: { amenity: 'clinic' } },
      { type: 'node', id: 4, lat: 28.6, lon: 77.2, tags: { amenity: 'clinic', name: 'Sunrise Clinic' } },
      { type: 'relation', id: 5, tags: { amenity: 'doctors', name: 'No Location' } },
    ],
  })
  assert.equal(out.length, 2)
  assert.equal(out[0]?.address, '12 MG Road, Delhi')
  assert.equal(out[0]?.website, 'https://sunrise.example/')
  assert.equal(out[1]?.kind, 'Hospital')
  assert.equal(out[1]?.website, null)
})

test('parser rejects an unexpected payload', () => {
  assert.throws(() => parseOverpass({ nope: true }))
})

test('input validation bounds the search radius and coordinates', () => {
  assert.equal(nearbyInputSchema.safeParse({ lat: 28.6, lng: 77.2 }).success, true)
  assert.equal(nearbyInputSchema.parse({ lat: 28.6, lng: 77.2 }).radiusKm, 8)
  assert.equal(nearbyInputSchema.safeParse({ lat: 91, lng: 77.2 }).success, false)
  assert.equal(nearbyInputSchema.safeParse({ lat: 28.6, lng: 77.2, radiusKm: 500 }).success, false)
})

import { parseNominatim, placeSearchSchema } from './geocode'

test('place search parses results and drops invalid coordinates', () => {
  const out = parseNominatim([
    { display_name: 'Sector 62, Noida, Uttar Pradesh, India', lat: '28.6270', lon: '77.3649' },
    { display_name: 'Broken', lat: 'x', lon: '1' },
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0]?.lat, 28.627)
  assert.throws(() => parseNominatim({ nope: 1 }))
  assert.equal(placeSearchSchema.safeParse({ query: 'a' }).success, false)
})
