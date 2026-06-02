const cache = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 min

// Scale 10m mean wind to ~2m (player height) via log wind profile over smooth sand.
// ln(2/0.001) / ln(10/0.001) ≈ 0.83. Applied to sustained only — gusts are turbulent
// bursts that penetrate to ground level and should not be attenuated this way.
const SUSTAINED_CORRECTION = 0.83

export async function fetchWeather(lat, lon) {
  const key = `${lat},${lon}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data

  // Three models in parallel — each has a documented blind spot for SoCal afternoon
  // sea breeze; worst-case across all three hedges against any single model's bias:
  //   gfs_hrrr:     3 km, best short-range resolution, but marine layer cloud tops run
  //                 ~150 m too low → suppresses afternoon land heating → documented low
  //                 bias on sea breeze peak (Sheridan et al. 2025). 48 h limit.
  //   ecmwf_ifs025: 28 km, coarser but better synoptic pressure gradients that set up
  //                 the sea breeze; captures the large-scale forcing HRRR can miss.
  //   gfs_seamless: HRRR for 0–48 h, GFS beyond — avoids the HRRR cloud bias and
  //                 provides continuity past 48 h.
  const [hrrrData, ecmwfData, gfsData] = await Promise.all([
    fetchModel(lat, lon, 'gfs_hrrr', 2),
    fetchModel(lat, lon, 'ecmwf_ifs025', 7),
    fetchModel(lat, lon, 'gfs_seamless', 7),
  ])

  const hrrrMap = new Map(hrrrData.map(h => [h.time, h]))
  const ecmwfMap = new Map(ecmwfData.map(h => [h.time, h]))
  const gfsMap   = new Map(gfsData.map(h => [h.time, h]))

  // GFS seamless + ECMWF together cover the full 7-day hourly backbone.
  const allTimes = new Set([...gfsData.map(h => h.time), ...ecmwfData.map(h => h.time)])
  const data = [...allTimes].sort().map(time => {
    const candidates = [hrrrMap.get(time), ecmwfMap.get(time), gfsMap.get(time)]
      .filter(h => h?.wind_speed_10m != null)
    if (candidates.length === 0) return null

    // Consensus average across available models. Pure max was too aggressive —
    // 3-model spread alone can be 3–5 mph, so max almost always shows the worst
    // outlier. Averaging still skews higher than HRRR alone (ECMWF and GFS both
    // tend to predict stronger sea breeze than HRRR), without crying wolf every day.
    const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length
    const avgSustained = avg(candidates.map(h => h.wind_speed_10m))
    const avgGust      = avg(candidates.map(h => h.wind_gusts_10m ?? h.wind_speed_10m))
    const windiest = candidates.reduce((a, b) => a.wind_speed_10m >= b.wind_speed_10m ? a : b)

    return {
      time,
      wind_speed_10m:           avgSustained,
      wind_gusts_10m:           avgGust,
      wind_direction_10m:       windiest.wind_direction_10m,
      temperature_2m:           windiest.temperature_2m,
      precipitation_probability: Math.max(...candidates.map(h => h.precipitation_probability ?? 0)),
    }
  }).filter(Boolean)

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
        wind_speed_10m: raw_speed != null ? raw_speed * SUSTAINED_CORRECTION : null,
        wind_gusts_10m: raw_gust != null ? raw_gust : null,
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
