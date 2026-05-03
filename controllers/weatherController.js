// controllers/weatherController.js
// Fetches current weather from Open-Meteo (free, no API key required).
// Returns a formatted context string ready to inject into an LLM system prompt,
// plus structured weather data for the frontend to display.

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

// WMO weather code descriptions
const WMO_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
};

/**
 * GET /api/weather?lat=&lon=&units=fahrenheit|celsius
 * Returns current weather + an LLM-ready context string.
 * Defaults to metric if units not specified.
 */
async function getWeather(req, res) {
  const { lat, lon, units } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({
      error: "lat and lon query parameters are required.",
    });
  }

  const tempUnit = units === "fahrenheit" ? "fahrenheit" : "celsius";
  const tempSymbol = tempUnit === "fahrenheit" ? "°F" : "°C";
  const windUnit = tempUnit === "fahrenheit" ? "mph" : "kmh";

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "wind_speed_10m",
        "weather_code",
        "is_day",
        "precipitation",
      ].join(","),
      temperature_unit: tempUnit,
      wind_speed_unit: windUnit,
      timezone: "auto",
    });

    const response = await fetch(`${WEATHER_API}?${params}`);
    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }

    const data = await response.json();
    const c = data.current;

    const description = WMO_CODES[c.weather_code] ?? "Unknown conditions";
    const isDay = c.is_day === 1;

    // Structured data for frontend
    const weather = {
      code: c.weather_code,
      temperature: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      windSpeed: Math.round(c.wind_speed_10m),
      description,
      isDay,
      precipitation: c.precipitation,
      unit: tempSymbol,
      windUnit,
    };

    // LLM context string
    const weatherCtx = buildWeatherContext(weather, tempSymbol, windUnit);

    return res.json({ weather, weatherCtx });
  } catch (err) {
    console.error("[weatherController] error:", err);
    return res.status(500).json({ error: err.message });
  }
}

function buildWeatherContext(w, tempSymbol, windUnit) {
  const timeOfDay = w.isDay ? "daytime" : "nighttime";
  const rainNote = w.precipitation > 0 ? ` with ${w.precipitation}mm precipitation` : "";
  return (
    `It is currently ${timeOfDay}. Weather: ${w.description}${rainNote}. ` +
    `Temperature: ${w.temperature}${tempSymbol} (feels like ${w.feelsLike}${tempSymbol}). ` +
    `Humidity: ${w.humidity}%. Wind: ${w.windSpeed} ${windUnit}.`
  );
}

module.exports = { getWeather };
