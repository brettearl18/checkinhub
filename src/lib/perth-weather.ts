/** Live Perth weather for dashboard atmosphere (Open-Meteo, no API key). */

export const PERTH_LAT = -31.9523;
export const PERTH_LON = 115.8613;

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
  date: string; // YYYY-MM-DD Perth
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
  temperatureC: number;
  weatherCode: number;
  isDay: boolean;
  label: string;
  scene: PerthWeatherScene;
  fetchedAt: string;
  /** Rest of the week (and today), Perth daily forecast */
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
  return "Perth";
}

/** Compact label for 7-day strip */
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

function weekdayShortPerth(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    weekday: "short",
  }).format(d);
}

function todayPerthKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Perth" });
}

/** Local coastal photos mapped to live Perth weather (shown under the brown overlay). */
const SCENE_IMAGES: Record<PerthWeatherScene, string> = {
  /** Golden coastal — matches redesign mockup under the brown wash */
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

/** CSS + photo for the hero weather plate (photo sits behind the brown overlay). */
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

export async function fetchPerthWeather(): Promise<PerthWeather | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(PERTH_LAT));
    url.searchParams.set("longitude", String(PERTH_LON));
    url.searchParams.set("current", "temperature_2m,weather_code,is_day");
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min"
    );
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("timezone", "Australia/Perth");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
      };
    };
    const temp = json.current?.temperature_2m;
    const code = json.current?.weather_code;
    if (typeof temp !== "number" || typeof code !== "number") return null;
    const isDay = json.current?.is_day === 1;
    const today = todayPerthKey();

    const times = json.daily?.time ?? [];
    const codes = json.daily?.weather_code ?? [];
    const maxes = json.daily?.temperature_2m_max ?? [];
    const mins = json.daily?.temperature_2m_min ?? [];
    const week: PerthDayForecast[] = [];
    for (let i = 0; i < times.length; i++) {
      const date = times[i];
      const dayCode = codes[i];
      const max = maxes[i];
      const min = mins[i];
      if (!date || typeof dayCode !== "number" || typeof max !== "number" || typeof min !== "number") {
        continue;
      }
      week.push({
        date,
        weekdayShort: weekdayShortPerth(date),
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
      temperatureC: Math.round(temp),
      weatherCode: code,
      isDay,
      label: wmoLabel(code),
      scene: sceneFor(code, isDay),
      fetchedAt: new Date().toISOString(),
      week,
    };
  } catch {
    return null;
  }
}
