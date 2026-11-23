// Bountiful, UT (84010) coordinates
const LAT = 40.8894;
const LON = -111.8808;


// Persisted Config
const config = {


  absUrl: (localStorage.getItem("cfg_abs_url") || "").replace(/\/$/, ""),
  absToken: localStorage.getItem("cfg_abs_token") || "",
  spotifyClientId: localStorage.getItem("cfg_spotify_id") || "",
  nightStart: localStorage.getItem("cfg_night_start") || "22:00",
  nightEnd: localStorage.getItem("cfg_night_end") || "06:30"
};


// Runtime State
let alarmTime = localStorage.getItem("bedside_alarm") || null;
let alarmTriggeredMinute = null;
let alarmAudioInterval = null;
let dimTimeout = null;
let manualNightOverride = null;
let quoteIndex = new Date().getDate() % QUOTES.length;
let currentWeatherSummary = "Weather data is still loading.";


// Audiobookshelf State
let absCurrentItem = null;
let absSessionId = null;
const absAudio = document.getElementById("abs-audio-player");


// DOM Elements
const clockTimeEl = document.getElementById("clock-time");
const clockAmPmEl = document.getElementById("clock-ampm");
const clockDateEl = document.getElementById("clock-date");
const alarmDisplayEl = document.getElementById("alarm-display");
const modeDisplayEl = document.getElementById("mode-display");


// ==========================================
// 1. CLOCK, ALARM & AUTO NIGHT SCHEDULE
// ==========================================
function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";


  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, "0");


  clockTimeEl.textContent = `${displayHours}:${displayMinutes}`;
  clockAmPmEl.textContent = ampm;


  clockDateEl.textContent = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });


  const current24 = `${String(hours).padStart(2, "0")}:${displayMinutes}`;


  // Check Alarm
  if (alarmTime && current24 === alarmTime && alarmTriggeredMinute !== current24) {
    alarmTriggeredMinute = current24;
    triggerAlarm(displayHours, displayMinutes, ampm);
  }


  // Auto Night Mode Check (if not manually overridden this session)
  if (manualNightOverride === null) {
    const shouldBeNight = isTimeInNightWindow(current24, config.nightStart, config.nightEnd);
    const isCurrentlyNight = document.body.classList.contains("night-mode");
    if (shouldBeNight !== isCurrentlyNight) {
      setNightMode(shouldBeNight);
    }
  }
}


function isTimeInNightWindow(nowStr, startStr, endStr) {
  if (!startStr || !endStr) return false;
  if (startStr <= endStr) {
    return nowStr >= startStr && nowStr < endStr;
  }
  return nowStr >= startStr || nowStr < endStr;
}


function formatAlarmDisplay(time24) {
  if (!time24) return "Off";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}


function renderAlarmState() {
  alarmDisplayEl.textContent = formatAlarmDisplay(alarmTime);
}


function playAlarmBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch (e) {
    console.warn("Audio autoplay blocked until user gesture:", e);
  }
}


function triggerAlarm(h, m, ampm) {
  document.body.classList.remove("dimmed");
  document.getElementById("ringing-time").textContent = `${h}:${m} ${ampm}`;
  document.getElementById("alarm-ringing").classList.remove("hidden");
  playAlarmBeep();
  alarmAudioInterval = setInterval(playAlarmBeep, 1200);
}


function stopAlarmSound() {
  clearInterval(alarmAudioInterval);
  alarmAudioInterval = null;
  document.getElementById("alarm-ringing").classList.add("hidden");
}


document.getElementById("alarm-btn").addEventListener("click", () => {
  if (alarmTime) document.getElementById("alarm-time-input").value = alarmTime;
  document.getElementById("alarm-modal").classList.remove("hidden");
});


document.getElementById("alarm-cancel-btn").addEventListener("click", () => {
  document.getElementById("alarm-modal").classList.add("hidden");
});


document.getElementById("alarm-save-btn").addEventListener("click", () => {
  alarmTime = document.getElementById("alarm-time-input").value;
  alarmTriggeredMinute = null;
  localStorage.setItem("bedside_alarm", alarmTime);
  renderAlarmState();
  document.getElementById("alarm-modal").classList.add("hidden");
});


document.getElementById("alarm-off-btn").addEventListener("click", () => {
  alarmTime = null;
  localStorage.removeItem("bedside_alarm");
  renderAlarmState();
  document.getElementById("alarm-modal").classList.add("hidden");
});


document.getElementById("dismiss-btn").addEventListener("click", stopAlarmSound);


document.getElementById("snooze-btn").addEventListener("click", () => {
  stopAlarmSound();
  const now = new Date(Date.now() + 9 * 60000);
  alarmTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  alarmTriggeredMinute = null;
  renderAlarmState();
});


// ==========================================
// 2. NIGHT MODE & TOUCH-TO-BRIGHTEN
// ==========================================
function setNightMode(enabled) {
  if (enabled) {
    document.body.classList.remove("day-mode");
    document.body.classList.add("night-mode");
    modeDisplayEl.textContent = "Night Mode";
    scheduleDim();
  } else {
    document.body.classList.remove("night-mode", "dimmed");
    document.body.classList.add("day-mode");
    modeDisplayEl.textContent = "Day Mode";
    clearTimeout(dimTimeout);
  }
}


function scheduleDim() {
  clearTimeout(dimTimeout);
  document.body.classList.remove("dimmed");
  if (document.body.classList.contains("night-mode")) {
    dimTimeout = setTimeout(() => {
      document.body.classList.add("dimmed");
    }, 8000);
  }
}


document.getElementById("night-toggle-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const nextState = !document.body.classList.contains("night-mode");
  manualNightOverride = nextState;
  setNightMode(nextState);
});


document.addEventListener("pointerdown", () => {
  if (document.body.classList.contains("night-mode")) {
    scheduleDim();
  }
});


// ==========================================
// 3. WEATHER & SUNRISE/SUNSET (Bountiful, UT)
// ==========================================
const WEATHER_CODES = {
  0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Freezing Fog", 51: "Light Drizzle", 53: "Drizzle",
  61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
  71: "Light Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow Grains",
  80: "Rain Showers", 85: "Snow Showers", 95: "Thunderstorm"
};


async function fetchWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&timezone=America%2FDenver&forecast_days=4`;


  try {
    const res = await fetch(url);
    const data = await res.json();


    const currentTemp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const desc = WEATHER_CODES[code] || "Clear";
    const hiToday = Math.round(data.daily.temperature_2m_max[0]);
    const loToday = Math.round(data.daily.temperature_2m_min[0]);


    document.getElementById("weather-temp").textContent = `${currentTemp}°`;
    document.getElementById("weather-desc").textContent = desc;
    document.getElementById("weather-hi-lo").textContent = `H: ${hiToday}° · L: ${loToday}°`;


    currentWeatherSummary = `It is currently ${currentTemp} degrees and ${desc} in Bountiful, with a high of ${hiToday} and a low of ${loToday}.`;


    const now = new Date();
    document.getElementById("weather-updated").textContent =
      now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });


    const formatSun = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    document.getElementById("sunrise-time").textContent = formatSun(data.daily.sunrise[0]);
    document.getElementById("sunset-time").textContent = formatSun(data.daily.sunset[0]);


    const strip = document.getElementById("weather-forecast");
    strip.innerHTML = "";
    for (let i = 1; i <= 3; i++) {
      const dayDate = new Date(data.daily.time[i] + "T12:00:00");
      const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
      const hi = Math.round(data.daily.temperature_2m_max[i]);
      const lo = Math.round(data.daily.temperature_2m_min[i]);


      strip.innerHTML += `
        <div class="forecast-day">
          <div class="f-name">${dayName}</div>
          <div class="f-temps">${hi}° / ${lo}°</div>
        </div>
      `;
    }
  } catch (err) {
    document.getElementById("weather-desc").textContent = "Weather offline";
    console.error("Weather fetch failed:", err);
  }
}


// ==========================================
// 4. AUDIOBOOKSHELF INTEGRATION
// ==========================================
function formatSeconds(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}


async function fetchAudiobookshelf() {
  const statusEl = document.getElementById("abs-status");
  if (!config.absUrl || !config.absToken) {
    statusEl.textContent = "Not Setup";
    statusEl.className = "status-dot offline";
    return;
  }


  try {
    const res = await fetch(`${config.absUrl}/api/me/items-in-progress?limit=1`, {
      headers: { Authorization: `Bearer ${config.absToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();


    statusEl.textContent = "Connected";
    statusEl.className = "status-dot online";


    const item = data.libraryItems && data.libraryItems[0];
    if (!item) {
      document.getElementById("abs-title").textContent = "No active book";
      document.getElementById("abs-author").textContent = "Start a book in Audiobookshelf";
      return;
    }


    absCurrentItem = item;
    const meta = item.media.metadata || {};
    const prog = item.userMediaProgress || {};
    const pct = Math.round((prog.progress || 0) * 100);


    document.getElementById("abs-title").textContent = meta.title || "Untitled";
    document.getElementById("abs-author").textContent = meta.authorName || "Audiobook";
    document.getElementById("abs-progress").style.width = `${pct}%`;
    document.getElementById("abs-time-meta").textContent =
      `${formatSeconds(prog.currentTime)} / ${formatSeconds(prog.duration)} (${pct}%)`;
  } catch (err) {
    statusEl.textContent = "Offline";
    statusEl.className = "status-dot offline";
    console.error("ABS fetch failed:", err);
  }
}


async function toggleAbsPlayback() {
  if (!config.absUrl || !config.absToken || !absCurrentItem) return;
  const btn = document.getElementById("abs-play-btn");


  if (!absAudio.paused) {
    absAudio.pause();
    btn.textContent = "Play";
    syncAbsProgress();
    return;
  }


  if (!absAudio.src) {
    try {
      const res = await fetch(`${config.absUrl}/api/items/${absCurrentItem.id}/play`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.absToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          deviceInfo: { clientName: "BedsideDashboard", deviceId: "samsung-tab-a" },
          supportedMimeTypes: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg"]
        })
      });
      const session = await res.json();
      absSessionId = session.id;
      const track = session.audioTracks && session.audioTracks[0];
      if (track) {
        absAudio.src = `${config.absUrl}${track.contentUrl}?token=${config.absToken}`;
        absAudio.currentTime = session.currentTime || 0;
      }
    } catch (err) {
      console.error("Failed to start ABS session:", err);
      return;
    }
  }


  await absAudio.play();
  btn.textContent = "Pause";
}


async function syncAbsProgress() {
  if (!config.absUrl || !config.absToken || !absCurrentItem) return;
  try {
    await fetch(`${config.absUrl}/api/me/progress/${absCurrentItem.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.absToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ currentTime: absAudio.currentTime })
    });
  } catch (e) {
    console.warn("Progress sync failed:", e);
  }
}


absAudio.addEventListener("timeupdate", () => {
  if (!absAudio.duration) return;
  const pct = Math.min(100, (absAudio.currentTime / absAudio.duration) * 100);
  document.getElementById("abs-progress").style.width = `${pct.toFixed(1)}%`;
  document.getElementById("abs-time-meta").textContent =
    `${formatSeconds(absAudio.currentTime)} / ${formatSeconds(absAudio.duration)}`;
});


// ==========================================
// 5. SPOTIFY PKCE INTEGRATION
// ==========================================
const SPOTIFY_SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing";


function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}


async function startSpotifyLogin() {
  const clientId = document.getElementById("cfg-spotify-id").value.trim();
  if (!clientId) {
    alert("Enter your Spotify Client ID first.");
    return;
  }
  localStorage.setItem("cfg_spotify_id", clientId);


  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  const verifier = Array.from(array, (b) => ("0" + (b % 36).toString(36)).slice(-1)).join("");
  localStorage.setItem("spotify_verifier", verifier);


  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");


  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SPOTIFY_SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge
  });


  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}


async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code || !config.spotifyClientId) return;


  const verifier = localStorage.getItem("spotify_verifier");
  const body = new URLSearchParams({
    client_id: config.spotifyClientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier
  });


  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
    localStorage.setItem("spotify_expires_at", String(Date.now() + data.expires_in * 1000));
  }
  window.history.replaceState({}, document.title, getRedirectUri());
}


async function getValidSpotifyToken() {
  const token = localStorage.getItem("spotify_access_token");
  const refresh = localStorage.getItem("spotify_refresh_token");
  const expiresAt = parseInt(localStorage.getItem("spotify_expires_at") || "0", 10);


  if (token && Date.now() < expiresAt - 60000) return token;
  if (!refresh || !config.spotifyClientId) return null;


  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.spotifyClientId,
      grant_type: "refresh_token",
      refresh_token: refresh
    })
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
    localStorage.setItem("spotify_expires_at", String(Date.now() + data.expires_in * 1000));
    return data.access_token;
  }
  return null;
}


async function fetchSpotifyState() {
  const statusEl = document.getElementById("spotify-status");
  const token = await getValidSpotifyToken();
  if (!token) {
    statusEl.textContent = "Not Linked";
    statusEl.className = "status-dot offline";
    return;
  }


  try {
    const res = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${token}` }
    });


    statusEl.textContent = "Connected";
    statusEl.className = "status-dot online";


    if (res.status === 204) {
      document.getElementById("spotify-title").textContent = "Nothing Playing";
      document.getElementById("spotify-artist").textContent = "Open Spotify on any device";
      document.getElementById("spotify-device").textContent = "Idle";
      document.getElementById("spotify-play-btn").textContent = "Play";
      return;
    }


    const data = await res.json();
    if (data && data.item) {
      document.getElementById("spotify-title").textContent = data.item.name;
      document.getElementById("spotify-artist").textContent =
        data.item.artists.map((a) => a.name).join(", ");
      const pct = (data.progress_ms / data.item.duration_ms) * 100;
      document.getElementById("spotify-progress").style.width = `${pct.toFixed(1)}%`;
      document.getElementById("spotify-device").textContent =
        data.device ? `Playing on ${data.device.name}` : "Active";
      document.getElementById("spotify-play-btn").textContent = data.is_playing ? "Pause" : "Play";
    }
  } catch (err) {
    console.error("Spotify poll failed:", err);
  }
}


async function controlSpotify(action) {
  const token = await getValidSpotifyToken();
  if (!token) return;


  const isPlaying = document.getElementById("spotify-play-btn").textContent === "Pause";
  let method = "POST";
  let endpoint = "";


  if (action === "play") {
    method = "PUT";
    endpoint = isPlaying ? "pause" : "play";
  } else if (action === "next") {
    endpoint = "next";
  } else if (action === "prev") {
    endpoint = "previous";
  }


  await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}` }
  });
  setTimeout(fetchSpotifyState, 400);
}


// Media Button Dispatcher
document.querySelectorAll(".media-controls .ctrl-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const service = btn.dataset.service;
    const action = btn.dataset.action;


    if (service === "abs") {
      if (action === "play") toggleAbsPlayback();
      if (action === "back") { absAudio.currentTime = Math.max(0, absAudio.currentTime - 30); syncAbsProgress(); }
      if (action === "forward") { absAudio.currentTime += 30; syncAbsProgress(); }
    } else if (service === "spotify") {
      controlSpotify(action);
    }
  });
});


// ==========================================
// 6. VOICE COMMANDS (Web Speech API)
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;


function showVoiceToast(msg) {
  const toast = document.getElementById("voice-toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 3500);
}


function speakResponse(text) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.02;
  window.speechSynthesis.speak(utter);
}


function handleVoiceCommand(transcript) {
  const cmd = transcript.toLowerCase().trim();
  showVoiceToast(`"${transcript}"`);


  if (cmd.includes("night mode") || cmd.includes("go to sleep")) {
    manualNightOverride = true;
    setNightMode(true);
    speakResponse("Night mode enabled.");
  } else if (cmd.includes("day mode") || cmd.includes("wake up")) {
    manualNightOverride = false;
    setNightMode(false);
    speakResponse("Day mode enabled.");
  } else if (cmd.includes("turn off alarm") || cmd.includes("cancel alarm")) {
    alarmTime = null;
    localStorage.removeItem("bedside_alarm");
    renderAlarmState();
    speakResponse("Alarm turned off.");
  } else if (cmd.includes("set alarm")) {
    const match = cmd.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3] ? match[3].replace(/\./g, "") : null;
      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      alarmTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      alarmTriggeredMinute = null;
      localStorage.setItem("bedside_alarm", alarmTime);
      renderAlarmState();
      speakResponse(`Alarm set for ${formatAlarmDisplay(alarmTime)}.`);
    }
  } else if (cmd.includes("audiobook") || cmd.includes("book")) {
    toggleAbsPlayback();
  } else if (cmd.includes("next track") || cmd.includes("skip song")) {
    controlSpotify("next");
  } else if (cmd.includes("spotify") || cmd.includes("music")) {
    controlSpotify("play");
  } else if (cmd.includes("weather") || cmd.includes("temperature")) {
    speakResponse(currentWeatherSummary);
  } else {
    showVoiceToast(`Unrecognized: "${transcript}"`);
  }
}


if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;


  recognition.onstart = () => {
    document.getElementById("voice-btn").classList.add("listening");
    showVoiceToast("Listening...");
  };


  recognition.onend = () => {
    document.getElementById("voice-btn").classList.remove("listening");
  };


  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    handleVoiceCommand(text);
  };
}


document.getElementById("voice-btn").addEventListener("click", () => {
  if (!recognition) {
    alert("Speech recognition is not supported in this browser.");
    return;
  }
  try {
    recognition.start();
  } catch (e) {
    recognition.stop();
  }
});


// ==========================================
// 7. SETTINGS MODAL & QUOTES
// ==========================================
document.getElementById("settings-btn").addEventListener("click", () => {
  document.getElementById("cfg-abs-url").value = config.absUrl;
  document.getElementById("cfg-abs-token").value = config.absToken;
  document.getElementById("cfg-spotify-id").value = config.spotifyClientId;
  document.getElementById("cfg-night-start").value = config.nightStart;
  document.getElementById("cfg-night-end").value = config.nightEnd;
  document.getElementById("redirect-uri-hint").textContent = getRedirectUri();
  document.getElementById("settings-modal").classList.remove("hidden");
});


document.getElementById("settings-cancel-btn").addEventListener("click", () => {
  document.getElementById("settings-modal").classList.add("hidden");
});


document.getElementById("spotify-auth-btn").addEventListener("click", startSpotifyLogin);


document.getElementById("settings-save-btn").addEventListener("click", () => {
  config.absUrl = document.getElementById("cfg-abs-url").value.trim().replace(/\/$/, "");
  config.absToken = document.getElementById("cfg-abs-token").value.trim();
  config.spotifyClientId = document.getElementById("cfg-spotify-id").value.trim();
  config.nightStart = document.getElementById("cfg-night-start").value;
  config.nightEnd = document.getElementById("cfg-night-end").value;


  localStorage.setItem("cfg_abs_url", config.absUrl);
  localStorage.setItem("cfg_abs_token", config.absToken);
  localStorage.setItem("cfg_spotify_id", config.spotifyClientId);
  localStorage.setItem("cfg_night_start", config.nightStart);
  localStorage.setItem("cfg_night_end", config.nightEnd);


  manualNightOverride = null;
  document.getElementById("settings-modal").classList.add("hidden");
  fetchAudiobookshelf();
  fetchSpotifyState();
});


function renderQuote() {
  const q = QUOTES[quoteIndex % QUOTES.length];
  document.getElementById("quote-text").textContent = `"${q.text}"`;
  document.getElementById("quote-author").textContent = `— ${q.author}`;
}


document.getElementById("quote-card").addEventListener("click", () => {
  quoteIndex++;
  renderQuote();
});


// ==========================================
// 8. INITIALIZATION & POLLING LOOPS
// ==========================================
(async function init() {
  renderAlarmState();
  renderQuote();
  updateClock();
  fetchWeather();


  await handleSpotifyCallback();
  fetchAudiobookshelf();
  fetchSpotifyState();


  setInterval(updateClock, 1000);
  setInterval(fetchWeather, 15 * 60 * 1000);
  setInterval(fetchAudiobookshelf, 60 * 1000);
  setInterval(fetchSpotifyState, 5000);
  setInterval(() => {
    if (!absAudio.paused) syncAbsProgress();
  }, 15000);
})();
