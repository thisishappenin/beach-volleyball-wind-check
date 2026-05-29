import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export default function CourtPinMap({ lat, lng, onPin }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  // Keep onPin fresh without re-running the effect
  const onPinRef = useRef(onPin)
  useEffect(() => { onPinRef.current = onPin })

  useEffect(() => {
    if (mapRef.current) return

    const map = L.map(containerRef.current, { center: [lat, lng], zoom: 18 })

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 20 }
    ).addTo(map)

    const pin = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;background:#0ea5e9;border:3px solid #fff;border-radius:50%;cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,.55)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      draggable: true,
    }).addTo(map)

    pin.on('dragend', () => {
      const { lat: pLat, lng: pLng } = pin.getLatLng()
      onPinRef.current(pLat, pLng)
    })

    map.on('click', (e) => {
      pin.setLatLng(e.latlng)
      onPinRef.current(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ height: 220 }}
      className="rounded-xl overflow-hidden border border-slate-200"
    />
  )
}
