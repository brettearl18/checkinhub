/**
 * Live weather for Australian capital cities (Open-Meteo, no API key).
 * Default city is Perth; clients can pick their nearest capital.
 */

export type WeatherCityId =
  | "perth"
  | "adelaide"
  | "brisbane"
  | "canberra"
  | "darwin"
  | "hobart"
  | "melbourne"
  | "sydney";

export type WeatherCity = {
  id: WeatherCityId;
  label: string;
  lat: number;
  lon: number;
  timezone: string;
};

export const WEATHER_CITIES: WeatherCity[] = [
  { id: "perth", label: "Perth", lat: -31.9523, lon: 115.8613, timezone: "Australia/Perth" },
  { id: "adelaide", label: "Adelaide", lat: -34.9285, lon: 138.6007, timezone: "Australia/Adelaide" },
  { id: "brisbane", label: "Brisbane", lat: -27.4698, lon: 153.0251, timezone: "Australia/Brisbane" },
  { id: "canberra", label: "Canberra", lat: -35.2809, lon: 149.13, timezone: "Australia/Sydney" },
  { id: "darwin", label: "Darwin", lat: -12.4634, lon: 130.8456, timezone: "Australia/Darwin" },
  { id: "hobart", label: "Hobart", lat: -42.8821, lon: 147.3272, timezone: "Australia/Hobart" },
  { id: "melbourne", label: "Melbourne", lat: -37.8136, lon: 144.9631, timezone: "Australia/Melbourne" },
  { id: "sydney", label: "Sydney", lat: -33.8688, lon: 151.2093, timezone: "Australia/Sydney" },
];

export const DEFAULT_WEATHER_CITY_ID: WeatherCityId = "perth";

/** @deprecated use DEFAULT_WEATHER_CITY_ID / getWeatherCity("perth") */
export const PERTH_LAT = -31.9523;
/** @deprecated */
export const PERTH_LON = 115.8613;

export function isWeatherCityId(value: unknown): value is WeatherCityId {
  return typeof value === "string" && WEATHER_CITIES.some((c) => c.id === value);
}

export function getWeatherCity(id: WeatherCityId | string | null | undefined): WeatherCity {
  const found = WEATHER_CITIES.find((c) => c.id === id);
  return found ?? WEATHER_CITIES.find((c) => c.id === DEFAULT_WEATHER_CITY_ID)!;
}

export type PerthWeatherScene =
  | "clear-day"
  | "clear-night"
  | "partly-day"
  | "partly-night"
  | "overcast"
  | "fog"
  | "rain"
  | "storm"
  | "unknown";

export type PerthDayForecast = {
  date: string; // YYYY-MM-DD in city timezone
  weekdayShort: string;
  weatherCode: number;
  label: string;
  shortLabel: string;
  tempMaxC: number;
  tempMinC: number;
  isToday: boolean;
  scene: PerthWeatherScene;
};

export type PerthWeather = {
  cityId: WeatherCityId;
  cityLabel: string;
  timezone: string;
  temperatureC: number;
  weatherCode: number;
  isDay: boolean;
  label: string;
  scene: PerthWeatherScene;
  fetchedAt: string;
  /** Local clock time when fetched, e.g. 9:31 pm */
  localTimeLabel: string;
  /** Today's sunrise in city local time, e.g. 5:12 am */
  sunriseLabel: string | null;
  /** Today's sunset in city local time */
  sunsetLabel: string | null;
  week: PerthDayForecast[];
};

export function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Showers";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Fair";
}

export function wmoShortLabel(code: number): string {
  if (code === 0 || code === 1) return "Clear";
  if (code === 2) return "Partly";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95 && code <= 99) return "Storm";
  return "—";
}

export function sceneFor(code: number, isDay: boolean): PerthWeatherScene {
  if (code === 0 || code === 1) return isDay ? "clear-day" : "clear-night";
  if (code === 2) return isDay ? "partly-day" : "partly-night";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 95 && code <= 99) return "storm";
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 71 && code <= 77)
  ) {
    return "rain";
  }
  return "unknown";
}

function todayKeyInZone(timeZone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

function weekdayShortInZone(dateKey: string, timeZone: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short" }).format(d);
}

/** Format a Date or ISO string as compact local time in a zone (e.g. 5:12 am). */
export function formatLocalTimeLabel(
  value: Date | string | number,
  timeZone: string
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

const SCENE_IMAGES: Record<PerthWeatherScene, string> = {
  "clear-day": "/weather/perth-sunset.jpg",
  "clear-night": "/weather/ocean-night.jpg",
  "partly-day": "/weather/ocean-partly.jpg",
  "partly-night": "/weather/ocean-dusk.jpg",
  overcast: "/weather/ocean-overcast.jpg",
  fog: "/weather/ocean-fog.jpg",
  rain: "/weather/ocean-rain.jpg",
  storm: "/weather/ocean-storm.jpg",
  unknown: "/weather/perth-sunset.jpg",
};

export function perthWeatherBackdrop(scene: PerthWeatherScene): {
  imageSrc: string;
  sky: string;
  glow: string;
  showRain: boolean;
} {
  const imageSrc = SCENE_IMAGES[scene] ?? SCENE_IMAGES.unknown;
  switch (scene) {
    case "clear-day":
      return {
        imageSrc,
        sky: "linear-gradient(160deg, #4A90C8 0%, #87B8D8 38%, #E8C48A 72%, #C48A4A 100%)",
        glow: "radial-gradient(ellipse 70% 55% at 78% 22%, rgba(255,220,140,0.35), transparent 60%)",
        showRain: false,
      };
    case "clear-night":
      return {
        imageSrc,
        sky: "linear-gradient(165deg, #0B1220 0%, #1A2740 45%, #2A3348 100%)",
        glow: "radial-gradient(ellipse 40% 35% at 82% 18%, rgba(220,230,255,0.2), transparent 55%)",
        showRain: false,
      };
    case "partly-day":
      return {
        imageSrc,
        sky: "linear-gradient(155deg, #5B7FA3 0%, #8FA8BC 40%, #C9B08A 78%, #9A7348 100%)",
        glow: "radial-gradient(ellipse 60% 50% at 70% 28%, rgba(255,210,150,0.25), transparent 65%)",
        showRain: false,
      };
    case "partly-night":
      return {
        imageSrc,
        sky: "linear-gradient(165deg, #121820 0%, #243044 50%, #3A4050 100%)",
        glow: "radial-gradient(ellipse 45% 40% at 75% 20%, rgba(180,200,230,0.15), transparent 60%)",
        showRain: false,
      };
    case "overcast":
      return {
        imageSrc,
        sky: "linear-gradient(160deg, #5A6570 0%, #7A8490 45%, #8A9098 100%)",
        glow: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.12), transparent 55%)",
        showRain: false,
      };
    case "fog":
      return {
        imageSrc,
        sky: "linear-gradient(160deg, #7A8188 0%, #A8AEB4 50%, #B8B4A8 100%)",
        glow: "radial-gradient(ellipse 100% 80% at 50% 60%, rgba(255,255,255,0.25), transparent 70%)",
        showRain: false,
      };
    case "rain":
      return {
        imageSrc,
        sky: "linear-gradient(165deg, #3A4A58 0%, #5A6A78 40%, #6A737C 100%)",
        glow: "radial-gradient(ellipse 70% 50% at 40% 10%, rgba(160,180,200,0.2), transparent 60%)",
        showRain: true,
      };
    case "storm":
      return {
        imageSrc,
        sky: "linear-gradient(165deg, #1A222C 0%, #2E3A48 40%, #3A4550 100%)",
        glow: "radial-gradient(ellipse 50% 40% at 60% 15%, rgba(180,200,255,0.15), transparent 55%)",
        showRain: true,
      };
    default:
      return {
        imageSrc,
        sky: "linear-gradient(145deg, #3D2A1C 0%, #5A4030 50%, #2A1F16 100%)",
        glow: "radial-gradient(ellipse 60% 50% at 70% 30%, rgba(218,164,80,0.2), transparent 65%)",
        showRain: false,
      };
  }
}

export async function fetchCityWeather(
  cityId: WeatherCityId | string = DEFAULT_WEATHER_CITY_ID
): Promise<PerthWeather | null> {
  const city = getWeatherCity(cityId);
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(city.lat));
    url.searchParams.set("longitude", String(city.lon));
    url.searchParams.set("current", "temperature_2m,weather_code,is_day");
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset"
    );
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("timezone", city.timezone);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        sunrise?: string[];
        sunset?: string[];
      };
    };
    const temp = json.current?.temperature_2m;
    const code = json.current?.weather_code;
    if (typeof temp !== "number" || typeof code !== "number") return null;
    const isDay = json.current?.is_day === 1;
    const today = todayKeyInZone(city.timezone);

    const times = json.daily?.time ?? [];
    const codes = json.daily?.weather_code ?? [];
    const maxes = json.daily?.temperature_2m_max ?? [];
    const mins = json.daily?.temperature_2m_min ?? [];
    const sunrises = json.daily?.sunrise ?? [];
    const sunsets = json.daily?.sunset ?? [];
    const week: PerthDayForecast[] = [];
    let sunriseLabel: string | null = null;
    let sunsetLabel: string | null = null;

    for (let i = 0; i < times.length; i++) {
      const date = times[i];
      const dayCode = codes[i];
      const max = maxes[i];
      const min = mins[i];
      if (!date || typeof dayCode !== "number" || typeof max !== "number" || typeof min !== "number") {
        continue;
      }
      if (date === today) {
        if (sunrises[i]) sunriseLabel = formatLocalTimeLabel(sunrises[i]!, city.timezone);
        if (sunsets[i]) sunsetLabel = formatLocalTimeLabel(sunsets[i]!, city.timezone);
      }
      week.push({
        date,
        weekdayShort: weekdayShortInZone(date, city.timezone),
        weatherCode: dayCode,
        label: wmoLabel(dayCode),
        shortLabel: wmoShortLabel(dayCode),
        tempMaxC: Math.round(max),
        tempMinC: Math.round(min),
        isToday: date === today,
        scene: sceneFor(dayCode, true),
      });
    }

    return {
      cityId: city.id,
      cityLabel: city.label,
      timezone: city.timezone,
      temperatureC: Math.round(temp),
      weatherCode: code,
      isDay,
      label: wmoLabel(code),
      scene: sceneFor(code, isDay),
      fetchedAt: new Date().toISOString(),
      localTimeLabel: formatLocalTimeLabel(new Date(), city.timezone),
      sunriseLabel,
      sunsetLabel,
      week,
    };
  } catch {
    return null;
  }
}

/** @deprecated prefer fetchCityWeather */
export async function fetchPerthWeather(): Promise<PerthWeather | null> {
  return fetchCityWeather("perth");
}

export const WEATHER_CITY_PREF_KEY = "checkinhub.weatherCity";

export function getStoredWeatherCityId(): WeatherCityId {
  if (typeof window === "undefined") return DEFAULT_WEATHER_CITY_ID;
  try {
    const raw = window.localStorage.getItem(WEATHER_CITY_PREF_KEY);
    return isWeatherCityId(raw) ? raw : DEFAULT_WEATHER_CITY_ID;
  } catch {
    return DEFAULT_WEATHER_CITY_ID;
  }
}

export function setStoredWeatherCityId(id: WeatherCityId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEATHER_CITY_PREF_KEY, id);
  } catch {
    // ignore
  }
}
