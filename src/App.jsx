import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LOCATION = {
  name: "Jeżyce · Poznań",
  latitude: 52.411,
  longitude: 16.904,
};

const MODELS = [
  { key: "ecmwf_ifs", name: "ECMWF" },
  { key: "gfs_seamless", name: "GFS" },
  { key: "icon_seamless", name: "ICON" },
];

const API_BASE = "https://api.open-meteo.com/v1/forecast";

const weatherCodes = {
  0: ["☀️", "clear sky"],
  1: ["🌤️", "mainly clear"],
  2: ["⛅", "partly cloudy"],
  3: ["☁️", "overcast"],
  45: ["🌫️", "fog"],
  48: ["🌫️", "fog"],
  51: ["🌦️", "light drizzle"],
  53: ["🌦️", "drizzle"],
  55: ["🌧️", "heavy drizzle"],
  61: ["🌦️", "light rain"],
  63: ["🌧️", "rain"],
  65: ["🌧️", "heavy rain"],
  71: ["🌨️", "light snow"],
  73: ["🌨️", "snow"],
  75: ["❄️", "heavy snow"],
  80: ["🌦️", "showers"],
  81: ["🌧️", "rain showers"],
  82: ["⛈️", "heavy showers"],
  85: ["🌨️", "snow showers"],
  86: ["🌨️", "heavy snow showers"],
  95: ["⛈️", "thunderstorm"],
  96: ["⛈️", "thunderstorm with hail"],
  99: ["⛈️", "thunderstorm with hail"],
};

function getWeather(code) {
  return weatherCodes[code] || ["❓", "unknown"];
}

function formatHour(dateString) {
  return dateString.slice(11, 16);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRelevantHours(times, dayOffset) {
  const target = new Date();

  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + dayOffset);

  const targetDate = getLocalDateString(target);

  return times
    .map((time, index) => ({
      time,
      index,
      date: time.slice(0, 10),
      hour: Number(time.slice(11, 13)),
    }))
    .filter(({ hour }) => [8, 9, 10, 18, 19].includes(hour))
    .filter(({ date }) => date === targetDate);
}

function getPeriod(hours, from, to) {
  return hours.filter(({ hour }) => hour >= from && hour <= to);
}

function getPeriodAssessment(models, hours, from, to) {
  const periodHours = getPeriod(hours, from, to);

  const rainValues = [];
  const temperatures = [];
  const windValues = [];
  const gustValues = [];

  models.forEach((model) => {
    periodHours.forEach((hour) => {
      const rain = model.data?.hourly?.precipitation_probability?.[hour.index];

      const temperature = model.data?.hourly?.temperature_2m?.[hour.index];

      const wind = model.data?.hourly?.wind_speed_10m?.[hour.index];

      const gust = model.data?.hourly?.wind_gusts_10m?.[hour.index];

      if (rain !== undefined) rainValues.push(rain);
      if (temperature !== undefined) temperatures.push(temperature);
      if (wind !== undefined) windValues.push(wind);
      if (gust !== undefined) gustValues.push(gust);
    });
  });

  if (!rainValues.length) {
    return {
      title: "No data",
      icon: "❓",
      description: "Forecast data could not be loaded.",
      averageTemp: null,
      averageWind: null,
      maxGust: null,
    };
  }

  const averageRain = rainValues.reduce((a, b) => a + b, 0) / rainValues.length;

  const minRain = Math.min(...rainValues);
  const maxRain = Math.max(...rainValues);
  const spread = maxRain - minRain;

  let title;
  let icon;

  if (averageRain < 20) {
    title = "mostly dry";
    icon = "☀️";
  } else if (averageRain < 50) {
    title = "possible rain";
    icon = "🌦️";
  } else {
    title = "high chance of rain";
    icon = "🌧️";
  }

  let description;

  if (spread <= 15) {
    description = "Models are in close agreement.";
  } else if (spread <= 30) {
    description = "Models show moderate agreement.";
  } else {
    description = "Models differ on precipitation.";
  }

  const averageTemp = temperatures.length
    ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length
    : null;

  const averageWind = windValues.length
    ? windValues.reduce((a, b) => a + b, 0) / windValues.length
    : null;

  const maxGust = gustValues.length ? Math.max(...gustValues) : null;

  return {
    title,
    icon,
    description,
    averageRain,
    averageTemp,
    averageWind,
    maxGust,
  };
}

function PeriodCard({ title, icon, from, to, models, hours }) {
  if (hours.length === 0) {
    return (
      <section className="period-card empty-period">
        <div className="empty-period-icon">{icon}</div>

        <div>
          <div className="period-title">{title}</div>

          <div className="empty-period-text">
            This time period has already passed.
          </div>
        </div>
      </section>
    );
  }

  const assessment = getPeriodAssessment(models, hours, from, to);
  const periodHours = getPeriod(hours, from, to);

  return (
    <section className="period-card">
      <div className="period-header">
        <div>
          <div className="period-title">
            {icon} {title}
          </div>

          <div className="period-summary">
            {assessment.icon} {assessment.title}
          </div>
        </div>

        <div className="period-temp">
          {assessment.averageTemp !== null
            ? `${Math.round(assessment.averageTemp)}°`
            : "—"}
        </div>
      </div>

      <div className="period-description">{assessment.description}</div>

      <div className="forecast-table">
        <div className="forecast-head">
          <div>Model</div>

          {periodHours.map((hour) => (
            <div key={hour.time}>{formatHour(hour.time)}</div>
          ))}
        </div>

        {models.map((model) => (
          <div className="model-row" key={model.key}>
            <div className="model-name">{model.name}</div>

            {periodHours.map((hour) => {
              const temperature =
                model.data?.hourly?.temperature_2m?.[hour.index];

              const precipitation =
                model.data?.hourly?.precipitation_probability?.[hour.index];

              const weatherCode =
                model.data?.hourly?.weather_code?.[hour.index];

              const wind = model.data?.hourly?.wind_speed_10m?.[hour.index];

              const [weatherIcon] = getWeather(weatherCode);

              return (
                <div className="forecast-cell" key={hour.time}>
                  <span className="cell-temp">
                    {temperature !== undefined
                      ? `${Math.round(temperature)}°`
                      : "—"}
                  </span>

                  <span className="cell-weather">{weatherIcon}</span>

                  <span className="cell-rain">
                    {precipitation !== undefined ? `${precipitation}%` : "—"}
                  </span>

                  <span className="cell-wind">
                    {wind !== undefined ? `${Math.round(wind)}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="legend">🌡 temp. · 💧 precipitation · 💨 km/h</div>
    </section>
  );
}

function getInitialDay() {
  return new Date().getHours() >= 19 ? 1 : 0;
}

function App() {
  const [selectedDay, setSelectedDay] = useState(getInitialDay);

  const [models, setModels] = useState(
    MODELS.map((model) => ({
      ...model,
      data: null,
      loading: true,
      error: false,
    })),
  );

  const [lastUpdate, setLastUpdate] = useState(null);

  const currentDateRef = useRef(getLocalDateString(new Date()));

  const fetchWeather = async () => {
    setModels((current) =>
      current.map((model) => ({
        ...model,
        loading: true,
        error: false,
      })),
    );

    const results = await Promise.all(
      MODELS.map(async (model) => {
        const params = new URLSearchParams({
          latitude: LOCATION.latitude,
          longitude: LOCATION.longitude,
          hourly: [
            "temperature_2m",
            "precipitation_probability",
            "precipitation",
            "weather_code",
            "wind_speed_10m",
            "wind_gusts_10m",
          ].join(","),
          forecast_days: "3",
          timezone: "Europe/Warsaw",
          models: model.key,
        });

        try {
          const response = await fetch(`${API_BASE}?${params}`);

          if (!response.ok) {
            throw new Error("Weather API error");
          }

          const data = await response.json();

          return {
            ...model,
            data,
            loading: false,
            error: false,
          };
        } catch {
          return {
            ...model,
            data: null,
            loading: false,
            error: true,
          };
        }
      }),
    );

    setModels(results);
    setLastUpdate(new Date());
  };

  // Initial weather fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWeather();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Automatic day handling
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const today = getLocalDateString(now);

      // New calendar day detected
      if (today !== currentDateRef.current) {
        currentDateRef.current = today;

        setSelectedDay(0);
        fetchWeather();

        return;
      }

      // After 19:00 automatically show tomorrow
      if (hour >= 19 && selectedDay === 0) {
        setSelectedDay(1);
      }
    };

    const timer = setInterval(checkTime, 60 * 1000);

    return () => clearInterval(timer);
  }, [selectedDay]);

  const hours = useMemo(() => {
    const firstModel = models.find((model) => model.data);

    if (!firstModel?.data?.hourly?.time) {
      return [];
    }

    return getRelevantHours(firstModel.data.hourly.time, selectedDay);
  }, [models, selectedDay]);

  const morningAssessment = getPeriodAssessment(models, hours, 8, 10);

  const eveningAssessment = getPeriodAssessment(models, hours, 18, 19);

  const loading = models.some((model) => model.loading);

  const selectedDate = new Date();
  selectedDate.setDate(selectedDate.getDate() + selectedDay);

  return (
    <main className="app">
      <div className="container">
        <header className="header">
          <div>
            <div className="location">{LOCATION.name}</div>

            <div className="date">{formatDate(selectedDate)}</div>
          </div>

          <button
            className="refresh-button"
            onClick={fetchWeather}
            disabled={loading}
          >
            ↻
          </button>
        </header>

        <div className="day-switch">
          <button
            className={selectedDay === 0 ? "active" : ""}
            onClick={() => setSelectedDay(0)}
          >
            TODAY
          </button>

          <button
            className={selectedDay === 1 ? "active" : ""}
            onClick={() => setSelectedDay(1)}
          >
            TOMORROW
          </button>
        </div>

        <section className="quick-summary">
          <div className="summary-card">
            <div className="summary-icon">{morningAssessment.icon}</div>

            <div>
              <div className="summary-period">08:00–10:00</div>

              <div className="summary-title">
                MORNING: {morningAssessment.title}
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">{eveningAssessment.icon}</div>

            <div>
              <div className="summary-period">18:00–19:00</div>

              <div className="summary-title">
                EVENING: {eveningAssessment.title}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="loading">Loading forecast…</div>
        ) : (
          <>
            <PeriodCard
              title="08:00–10:00"
              icon="🌅"
              from={8}
              to={10}
              models={models}
              hours={hours}
            />

            <PeriodCard
              title="18:00–19:00"
              icon="🌆"
              from={18}
              to={19}
              models={models}
              hours={hours}
            />
          </>
        )}

        <section className="models-status">
          <div className="models-title">MODELS</div>

          <div className="model-status-list">
            {models.map((model) => (
              <div className="model-status" key={model.key}>
                <span className="status-dot">●</span>

                <span>{model.name}</span>
              </div>
            ))}
          </div>
        </section>

        <footer>
          <span>Open-Meteo · ECMWF · GFS · ICON</span>

          {lastUpdate && (
            <span>
              {lastUpdate.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </footer>
      </div>
    </main>
  );
}

export default App;
