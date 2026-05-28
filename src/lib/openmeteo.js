const cache = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 min

// Scale 10m model wind down to ~2m (player height) over smooth beach surface.
// Log wind profile: ln(2/0.001) / ln(10/0.001) ≈ 0.83
const HEIGHT_CORRECTION = 0.83

export async function fetchWeather(lat, lon) {
  const key = `${lat},${lon}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data

  // Two fetches in parallel: HRRR (high-res, 48h US) + best_match (7-day fallback).
  // HRRR wins for hours where it has data; best_match fills the rest.
  const [hrrrData, fallbackData] = await Promise.all([
    fetchModel(lat, lon, 'gfs_hrrr', 2),
    fetchModel(lat, lon, 'best_match', 7),
  ])

  // Merge: prefer HRRR rows when available (non-null wind)
  const hrrrMap = new Map(hrrrData.map(h => [h.time, h]))
  const data = fallbackData.map(h => hrrrMap.has(h.time) && hrrrMap.get(h.time).wind_speed_10m != null
    ? hrrrMap.get(h.time)
    : h
  )

  cache.set(key, { data, ts: Date.now() })
  return data
}

async function fetchModel(lat, lon, model, forecastDays) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat)
  url.searchParams.set('longitude', lon)
  url.searchParams.set('hourly', 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability')
  url.searchParams.set('wind_speed_unit', 'mph')
  url.searchParams.set('temperature_unit', 'fahrenheit')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('past_days', '7')
  url.searchParams.set('forecast_days', String(forecastDays))
  url.searchParams.set('models', model)

  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    if (!json.hourly) return []

    return json.hourly.time.map((time, i) => {
      const raw_speed = json.hourly.wind_speed_10m[i]
      const raw_gust = json.hourly.wind_gusts_10m[i]
      return {
        time,
        wind_speed_10m: raw_speed != null ? raw_speed * HEIGHT_CORRECTION : null,
        wind_gusts_10m: raw_gust != null ? raw_gust * HEIGHT_CORRECTION : null,
        wind_direction_10m: json.hourly.wind_direction_10m[i],
        temperature_2m: json.hourly.temperature_2m[i],
        precipitation_probability: json.hourly.precipitation_probability[i],
      }
    })
  } catch {
    return []
  }
}

export async function geocodeSearch(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`)
  const json = await res.json()
  return json.results ?? []
}
