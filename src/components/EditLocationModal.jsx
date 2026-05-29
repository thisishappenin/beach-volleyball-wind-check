import { useState } from 'react'
import { X, Compass } from 'lucide-react'
import CourtPinMap from './CourtPinMap'
import CourtMapModal from './CourtMapModal'

export default function EditLocationModal({ location, onSave, onClose }) {
  const [name, setName] = useState(location.name)
  const [pinLat, setPinLat] = useState(location.latitude)
  const [pinLng, setPinLng] = useState(location.longitude)
  const [bearing, setBearing] = useState(
    location.court_bearing_deg != null ? String(location.court_bearing_deg) : ''
  )
  const [notes, setNotes] = useState(location.notes ?? '')
  const [showBearingMap, setShowBearingMap] = useState(false)

  const bearingNum = bearing !== '' ? parseFloat(bearing) : null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(location.id, {
      name: name.trim() || location.name,
      latitude: pinLat,
      longitude: pinLng,
      court_bearing_deg: bearingNum,
      notes: notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800 text-lg">Edit court</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Display name</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Court location</label>
              <p className="text-xs text-slate-400 mt-0.5 mb-2">Tap or drag the pin to your exact court</p>
              <CourtPinMap
                key={`${location.latitude},${location.longitude}`}
                lat={location.latitude}
                lng={location.longitude}
                onPin={(lat, lng) => { setPinLat(lat); setPinLng(lng) }}
              />
              <p className="text-xs text-slate-400 mt-1.5 tabular-nums">
                📍 {pinLat?.toFixed(5)}, {pinLng?.toFixed(5)}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Court bearing <span className="normal-case font-normal">(optional)</span>
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  max="179"
                  step="1"
                  placeholder="0–179°"
                  value={bearing}
                  onChange={e => setBearing(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  type="button"
                  onClick={() => setShowBearingMap(true)}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-slate-500 hover:text-sky-600 hover:border-sky-300 hover:bg-sky-50 transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap"
                >
                  <Compass size={14} /> Draw on map
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Long axis of the court: 0° = N/S, 90° = E/W, 135° = NW/SE.
              </p>
            </div>

            {showBearingMap && (
              <CourtMapModal
                location={{
                  id: location.id,
                  name,
                  latitude: pinLat,
                  longitude: pinLng,
                  court_bearing_deg: bearingNum ?? 0,
                }}
                onSave={(_, b) => setBearing(String(b))}
                onClose={() => setShowBearingMap(false)}
              />
            )}

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
              Save changes
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
