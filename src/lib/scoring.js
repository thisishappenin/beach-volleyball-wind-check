const PLAY_WINDOWS = [
  { start: 8, end: 11 },  // 8–11 AM
  { start: 16, end: 19 }, // 4–7 PM
]

function isPlayHour(hour) {
  return PLAY_WINDOWS.some(w => hour >= w.start && hour < w.end)
}

export function scoreHour(hourData, location) {
  const { wind_speed_10m: sustained_mph, wind_direction_10m: wind_dir_deg } = hourData
  const gust_mph = hourData.wind_gusts_10m ?? hourData.wind_speed_10m
  const court_bearing = location.court_bearing_deg

  let effective_wind
  const reasons = []

  if (court_bearing == null) {
    effective_wind = sustained_mph
  } else {
    let angle = Math.abs(wind_dir_deg - court_bearing) % 180
    if (angle > 90) angle = 180 - angle
    const crosswind_factor = Math.sin((angle * Math.PI) / 180)
    const parallel_factor = Math.cos((angle * Math.PI) / 180) * 0.75
    effective_wind = sustained_mph * (crosswind_factor + parallel_factor)
  }

  if (gust_mph - sustained_mph >= 8) {
    effective_wind += 2
    reasons.push('gusty')
  }

  let verdict
  if (effective_wind < 8 && gust_mph < 13) {
    verdict = 'good'
  } else if (effective_wind < 11 && gust_mph < 17) {
    verdict = 'playable'
  } else if (effective_wind < 16 && gust_mph < 22) {
    verdict = 'skip'
  } else {
    verdict = 'blackout'
  }

  if ((hourData.precipitation_probability ?? 0) >= 50) {
    reasons.push('rain risk')
  }
  if (hourData.temperature_2m < 60 || hourData.temperature_2m > 95) {
    reasons.push('temp warning')
  }

  return { verdict, effective_wind: Math.round(effective_wind * 10) / 10, sustained_mph, gust_mph, reasons }
}

export function getPlayHours(hourlyData) {
  return hourlyData.filter(h => isPlayHour(new Date(h.time).getHours()))
}

export function scoreCurrentHour(hourlyData, location) {
  const now = new Date()
  const currentHour = now.getHours()
  const entry = hourlyData.find(h => new Date(h.time).getHours() === currentHour)
  if (!entry) return null
  return scoreHour(entry, location)
}

export function bestWindowToday(hourlyData, location) {
  const playHours = getPlayHours(hourlyData)
  const scored = playHours.map(h => ({ ...h, score: scoreHour(h, location) }))

  // Find longest contiguous run of "good" hours (break on time gaps)
  let bestRun = []
  let currentRun = []
  for (let i = 0; i < scored.length; i++) {
    const h = scored[i]
    const prev = scored[i - 1]
    const gapped = prev && new Date(h.time).getHours() - new Date(prev.time).getHours() > 1
    if (gapped) currentRun = []
    if (h.score.verdict === 'good') {
      currentRun.push(h)
      if (currentRun.length > bestRun.length) bestRun = [...currentRun]
    } else {
      currentRun = []
    }
  }

  if (bestRun.length > 0) {
    const start = formatHour(new Date(bestRun[0].time))
    const endTime = new Date(bestRun[bestRun.length - 1].time)
    endTime.setHours(endTime.getHours() + 1)
    const end = formatHour(endTime)
    return { run: bestRun, label: `${start} – ${end}`, verdict: 'good' }
  }

  // Fall back: worst hour verdict across play hours
  const verdictRank = { good: 0, playable: 1, skip: 2 }
  const worst = scored.reduce((a, b) =>
    verdictRank[a.score.verdict] >= verdictRank[b.score.verdict] ? a : b, scored[0])

  return { run: scored, label: null, verdict: worst?.score?.verdict ?? 'skip' }
}

export function windDirectionLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function formatHour(date) {
  const h = date.getHours()
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

export { formatHour }
