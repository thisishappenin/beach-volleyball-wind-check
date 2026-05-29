import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// ~30m offset for the draggable handle at zoom 19
const HANDLE_DIST = 0.0003

function bearingToPoint(lat, lng, bearing, dist = HANDLE_DIST) {
  const rad = (bearing * Math.PI) / 180
  return [lat + Math.cos(rad) * dist, lng + Math.sin(rad) * dist]
}

function pointToBearing(centerLat, centerLng, lat, lng) {
  const dLat = lat - centerLat
  const dLng = lng - centerLng
  if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) return 0
  let b = (Math.atan2(dLng, dLat) * 180) / Math.PI
  if (b < 0) b += 360
  if (b >= 180) b -= 180
  return Math.round(b)
}

function linePoints(lat, lng, bearing) {
  const [a1, a2] = bearingToPoint(lat, lng, bearing, HANDLE_DIST * 1.6)
  const [b1, b2] = bearingToPoint(lat, lng, (bearing + 180) % 360, HANDLE_DIST * 1.6)
  return [[a1, a2], [lat, lng], [b1, b2]]
}

export default function CourtMapModal({ location, onSave, onClose }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const polyRef = useRef(null)
  const handleMarkerRef = useRef(null)
  const liveRef = useRef(location.court_bearing_deg ?? 0)
  const [bearing, setBearing] = useState(location.court_bearing_deg ?? 0)

  useEffect(() => {
    if (mapRef.current) return

    const { latitude: clat, longitude: clng } = location
    const init = location.court_bearing_deg ?? 0

    const map = L.map(containerRef.current, { center: [clat, clng], zoom: 19 })

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 20 }
    ).addTo(map)

    // Fixed center dot
    L.marker([clat, clng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:12px;height:12px;background:#0ea5e9;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,.6)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
      interactive: false,
    }).addTo(map)

    // Court axis line
    const poly = L.polyline(linePoints(clat, clng, init), {
      color: '#0ea5e9', weight: 3, dashArray: '8 5', opacity: 0.95,
    }).addTo(map)
    polyRef.current = poly

    // Draggable handle
    const [hLat, hLng] = bearingToPoint(clat, clng, init)
    const handle = L.marker([hLat, hLng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;background:#f97316;border:3px solid #fff;border-radius:50%;cursor:grab;box-shadow:0 1px 5px rgba(0,0,0,.6)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      draggable: true,
    }).addTo(map)
    handleMarkerRef.current = handle

    const applyBearing = (b) => {
      liveRef.current = b
      setBearing(b)
      poly.setLatLngs(linePoints(clat, clng, b))
    }

    handle.on('drag', (e) => {
      applyBearing(pointToBearing(clat, clng, e.latlng.lat, e.latlng.lng))
    })

    handle.on('dragend', () => {
      const [nLat, nLng] = bearingToPoint(clat, clng, liveRef.current)
      handle.setLatLng([nLat, nLng])
    })

    // Tap anywhere on map to set bearing
    map.on('click', (e) => {
      const b = pointToBearing(clat, clng, e.latlng.lat, e.latlng.lng)
      applyBearing(b)
      const [nLat, nLng] = bearingToPoint(clat, clng, b)
      handle.setLatLng([nLat, nLng])
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  const compassLabel = (b) => {
    if (b <= 11 || b >= 169) return 'N ↔ S'
    if (b <= 34) return 'NNE ↔ SSW'
    if (b <= 56) return 'NE ↔ SW'
    if (b <= 79) return 'ENE ↔ WSW'
    if (b <= 101) return 'E ↔ W'
    if (b <= 124) return 'ESE ↔ WNW'
    if (b <= 146) return 'SE ↔ NW'
    return 'SSE ↔ NNW'
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">Set court direction</h2>
            <p className="text-xs text-slate-400">{location.name} · tap the map or drag the orange dot</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Map */}
        <div ref={containerRef} style={{ height: 380, flexShrink: 0 }} />

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {bearing}° <span className="font-normal text-slate-500">{compassLabel(bearing)}</span>
            </p>
            <p className="text-xs text-slate-400">Court long axis · 0° = N/S, 90° = E/W</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(location.id, bearing); onClose() }}
              className="px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-xl hover:bg-sky-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
