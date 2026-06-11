import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const MODES = {
  rain: {
    id: "rain",
    label: "RAIN ROOM",
    kanji: "雨",
    palette: ["#071421", "#102a42", "#1f5272", "#8cb6c8", "#dbe7df"],
    ambience: "blue window noise",
  },
  wind: {
    id: "wind",
    label: "WIND STATIC",
    kanji: "風",
    palette: ["#0b1218", "#202b30", "#6d7d7e", "#b2c1b3", "#f0b85a"],
    ambience: "camera shake hiss",
  },
  fog: {
    id: "fog",
    label: "FOG MEMORY",
    kanji: "霧",
    palette: ["#11151b", "#242b33", "#56606a", "#aeb9b2", "#e8eadf"],
    ambience: "soft ghost pulse",
  },
  clear: {
    id: "clear",
    label: "LATE GLOW",
    kanji: "光",
    palette: ["#10131f", "#27304a", "#586e87", "#dab86f", "#efe5bf"],
    ambience: "quiet square wave",
  },
};

const modeList = Object.values(MODES);
const DEFAULT_PLACE = {
  name: "Shanghai",
  country: "China",
  latitude: 31.2304,
  longitude: 121.4737,
  source: "fallback",
};

function classifyWeather(code, windSpeed) {
  if (windSpeed >= 28) return "wind";
  if ([45, 48, 51, 53, 55, 56, 57].includes(code)) return "fog";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  if (code === 0 || code === 1) return "clear";
  return "fog";
}

async function getPosition() {
  if (!("geolocation" in navigator)) {
    return DEFAULT_PLACE;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "device",
        }),
      () => resolve(DEFAULT_PLACE),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 900000 },
    );
  });
}

async function fetchWeatherMode(place) {
  const position = place || (await getPosition());
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", position.latitude);
  url.searchParams.set("longitude", position.longitude);
  url.searchParams.set("current", "weather_code,wind_speed_10m");
  url.searchParams.set("timezone", "auto");

  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error("weather fetch failed");
  const data = await response.json();
  const current = data.current || {};
  return {
    mode: classifyWeather(current.weather_code, current.wind_speed_10m || 0),
    source: position.source,
    place: position.name ? position : null,
  };
}

async function fetchWithRetry(url, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(url, { signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await new Promise((resolve) => window.setTimeout(resolve, 600));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError;
}

function formatPlace(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

async function searchPlaces(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) throw new Error("city search failed");
  const data = await response.json();
  return (data.results || []).map((place) => ({
    id: place.id,
    name: place.name,
    admin1: place.admin1,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    source: "city",
  }));
}

function CanvasStage({ mode, soundOn }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    const pixel = 4;
    let frame = 0;
    let raf = 0;
    let rain = Array.from({ length: 70 }, (_, i) => ({
      x: (i * 29) % 320,
      y: (i * 41) % 180,
      speed: 2 + (i % 4),
    }));
    let motes = Array.from({ length: 36 }, (_, i) => ({
      x: (i * 53) % 320,
      y: (i * 31) % 180,
      drift: 0.25 + (i % 5) * 0.06,
    }));

    const drawRect = (x, y, w, h, color) => {
      context.fillStyle = color;
      context.fillRect(Math.round(x) * pixel, Math.round(y) * pixel, Math.round(w) * pixel, Math.round(h) * pixel);
    };

    const dither = (palette, intensity = 1) => {
      for (let y = 0; y < 180; y += 2) {
        for (let x = 0; x < 320; x += 2) {
          const n = (x * 13 + y * 7 + frame * 3) % 37;
          if (n < 3 * intensity) drawRect(x, y, 1, 1, palette[2]);
          if (n === 15) drawRect(x, y, 1, 1, palette[0]);
        }
      }
    };

    const drawPerson = (palette, windOffset) => {
      drawRect(151 + windOffset, 99, 8, 8, palette[4]);
      drawRect(149 + windOffset, 108, 12, 20, palette[3]);
      drawRect(145 + windOffset, 113, 4, 14, palette[2]);
      drawRect(161 + windOffset, 113, 4, 14, palette[2]);
      drawRect(151 + windOffset, 128, 4, 15, palette[1]);
      drawRect(157 + windOffset, 128, 4, 15, palette[1]);
      drawRect(153 + windOffset, 103, 1, 1, palette[0]);
      drawRect(158 + windOffset, 103, 1, 1, palette[0]);
    };

    const drawWindow = (palette, shake) => {
      drawRect(78 + shake, 30, 166, 104, palette[1]);
      drawRect(84 + shake, 36, 154, 92, palette[0]);
      drawRect(158 + shake, 36, 4, 92, palette[2]);
      drawRect(84 + shake, 81, 154, 4, palette[2]);
      drawRect(76 + shake, 132, 172, 7, palette[3]);
      drawRect(64 + shake, 139, 196, 9, palette[1]);
    };

    const render = () => {
      const palette = MODES[mode].palette;
      const shake = mode === "wind" ? Math.round(Math.sin(frame * 0.55) * 2 + Math.cos(frame * 0.23)) : 0;
      const windOffset = mode === "wind" ? Math.round(Math.sin(frame * 0.34) * 2) : 0;

      context.clearRect(0, 0, canvas.width, canvas.height);
      drawRect(0, 0, 320, 180, palette[0]);
      drawRect(0, 122, 320, 58, palette[1]);
      drawWindow(palette, shake);

      if (mode === "rain") {
        rain.forEach((drop) => {
          drop.y += drop.speed;
          if (drop.y > 128) {
            drop.y = 34;
            drop.x = (drop.x + 71) % 152 + 84;
          }
          drawRect(drop.x + shake, drop.y, 1, 8, palette[3]);
          if ((frame + drop.x) % 17 === 0) drawRect(drop.x + 2 + shake, 126, 3, 1, palette[4]);
        });
      }

      if (mode === "wind") {
        for (let i = 0; i < 18; i += 1) {
          const y = 42 + ((i * 11 + frame * (2 + (i % 3))) % 86);
          const x = 86 + ((frame * 5 + i * 23) % 142);
          drawRect(x + shake, y, 12 + (i % 4) * 6, 1, palette[3]);
        }
        for (let y = 0; y < 180; y += 11) {
          const x = (frame * 7 + y * 3) % 320;
          drawRect(x, y, 18, 1, palette[2]);
        }
      }

      if (mode === "fog") {
        motes.forEach((mote) => {
          mote.x += mote.drift;
          if (mote.x > 238) mote.x = 84;
          drawRect(mote.x + shake, mote.y % 118, 9, 2, palette[2]);
        });
        drawRect(84, 92 + Math.sin(frame * 0.04) * 5, 154, 12, palette[2]);
      }

      if (mode === "clear") {
        const pulse = Math.sin(frame * 0.04) * 4;
        drawRect(197 + pulse, 48, 18, 18, palette[3]);
        drawRect(202 + pulse, 53, 8, 8, palette[4]);
        for (let i = 0; i < 16; i += 1) {
          drawRect(90 + i * 9, 42 + ((i * 19) % 72), 1, 1, palette[4]);
        }
      }

      drawPerson(palette, windOffset);
      dither(palette, mode === "wind" ? 2 : 1);

      context.fillStyle = palette[4];
      context.font = "8px monospace";
      context.fillText(MODES[mode].kanji, 20 * pixel, 20 * pixel);
      frame += 1;
      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  useEffect(() => {
    if (!soundOn) {
      audioRef.current?.stop();
      audioRef.current = null;
      return;
    }

    const audio = createAmbience(mode);
    audioRef.current = audio;
    return () => {
      audio.stop();
      audioRef.current = null;
    };
  }, [mode, soundOn]);

  return <canvas ref={canvasRef} className="weather-canvas" width="1280" height="720" aria-label="像素天气动画场景" />;
}

function createAmbience(mode) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();
  const master = audioContext.createGain();
  master.gain.value = mode === "wind" ? 0.065 : 0.05;
  master.connect(audioContext.destination);

  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * 2, sampleRate);
  const channel = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = mode === "rain" ? last * 0.62 + white * 0.38 : last * 0.88 + white * 0.12;
    channel[i] = last * (mode === "wind" ? 0.7 : 0.5);
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = audioContext.createBiquadFilter();
  filter.type = mode === "wind" ? "bandpass" : "lowpass";
  filter.frequency.value = mode === "wind" ? 620 : 1180;
  noise.connect(filter).connect(master);
  noise.start();

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "square";
  osc.frequency.value = mode === "clear" ? 164 : mode === "fog" ? 82 : 55;
  gain.gain.value = mode === "rain" ? 0.006 : 0.012;
  osc.connect(gain).connect(master);
  osc.start();

  return {
    stop() {
      noise.stop();
      osc.stop();
      audioContext.close();
    },
  };
}

function App() {
  const [mode, setMode] = useState("rain");
  const [soundOn, setSoundOn] = useState(false);
  const [status, setStatus] = useState("LIVE SKY");
  const [placeName, setPlaceName] = useState("DEVICE SKY");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const selected = MODES[mode];

  useEffect(() => {
    let alive = true;
    setIsLoadingWeather(true);
    fetchWeatherMode()
      .then((result) => {
        if (!alive) return;
        setMode(result.mode);
        setPlaceName(result.source === "device" ? "DEVICE SKY" : formatPlace(DEFAULT_PLACE));
        setStatus("LIVE SKY");
      })
      .catch(() => {
        if (alive) setStatus("OFFLINE SKY");
      })
      .finally(() => {
        if (alive) setIsLoadingWeather(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .catch(() => {});
    }
  }, []);

  const paletteStyle = useMemo(
    () => ({
      "--tone-0": selected.palette[0],
      "--tone-1": selected.palette[1],
      "--tone-2": selected.palette[2],
      "--tone-3": selected.palette[3],
      "--tone-4": selected.palette[4],
    }),
    [selected],
  );

  const handleCitySearch = async (event) => {
    event.preventDefault();
    const query = cityQuery.trim();
    if (!query) return;
    setIsSearching(true);
    setStatus("TUNING SKY");
    try {
      const places = await searchPlaces(query);
      setCityResults(places);
      setStatus(places.length ? "CHOOSE CITY" : "NO CITY SIGNAL");
    } catch {
      setCityResults([]);
      setStatus("OFFLINE SKY");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlaceSelect = async (place) => {
    setIsLoadingWeather(true);
    setStatus("LIVE SKY");
    setPlaceName(formatPlace(place));
    setCityResults([]);
    try {
      const result = await fetchWeatherMode(place);
      setMode(result.mode);
    } catch {
      setStatus("OFFLINE SKY");
    } finally {
      setIsLoadingWeather(false);
    }
  };

  return (
    <main className={`app mode-${mode}`} style={paletteStyle}>
      <section className="console" aria-label="像素天气体验">
        <header className="topbar">
          <div>
            <h1>像素天气</h1>
            <p>{selected.ambience}</p>
          </div>
          <div className="live-chip">
            <span />
            {isLoadingWeather ? "TUNING SKY" : status}
          </div>
        </header>

        <div className="device">
          <div className="brand-row">
            <span>PIXEL WEATHER</span>
            <span>GBC-LOFI</span>
          </div>
          <div className="screen">
            <CanvasStage mode={mode} soundOn={soundOn} />
            <div className="scanlines" />
            <div className="screen-label">{selected.label}</div>
          </div>
          <div className="controls">
            <button className={`sound-button ${soundOn ? "active" : ""}`} onClick={() => setSoundOn((value) => !value)}>
              <span className="speaker" />
              SOUND
            </button>
            <span className="no-numbers">NO NUMBERS</span>
            <div className="dpad" aria-hidden="true">
              <span />
            </div>
          </div>
        </div>
      </section>

      <aside className="side-panel" aria-label="天气控制">
        <form className="city-panel" onSubmit={handleCitySearch}>
          <label htmlFor="city-search">CITY SIGNAL</label>
          <div className="city-input-row">
            <input
              id="city-search"
              value={cityQuery}
              onChange={(event) => setCityQuery(event.target.value)}
              placeholder="Tokyo / Paris / 上海"
              autoComplete="off"
            />
            <button type="submit" disabled={isSearching}>
              {isSearching ? "..." : "SCAN"}
            </button>
          </div>
          <div className="place-readout">{placeName}</div>
          {cityResults.length > 0 && (
            <div className="city-results" aria-label="城市候选">
              {cityResults.map((place) => (
                <button type="button" key={place.id} onClick={() => handlePlaceSelect(place)}>
                  {formatPlace(place)}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="mode-rail" aria-label="氛围模式">
          {modeList.map((item) => (
            <button
              className={`mode-card ${mode === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => setMode(item.id)}
              style={{ "--card-accent": item.palette[3], "--card-bg": item.palette[1] }}
            >
              <span className="mode-glyph">{item.kanji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
