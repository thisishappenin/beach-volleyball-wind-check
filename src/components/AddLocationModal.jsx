import { useState, useCallback } from 'react'
import { X, Search, Loader2, MapPin } from 'lucide-react'
import { geocodeSearch } from '../lib/openmeteo'

function bearingLabel(deg) {
  const labels = {
    0: 'N–S', 10: 'NNE–SSW', 20: 'NNE–SSW', 30: 'NE–SW', 40: 'NE–SW',
    45: 'NE–SW', 50: 'ENE–WSW', 60: 'ENE–WSW', 70: 'ENE–WSW', 80: 'E–W',
    90: 'E–W', 100: 'E–W', 110: 'ESE–WNW', 120: 'ESE–WNW', 130: 'SE–NW',
    135: 'SE–NW', 140: 'SE–NW', 150: 'SSE–NNW', 160: 'SSE–NNW', 170: 'SSE–NNW', 180: 'N–S',
  }
  return labels[deg] ?? `${deg}°`
}

export default function AddLocationModal({ onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [bearing, setBearing] = useState('')
  const [notes, setNotes] = useState('')
  const [searchError, setSearchError] = useState('')

  const parseCoords = (str) => {
    const m = str.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
    if (!m) return null
    const lat = parseFloat(m[1]), lon = parseFloat(m[2])
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
    return { lat, lon }
  }

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearchError('')

    const coords = parseCoords(query)
    if (coords) {
      const r = { latitude: coords.lat, longitude: coords.lon, name: '', admin1: null }
      setSelected(r)
      setName('')
      setResults([])
      return
    }

    setSearching(true)
    try {
      const res = await geocodeSearch(query)
      setResults(res)
      if (res.length === 0) setSearchError('No locations found. Try a broader search term.')
    } catch {
      setSearchError('Search failed. Check your connection.')
    } finally {
      setSearching(false)
    }
  }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleSelect = (r) => {
    setSelected(r)
    setName(r.name + (r.admin1 ? `, ${r.admin1}` : ''))
    setResults([])
    setQuery(r.name)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selected) return
    onAdd({
      name: name.trim() || selected.name,
      latitude: selected.latitude,
      longitude: selected.longitude,
      court_bearing_deg: bearing !== '' ? parseFloat(bearing) : null,
      notes: notes.trim() || null,
    })
  }

  const bearingNum = bearing !== '' ? parseFloat(bearing) : null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-lg">Add a beach</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Search */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Location search</label>
            <div className="flex gap-2 mt-1">
              <input
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="e.g. Corona del Mar"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null) }}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="px-3 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 disabled:opacity-50"
              >
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>
            {searchError && <p className="text-xs text-red-500 mt-1">{searchError}</p>}
          </div>

          {/* Results dropdown */}
          {results.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {results.map(r => (
                <button
                  key={`${r.latitude},${r.longitude}`}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-2"
                  onClick={() => handleSelect(r)}
                >
                  <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400">{[r.admin1, r.country].filter(Boolean).join(', ')}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Only show rest of form once a location is selected */}
          {selected && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name override */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Display name</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="e.g. Newland Beach"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  📍 {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
                </p>
              </div>

              {/* Court bearing */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Court bearing <span className="normal-case font-normal">(optional)</span>
                </label>
                <select
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                  value={bearing}
                  onChange={e => setBearing(e.target.value)}
                >
                  <option value="">Not sure — skip</option>
                  {Array.from({ length: 19 }, (_, i) => i * 10).map(deg => (
                    <option key={deg} value={deg}>{deg}° — {bearingLabel(deg)}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Long axis of the court: 0° = N/S, 90° = E/W, 135° = NW/SE.
                </p>
                {bearingNum !== null && (
                  <div className="mt-2 flex justify-center">
                    <CourtDiagram bearing={bearingNum} />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes (optional)</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="e.g. courts near jetty"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-sky-500 text-white font-medium rounded-xl py-3 hover:bg-sky-600 transition-colors"
              >
                Add location
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function CourtDiagram({ bearing }) {
  const rad = (bearing * Math.PI) / 180
  const cx = 60, cy = 60, r = 40
  const dx = Math.sin(rad) * r
  const dy = -Math.cos(rad) * r

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="opacity-80">
      {/* compass */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      <text x={cx} y={cy - r - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">N</text>
      <text x={cx} y={cy + r + 10} textAnchor="middle" fontSize="8" fill="#94a3b8">S</text>
      <text x={cx + r + 6} y={cy + 3} textAnchor="middle" fontSize="8" fill="#94a3b8">E</text>
      <text x={cx - r - 6} y={cy + 3} textAnchor="middle" fontSize="8" fill="#94a3b8">W</text>
      {/* court line */}
      <line
        x1={cx - dx} y1={cy - dy}
        x2={cx + dx} y2={cy + dy}
        stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"
      />
      {/* net indicator */}
      <circle cx={cx} cy={cy} r="3" fill="#0ea5e9" />
    </svg>
  )
}
