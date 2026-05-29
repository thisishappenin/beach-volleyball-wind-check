import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp, Compass, Pencil } from 'lucide-react'
import { scoreHour, windDirectionLabel } from '../lib/scoring'
import CourtMapModal from './CourtMapModal'
import EditLocationModal from './EditLocationModal'

const SLOT_BG = {
  good:     'bg-green-100 border-green-400 text-green-900',
  playable: 'bg-amber-100 border-amber-400 text-amber-900',
  skip:     'bg-red-100 border-red-400 text-red-900',
  blackout: 'bg-slate-900 border-slate-700 text-slate-100',
}

function groupByDay(hourlyData) {
  const days = new Map()
  for (const h of hourlyData) {
    const date = h.time.slice(0, 10)
    if (!days.has(date)) days.set(date, [])
    days.get(date).push(h)
  }
  return days
}

function slotHours(dayHours, startHr, endHr) {
  return dayHours.filter(h => {
    const hr = parseInt(h.time.slice(11, 13))
    return hr >= startHr && hr < endHr
  })
}

function scoreSlot(hours, location) {
  if (!hours || hours.length === 0) return null
  const verdictRank = { good: 0, playable: 1, skip: 2 }
  let worstScore = null
  let maxWindHour = null
  for (const h of hours) {
    const s = scoreHour(h, location)
    if (!worstScore || verdictRank[s.verdict] > verdictRank[worstScore.verdict]) worstScore = s
    if (!maxWindHour || h.wind_speed_10m > maxWindHour.wind_speed_10m) maxWindHour = h
  }
  const sustained = Math.round(maxWindHour.wind_speed_10m)
  const gust = Math.round(maxWindHour.wind_gusts_10m ?? maxWindHour.wind_speed_10m)
  return {
    verdict: worstScore.verdict,
    mph: sustained,
    gust: Math.max(sustained, gust),
    dir: windDirectionLabel(maxWindHour.wind_direction_10m),
    effectiveWind: worstScore.effective_wind,
  }
}

function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Normal (good/playable/skip): green→yellow→red over 0–16 mph
// Blackout: yellow→red→dark over 8–26 mph
// Boundaries: 8 mph = 50% normal, 11 mph = 68.8% normal / 16.7% blackout, 16 mph = 44.4% blackout
const NORMAL_GRADIENT   = 'linear-gradient(to right, #86efac 0%, #86efac 50%, #fde68a 50%, #fde68a 68.8%, #fca5a5 68.8%, #fca5a5 100%)'
const BLACKOUT_GRADIENT = 'linear-gradient(to right, #fde68a 0%, #fde68a 16.7%, #fca5a5 16.7%, #fca5a5 44.4%, #cbd5e1 44.4%)'

function SlotBadge({ score }) {
  if (!score) {
    return <div className="flex-1 rounded-lg border border-slate-100 bg-slate-50" />
  }
  const eff = score.effectiveWind ?? score.mph
  const isBlackout = score.verdict === 'blackout'
  const tickPct = isBlackout
    ? Math.min(Math.max((eff - 8) / 18, 0), 1) * 100
    : Math.min(eff / 16, 1) * 100
  return (
    <div className={`flex-1 rounded-lg border px-3 pt-2.5 pb-3 ${SLOT_BG[score.verdict]}`}>
      <p className="text-sm font-bold leading-none">
        {score.mph}
        <span className="font-normal text-xs opacity-60 ml-1">g{score.gust}</span>
      </p>
      <div className="mt-2 h-3 rounded-full overflow-hidden relative"
           style={{ background: isBlackout ? BLACKOUT_GRADIENT : NORMAL_GRADIENT }}>
        <div className="absolute top-0 h-full w-[3px] bg-white/90"
             style={{ left: `${tickPct}%`, transform: 'translateX(-50%)' }} />
      </div>
    </div>
  )
}

export default function LocationCard({ location, hourlyData, loading, onDelete, onSetBearing, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between">
          <div className="h-5 bg-slate-200 rounded w-40" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-4 py-2.5 flex gap-2 border-b border-slate-50">
            <div className="h-4 bg-slate-100 rounded w-24" />
            <div className="flex-1 h-8 bg-slate-100 rounded" />
            <div className="flex-1 h-8 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!hourlyData || hourlyData.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <span className="font-semibold text-slate-800">{location.name}</span>
        <p className="text-sm text-slate-400 mt-1">Failed to load weather</p>
      </div>
    )
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const dayMap = groupByDay(hourlyData)
  const sortedDates = [...dayMap.keys()].sort()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">{location.name}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowEdit(true)}
            className="p-1 text-slate-300 hover:text-sky-500 transition-colors"
            title="Edit court"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setShowMap(true)}
            className="p-1 text-slate-300 hover:text-sky-500 transition-colors"
            title="Set court direction"
          >
            <Compass size={14} />
          </button>
          <button
            onClick={() => onDelete(location.id)}
            className="p-1 text-slate-300 hover:text-red-400 transition-colors"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showMap && (
        <CourtMapModal
          location={location}
          onSave={onSetBearing}
          onClose={() => setShowMap(false)}
        />
      )}

      {showEdit && (
        <EditLocationModal
          location={location}
          onSave={(id, patch) => { onEdit(id, patch); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Column labels */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-100">
        <div className="w-24 shrink-0" />
        <div className="flex-1 text-[10px] font-medium text-slate-400 uppercase tracking-wide text-center">8–11 AM</div>
        <div className="flex-1 text-[10px] font-medium text-slate-400 uppercase tracking-wide text-center">4–7 PM</div>
      </div>

      {/* Day rows */}
      <div className="divide-y divide-slate-50">
        {sortedDates.map(dateStr => {
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr
          const dayHours = dayMap.get(dateStr)

          const morning = scoreSlot(slotHours(dayHours, 8, 11), location)
          const afternoon = scoreSlot(slotHours(dayHours, 16, 19), location)

          // On mobile: hide non-today rows unless expanded.
          // On desktop (md+): always show via md:flex.
          const rowVisibility = isToday
            ? 'flex'
            : expanded
              ? 'flex'
              : 'hidden md:flex'

          const bothBlackout = morning?.verdict === 'blackout' && afternoon?.verdict === 'blackout'

          return (
            <div
              key={dateStr}
              className={`items-center gap-2 px-4 py-2 ${rowVisibility} ${
                isToday ? 'bg-sky-50' : isPast ? 'opacity-40' : ''
              } ${bothBlackout && !isPast ? 'bg-slate-100' : ''}`}
            >
              <div className="w-24 shrink-0">
                <p className={`text-xs font-medium ${isToday ? 'text-sky-600' : 'text-slate-500'}`}>
                  {isToday ? '▶ Today' : dayLabel(dateStr)}
                </p>
              </div>
              <SlotBadge score={morning} />
              <SlotBadge score={afternoon} />
            </div>
          )
        })}
      </div>

      {/* Expand / collapse toggle — mobile only */}
      <button
        className="md:hidden w-full flex items-center justify-center gap-1 py-2.5 text-xs text-slate-400 hover:text-sky-600 hover:bg-slate-50 border-t border-slate-100 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? (
          <><ChevronUp size={13} /> Show less</>
        ) : (
          <><ChevronDown size={13} /> Show all 15 days</>
        )}
      </button>
    </div>
  )
}
