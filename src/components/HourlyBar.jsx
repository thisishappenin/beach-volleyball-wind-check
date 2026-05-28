import { scoreHour, formatHour } from '../lib/scoring'

const COLOR = {
  good: 'bg-green-400',
  playable: 'bg-yellow-400',
  skip: 'bg-red-400',
}

const LABEL_COLOR = {
  good: 'text-green-700',
  playable: 'text-yellow-700',
  skip: 'text-red-600',
}

const PLAY_WINDOWS = [
  { start: 8, end: 11, label: 'Morning' },
  { start: 16, end: 19, label: 'Afternoon' },
]

function hourLabel(h) {
  if (h === 0) return '12A'
  if (h < 12) return `${h}A`
  if (h === 12) return '12P'
  return `${h - 12}P`
}

export default function HourlyBar({ hourlyData, location }) {
  const now = new Date()
  const currentHour = now.getHours()

  const windows = PLAY_WINDOWS.map(w => ({
    ...w,
    hours: hourlyData.filter(h => {
      const hr = new Date(h.time).getHours()
      return hr >= w.start && hr < w.end
    }),
  }))

  return (
    <div className="mt-3 px-1 space-y-3">
      {windows.map(win => (
        <div key={win.label}>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">{win.label}</p>
          <div className="flex gap-1 items-end h-12">
            {win.hours.map(h => {
              const date = new Date(h.time)
              const hour = date.getHours()
              const { verdict, sustained_mph } = scoreHour(h, location)
              const isCurrent = hour === currentHour
              const heightPct = Math.min(100, Math.max(10, (sustained_mph / 25) * 100))

              return (
                <div
                  key={h.time}
                  className="flex-1 flex flex-col items-center"
                  title={`${formatHour(date)}: ${sustained_mph} mph, gusts ${h.wind_gusts_10m} mph`}
                >
                  <div className="w-full flex items-end" style={{ height: '40px' }}>
                    <div
                      className={`w-full rounded-t ${COLOR[verdict]} ${isCurrent ? 'ring-2 ring-offset-1 ring-slate-700' : ''} transition-all`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">{hourLabel(hour)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-3 text-xs text-slate-500 pt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Good</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Marginal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Skip</span>
      </div>
    </div>
  )
}
