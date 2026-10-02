import { useEffect, useMemo, useState } from "react";
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
  0: ["☀️", "bezchmurnie"],
  1: ["🌤️", "głównie pogodnie"],
  2: ["⛅", "częściowe zachmurzenie"],
  3: ["☁️", "pochmurno"],
  45: ["🌫️", "mgła"],
  48: ["🌫️", "mgła"],
  51: ["🌦️", "lekka mżawka"],
  53: ["🌦️", "mżawka"],
  55: ["🌧️", "mocna mżawka"],
  61: ["🌦️", "lekki deszcz"],
  63: ["🌧️", "deszcz"],
  65: ["🌧️", "mocny deszcz"],
  71: ["🌨️", "lekki śnieg"],
  73: ["🌨️", "śnieg"],
  75: ["❄️", "mocny śnieg"],
  80: ["🌦️", "przelotny deszcz"],
  81: ["🌧️", "przelotny deszcz"],
  82: ["⛈️", "silny przelotny deszcz"],
  85: ["🌨️", "przelotny śnieg"],
  86: ["🌨️", "silny przelotny śnieg"],
  95: ["⛈️", "burza"],
  96: ["⛈️", "burza z gradem"],
  99: ["⛈️", "burza z gradem"],
};

function getWeather(code) {
  return weatherCodes[code] || ["❓", "nieznane"];
}

function formatHour(dateString) {
  return dateString.slice(11, 16);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function getRelevantHours(times, dayOffset) {
  return times
    .map((time, index) => ({
      time,
      index,
      date: time.slice(0, 10),
      hour: Number(time.slice(11, 13)),
    }))
    .filter(({ hour }) => [8, 9, 10, 18, 19].includes(hour))
    .filter(({ date }) => {
      const target = new Date();
      target.setHours(0, 0, 0, 0);
      target.setDate(target.getDate() + dayOffset);

      const targetDate = target.toISOString().slice(0, 10);

      return date === targetDate;
    });
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
      title: "Brak danych",
      icon: "❓",
      description: "Nie udało się pobrać prognozy.",
    };
  }

  const averageRain = rainValues.reduce((a, b) => a + b, 0) / rainValues.length;

  const minRain = Math.min(...rainValues);
  const maxRain = Math.max(...rainValues);
  const spread = maxRain - minRain;

  let title;
  let icon;

  if (averageRain < 20) {
    title = "raczej sucho";
    icon = "☀️";
  } else if (averageRain < 50) {
    title = "możliwy deszcz";
    icon = "🌦️";
  } else {
    title = "duże ryzyko deszczu";
    icon = "🌧️";
  }

  let description;

  if (spread <= 15) {
    description = "Modele są bardzo zgodne.";
  } else if (spread <= 30) {
    description = "Modele są umiarkowanie zgodne.";
  } else {
    description = "Modele różnią się w opadach.";
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
            Ten przedział czasowy już minął.
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

      <div className="legend">🌡 temp. · 💧 opady · 💨 km/h</div>
    </section>
  );
}

function App() {
  const getInitialDay = () => {
    const hour = new Date().getHours();

    return hour >= 19 ? 1 : 0;
  };

  const [selectedDay, setSelectedDay] = useState(getInitialDay);

  const [models, setModels] = useState(
    MODELS.map((model) => ({
      ...model,
      data: null,
      loading: false,
      error: false,
    })),
  );

  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchWeather = async () => {
    setModels((current) =>
      current.map((model) => ({
        ...model,
        loading: false,
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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWeather();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

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
            <div className="location">Pogoda ‧ {LOCATION.name}</div>

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
            DZIŚ
          </button>

          <button
            className={selectedDay === 1 ? "active" : ""}
            onClick={() => setSelectedDay(1)}
          >
            JUTRO
          </button>
        </div>

        <section className="quick-summary">
          <div className="summary-card">
            <div className="summary-icon">{morningAssessment.icon}</div>

            <div>
              <div className="summary-period">08:00–10:00</div>

              <div className="summary-title">
                RANO: {morningAssessment.title}
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon">{eveningAssessment.icon}</div>

            <div>
              <div className="summary-period">18:00–19:00</div>

              <div className="summary-title">
                WIECZOREM: {eveningAssessment.title}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="loading">Pobieranie prognozy…</div>
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
          <div className="models-title">MODELE</div>

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
              {lastUpdate.toLocaleTimeString("pl-PL", {
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
