const PLAY_WINDOWS = [
  { start: 8, end: 11 },  // 8–11 AM
  { start: 16, end: 19 }, // 4–7 PM
]

// Verdict bands, in mph. `wind` is the effective (direction- + gust-adjusted) speed;
// `gust` is the raw 10m gust ceiling. A band requires BOTH to be under its caps;
// anything above the `skip` band is `blackout` (unplayable). Semantics the bands
// encode:
//   good (green)     — REALLY good: calm, a standout day. Reserved, not the default.
//   playable (yellow)— go play, just the usual breeze. The normal playable case.
//   skip (red)       — playable but windy; pick another day if you can.
//   blackout         — unplayable.
//
// Calibrated to three ground-truth sessions at Huntington Beach Pier (PM, court_bearing=125°),
// which the gust-dominant effective wind ranks correctly in order of how they played
// (effective wind computed after GUST_CORRECTION=0.85 applied in openmeteo.js):
//   21 May 2026 — 13 sustained / 10 gusts (smooth) → eff  9.8 → "pretty good"           → yellow
//   28 May 2026 — 11 sustained / 16 gusts (gusty)  → eff 12.1 → "edge of unplayable"    → red (low end)
//   19 May 2026 — 16 sustained / 15 gusts (strong) → eff 13.4 → "completely unplayable" → blackout
// "Pretty good" is yellow, not green — green is for genuinely calm days (which is why
// HB mornings read green and the usual afternoon sea breeze reads yellow).
export const WIND_BANDS = {
  good:     { wind: 8,  gust: 10 },
  playable: { wind: 12, gust: 16 },
  skip:     { wind: 13, gust: 20 },
  // (no caps) => blackout
}

function isPlayHour(hour) {
  return PLAY_WINDOWS.some(w => hour >= w.start && hour < w.end)
}

export function scoreHour(hourData, location) {
  const { wind_speed_10m: sustained_mph, wind_direction_10m: wind_dir_deg } = hourData
  const gust_mph = hourData.wind_gusts_10m ?? hourData.wind_speed_10m
  const court_bearing = location.court_bearing_deg

  const reasons = []

  // Direction-adjust the sustained wind against the court's long axis: crosswind
  // (across the axis) disrupts ball control most, so it gets full weight; along-axis
  // wind is more predictable, so it's weighted 0.75. Combine as a vector magnitude
  // rather than a scalar sum — a plain sum peaks at ~1.25x near 53°, scoring a diagonal
  // wind worse than a pure crosswind. The magnitude form stays within 0.75–1.0x.
  let adj_sustained
  if (court_bearing == null) {
    adj_sustained = sustained_mph
  } else {
    let angle = Math.abs(wind_dir_deg - court_bearing) % 180
    if (angle > 90) angle = 180 - angle
    const rad = (angle * Math.PI) / 180
    const crosswind = Math.sin(rad)
    const parallel = Math.cos(rad) * 0.75
    adj_sustained = sustained_mph * Math.sqrt(crosswind * crosswind + parallel * parallel)
  }

  // Players react to gust peaks, not the height-corrected average — a steady 11 mph and
  // an 11 mph average spiking to 15 play completely differently. So the "effective" wind
  // is gust-dominant. Gusts are used raw: they reach ground level unattenuated and swirl,
  // so neither the height (×0.83 upstream) nor the direction discount applies to them.
  // GUST_WEIGHT calibrated to HB Pier, 28 May 2026 PM (11 sustained / 16 gusts, court_bearing=125° → ~12.1,
  // lower end of `skip` — "bad but playable, near the edge").
  const GUST_WEIGHT = 0.6
  const effective_wind = GUST_WEIGHT * gust_mph + (1 - GUST_WEIGHT) * adj_sustained
  if (gust_mph - sustained_mph >= 5) reasons.push('gusty')

  let verdict
  if (effective_wind < WIND_BANDS.good.wind && gust_mph < WIND_BANDS.good.gust) {
    verdict = 'good'
  } else if (effective_wind < WIND_BANDS.playable.wind && gust_mph < WIND_BANDS.playable.gust) {
    verdict = 'playable'
  } else if (effective_wind < WIND_BANDS.skip.wind && gust_mph < WIND_BANDS.skip.gust) {
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
  const verdictRank = { good: 0, playable: 1, skip: 2, blackout: 3 }
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

// Continuous 0–10 playability score derived from verdict + effective wind position
// within that band. Scores are consistent across band boundaries (e.g. both sides of
// the good/playable line give 7 at the exact threshold).
//   good     → 10 at 0 mph, 7 at the good ceiling
//   playable → 7 → 4
//   skip     → 4 → 2
//   blackout → 2 → 0
export function playabilityScore(verdict, effectiveWind) {
  const G = WIND_BANDS.good.wind      // 8
  const P = WIND_BANDS.playable.wind  // 12
  const S = WIND_BANDS.skip.wind      // 13.5
  if (verdict === 'good')
    return Math.round(10 - Math.min(effectiveWind / G, 1) * 3)
  if (verdict === 'playable')
    return Math.round(7 - Math.min((effectiveWind - G) / (P - G), 1) * 3)
  if (verdict === 'skip')
    return Math.round(4 - Math.min((effectiveWind - P) / (S - P), 1) * 2)
  return Math.round(Math.max(0, 2 - Math.min((effectiveWind - S) / 6.5, 1) * 2))
}

export { formatHour }
