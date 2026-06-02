import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp, Compass, Pencil } from 'lucide-react'
import { scoreHour, windDirectionLabel, WIND_BANDS, playabilityScore } from '../lib/scoring'
import CourtMapModal from './CourtMapModal'
import EditLocationModal from './EditLocationModal'

const SLOT_BG = {
  good:     'bg-green-100 border-green-400 text-green-900',
  playable: 'bg-amber-100 border-amber-400 text-amber-900',
  skip:     'bg-red-50 border-red-200 text-red-400',
  blackout: 'bg-slate-100 border-slate-200 text-slate-400',
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
  const verdictRank = { good: 0, playable: 1, skip: 2, blackout: 3 }
  // Pick the hour that actually drives the verdict (worst verdict, then highest
  // effective wind), and report THAT hour's numbers — so the displayed mph/gust,
  // the colour, and the tick all describe the same moment.
  let worst = null
  for (const h of hours) {
    const s = scoreHour(h, location)
    const better = !worst ||
      verdictRank[s.verdict] > verdictRank[worst.s.verdict] ||
      (verdictRank[s.verdict] === verdictRank[worst.s.verdict] && s.effective_wind > worst.s.effective_wind)
    if (better) worst = { h, s }
  }
  const sustained = Math.round(worst.s.sustained_mph)
  const gust = Math.round(worst.s.gust_mph)
  return {
    verdict: worst.s.verdict,
    mph: sustained,
    gust: Math.max(sustained, gust),
    dir: windDirectionLabel(worst.h.wind_direction_10m),
    effectiveWind: worst.s.effective_wind,
    playScore: playabilityScore(worst.s.verdict, worst.s.effective_wind),
  }
}

function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Green 20%, Yellow 40%, Red 40% — wider yellow for more differentiation in the playable range.
// Blackout: yellow 30%, red 30%, dark 40%.
const NORMAL_GRADIENT   = 'linear-gradient(to right, #86efac 0%, #86efac 20%, #fde68a 20%, #fde68a 60%, #fca5a5 60%, #fca5a5 100%)'
const BLACKOUT_GRADIENT = 'linear-gradient(to right, #fde68a 0%, #fde68a 30%, #fca5a5 30%, #fca5a5 60%, #cbd5e1 60%)'

// Band edges drive both the verdict and the bar, so derive the tick from WIND_BANDS
// to keep them from drifting apart.
const G = WIND_BANDS.good.wind      // good ceiling   (green ends)
const P = WIND_BANDS.playable.wind  // playable ceiling (yellow ends)
const S = WIND_BANDS.skip.wind      // skip ceiling   (red ends / blackout begins)

function normalTick(eff) {
  if (eff <= G) return (eff / G) * 20
  if (eff <= P) return 20 + ((eff - G) / (P - G)) * 40
  return Math.min(60 + ((eff - P) / (S - P)) * 40, 100)
}
function blackoutTick(eff) {
  if (eff <= P) return Math.max((eff - G) / (P - G), 0) * 30
  if (eff <= S) return 30 + ((eff - P) / (S - P)) * 30
  return Math.min(60 + ((eff - S) / 10) * 40, 100)
}

function SlotBadge({ score, mobileCondensed, leftAlign }) {
  if (!score) {
    return <div className="flex-1 rounded-lg border border-slate-100 bg-slate-50" />
  }
  const eff = score.effectiveWind ?? score.mph
  const isBlackout = score.verdict === 'blackout'
  const raw = isBlackout ? blackoutTick(eff) : normalTick(eff)
  // Clamp away from edges so tick stays visible inside the rounded corners
  const tickPct = Math.min(Math.max(raw, 5), 95)
  const band = (
    <div className="h-3 rounded-full overflow-hidden relative"
         style={{ background: isBlackout ? BLACKOUT_GRADIENT : NORMAL_GRADIENT }}>
      <div className="absolute top-0 h-full w-[3px] bg-white/90"
           style={{ left: `${tickPct}%`, transform: 'translateX(-50%)' }} />
    </div>
  )
  const scoreLabel = <><span className="font-bold">{score.playScore}</span><span className="font-normal">/10</span></>
  return (
    <div className={`flex-1 rounded-lg border ${SLOT_BG[score.verdict]} ${
      mobileCondensed
        ? 'py-3 px-2 flex items-center md:block md:px-3 md:pt-2.5 md:pb-3'
        : 'px-3 pt-2.5 pb-3'
    }`}>
      <div className={mobileCondensed ? 'w-full md:hidden' : 'hidden'}>
        <p className={`text-sm leading-none mb-1.5 ${leftAlign ? 'text-left' : 'text-right'}`}>{scoreLabel}</p>
        {band}
      </div>
      <div className={mobileCondensed ? 'hidden md:block' : ''}>
        <div className={`flex justify-between items-baseline mb-2 ${leftAlign ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-normal opacity-60">{score.mph} g{score.gust}</span>
          <span className="text-sm leading-none">{scoreLabel}</span>
        </div>
        {band}
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

  // Use local date, not UTC — toISOString() rolls over to tomorrow at midnight UTC
  // which in LA (PDT/PST) is 5–4 PM local, making today vanish from the view mid-afternoon.
  const todayStr = new Date().toLocaleDateString('en-CA') // en-CA gives YYYY-MM-DD
  const dayMap = groupByDay(hourlyData)
  const sortedDates = [...dayMap.keys()].sort()

  const todayIdx = sortedDates.findIndex(d => d >= todayStr)
  // Mobile collapsed: today + next 5 days
  const mobileCutoff = todayIdx === -1 ? 5 : todayIdx + 5
  // Desktop collapsed: last 2 days + today + next 6 days
  const desktopStart = todayIdx === -1 ? 0 : Math.max(0, todayIdx - 2)
  const desktopEnd   = todayIdx === -1 ? 6 : todayIdx + 6

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
        <div className="flex-1 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">8–11 AM</div>
        <div className="flex-1 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">4–7 PM</div>
      </div>

      {/* Day rows */}
      <div className="divide-y divide-slate-50">
        {sortedDates.map((dateStr, idx) => {
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr
          const dayHours = dayMap.get(dateStr)

          const morning = scoreSlot(slotHours(dayHours, 8, 11), location)
          const afternoon = scoreSlot(slotHours(dayHours, 16, 19), location)

          // Mobile collapsed: today + next 3. Desktop collapsed: last 2 + today + next 6.
          const inMobileSet  = !isPast && idx <= mobileCutoff
          const inDesktopSet = idx >= desktopStart && idx <= desktopEnd
          const showMobile   = expanded || inMobileSet ? 'flex' : 'hidden'
          const showDesktop  = expanded || inDesktopSet ? 'md:flex' : 'md:hidden'
          const rowVisibility = `${showMobile} ${showDesktop}`
          const condensed = !expanded

          const bothBlackout = morning?.verdict === 'blackout' && afternoon?.verdict === 'blackout'

          return (
            <div
              key={dateStr}
              className={`items-center gap-2 px-4 py-2 ${rowVisibility} ${
                isToday ? 'bg-sky-50' : isPast ? 'opacity-40' : ''
              } ${bothBlackout && !isPast ? 'bg-slate-100' : ''}`}
            >
              <div className="w-24 shrink-0">
                <p className={`text-xs font-semibold ${isToday ? 'text-sky-600' : 'text-slate-700'}`}>
                  {isToday ? '▶ Today' : dayLabel(dateStr)}
                </p>
              </div>
              <SlotBadge score={morning} mobileCondensed={condensed} leftAlign />
              <SlotBadge score={afternoon} mobileCondensed={condensed} />
            </div>
          )
        })}
      </div>

      {/* Expand / collapse toggle */}
      <button
        className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-slate-400 hover:text-sky-600 hover:bg-slate-50 border-t border-slate-100 transition-colors"
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
