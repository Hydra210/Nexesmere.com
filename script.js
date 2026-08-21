const DISCORD_ID = "728856632288608336";

if (window.matchMedia("(pointer: fine)").matches) {
  const cursorEl = document.createElement("div");
  cursorEl.className = "custom-cursor";
  cursorEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(cursorEl);

  window.addEventListener("mousemove", (e) => {
    cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  });

  const CURSOR_CLICKABLE = "a, button, input, select, textarea, label, [role='button'], [onclick], .social-btn, .entry-gate";

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(CURSOR_CLICKABLE)) cursorEl.classList.add("is-hover");
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(CURSOR_CLICKABLE)) cursorEl.classList.remove("is-hover");
  });
}

document.querySelectorAll(".js-dnd-icon").forEach(el => {
  el.addEventListener("error", () => {
    el.hidden = true;
    el.dataset.broken = "1";
    console.warn("missing icon:", el.getAttribute("src"));
  });
});

document.querySelectorAll(".js-social-icon").forEach(el => {
  el.addEventListener("error", () => {
    el.closest(".social-btn").style.display = "none";
    console.warn("missing icon:", el.getAttribute("src"));
  });
});

const MY_TIMEZONE = "America/New_York";

function tickMyTime(){
  const el = document.getElementById("myTimeValue");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString("en-US", {
    timeZone: MY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
setInterval(tickMyTime, 1000);
tickMyTime();

let heartbeatInterval = null;

function connectLanyard(){
  const ws = new WebSocket("wss://api.lanyard.rest/socket");

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch(msg.op){
      case 1: {
        const interval = msg.d.heartbeat_interval;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
          ws.send(JSON.stringify({ op: 3 }));
        }, interval);

        ws.send(JSON.stringify({
          op: 2,
          d: { subscribe_to_id: DISCORD_ID }
        }));
        break;
      }
      case 0: {
        if (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE") {
          renderPresence(msg.d);
        }
        break;
      }
    }
  };

  ws.onclose = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    setTimeout(connectLanyard, 3000); // reconnect
  };

  ws.onerror = () => ws.close();
}

function renderPresence(data){
  lastPresenceData = data;

  const user = data.discord_user;
  const displayNameEl = document.getElementById("displayName");
  const usernameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");
  const decoEl = document.getElementById("decoRing");
  const statusDot = document.getElementById("statusDot");
  const dndIcon = document.getElementById("dndIcon");
  const statusText = document.getElementById("statusText");
  const feed = document.getElementById("activityFeed");

  displayNameEl.textContent = user.global_name || user.username || "unknown";
  usernameEl.textContent = "@" + (user.username || "unknown");

  const ext = user.avatar && user.avatar.startsWith("a_") ? "gif" : "png";
  avatarEl.src = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  if (user.avatar_decoration_data && user.avatar_decoration_data.asset) {
    decoEl.src = `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png`;
    decoEl.hidden = false;
  } else {
    decoEl.hidden = true;
  }

  statusDot.dataset.status = data.discord_status || "offline";

  const showDndIcon = data.discord_status === "dnd" && dndIcon.dataset.broken !== "1";
  dndIcon.hidden = !showDndIcon;
  statusDot.style.visibility = showDndIcon ? "hidden" : "visible";

  const customStatus = (data.activities || []).find(a => a.type === 4);
  statusText.textContent = customStatus && customStatus.state
    ? customStatus.state
    : (data.discord_status || "offline").toUpperCase();

  feed.innerHTML = "";

  if (data.listening_to_spotify && data.spotify) {
    feed.appendChild(buildRow("NOW PLAYING", `${data.spotify.song} — ${data.spotify.artist}`));
  }

  const otherActivities = (data.activities || []).filter(a => a.type !== 4 && a.type !== 2);
  if (otherActivities.length === 0 && !data.listening_to_spotify) {
    feed.appendChild(buildRow("STATUS", "not doing much right now"));
  }

  otherActivities.forEach(a => {
    const labels = { 0: "PLAYING", 1: "STREAMING", 3: "WATCHING", 5: "COMPETING" };
    const label = labels[a.type] || "ACTIVITY";
    const detail = a.details ? `${a.name} — ${a.details}` : a.name;
    feed.appendChild(buildRow(label, detail));
  });

  if (openPreviewPlatform === "discord") renderDiscordPreview();
}

function buildRow(eyebrow, detail){
  const row = document.createElement("div");
  row.className = "activity-row";
  const e = document.createElement("span");
  e.className = "activity-eyebrow";
  e.textContent = eyebrow;
  const d = document.createElement("span");
  d.className = "activity-detail";
  d.textContent = detail;
  row.appendChild(e);
  row.appendChild(d);
  return row;
}

let lastPresenceData = null;
let openPreviewPlatform = null; 

connectLanyard();

const PROFILE_DATA = {
  instagram: {
    pfp: "icons/preview-instagram.jpg",
    username: "pat2769_",
    displayName: "PAT😝",
    posts: 38,
    bio: "----------------------\n┆　┆　┆　┆　┆\n┆　┆  ࣪ ˖☆ ࣪⭑┆ ݁˖ .☆ . ݁ ˖ \n☆⊹ ࣪ ┆ ˖ ࣪　⊹ ࣪ ★ ⋆.˚  ⊹ ࣪\n   ࣪ ˖⋆˚★ ₊ ⊹　  ࣪˖ ࣪ ₊  ࣪ ˖　\n. ݁　⊹ ࣪ ˖　　　 ࣪ ˖",
    url: "https://www.instagram.com/pat2769_/"
  }
};

const ROBLOX_USER_ID = "1230783705";
const ROBLOX_PROFILE_URL = "https://www.roblox.com/users/1230783705/profile";
let robloxProfileCache = null;
const PLACEHOLDER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' fill='%23232320'/%3E%3Ccircle cx='24' cy='19' r='9' fill='%237a7a76'/%3E%3Cellipse cx='24' cy='42' rx='16' ry='11' fill='%237a7a76'/%3E%3C/svg%3E";

const previewPanel = document.getElementById("socialPreviewPanel");
const previewAvatar = document.getElementById("previewAvatar");
const previewDisplayName = document.getElementById("previewDisplayName");
const previewUsername = document.getElementById("previewUsername");
const previewStats = document.getElementById("previewStats");
const previewBio = document.getElementById("previewBio");
const previewVisitBtn = document.getElementById("previewVisitBtn");

previewAvatar.addEventListener("error", () => { previewAvatar.src = PLACEHOLDER_AVATAR; });

function buildPreviewStat(label, value){
  const wrap = document.createElement("div");
  wrap.className = "preview-stat";
  const l = document.createElement("span");
  l.className = "preview-stat-label";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "preview-stat-value";
  v.textContent = value;
  wrap.appendChild(l);
  wrap.appendChild(v);
  return wrap;
}

function renderDiscordPreview(){
  if (!lastPresenceData) {
    previewAvatar.src = PLACEHOLDER_AVATAR;
    previewDisplayName.textContent = "loading...";
    previewUsername.textContent = "";
    previewStats.innerHTML = "";
    previewBio.textContent = "";
    return;
  }

  const user = lastPresenceData.discord_user;
  const ext = user.avatar && user.avatar.startsWith("a_") ? "gif" : "png";
  previewAvatar.src = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  previewDisplayName.textContent = user.global_name || user.username || "unknown";
  previewUsername.textContent = "@" + (user.username || "unknown");

  previewStats.innerHTML = "";
  previewStats.appendChild(buildPreviewStat("Status", (lastPresenceData.discord_status || "offline").toUpperCase()));

  const platforms = [];
  if (lastPresenceData.active_on_discord_desktop) platforms.push("Desktop");
  if (lastPresenceData.active_on_discord_mobile) platforms.push("Mobile");
  if (lastPresenceData.active_on_discord_web) platforms.push("Web");
  previewStats.appendChild(buildPreviewStat("Visibility", platforms.length ? platforms.join(", ") : "Offline"));

  previewBio.textContent = (lastPresenceData.kv && lastPresenceData.kv.bio) || `https://guns.lol/patrick2769

https://exedevelopement.com/sentinel/

CDE is my best friend

Full-Stack Web Developer Python/FastAPI, JavaScript.
Roblox Dev

working @ [ ERROR ]`;

  previewVisitBtn.href = "http://discord.com/users/728856632288608336";
}

function renderInstagramPreview(){
  const d = PROFILE_DATA.instagram;
  previewAvatar.src = d.pfp;
  previewDisplayName.textContent = d.displayName;
  previewUsername.textContent = "@" + d.username;
  previewStats.innerHTML = "";
  previewStats.appendChild(buildPreviewStat("Posts", d.posts));
  previewBio.textContent = d.bio;
  previewVisitBtn.href = d.url;
}

function applyRobloxData(data){
  previewAvatar.src = data.pfp || PLACEHOLDER_AVATAR;
  previewDisplayName.textContent = data.displayName || data.username || "unknown";
  previewUsername.textContent = "@" + (data.username || "unknown");
  previewStats.innerHTML = "";
  previewBio.textContent = data.bio || "no bio set";
  previewVisitBtn.href = ROBLOX_PROFILE_URL;
}

async function renderRobloxPreview(){
  if (robloxProfileCache) {
    applyRobloxData(robloxProfileCache);
    return;
  }

  previewAvatar.src = PLACEHOLDER_AVATAR;
  previewDisplayName.textContent = "loading...";
  previewUsername.textContent = "";
  previewStats.innerHTML = "";
  previewBio.textContent = "";
  previewVisitBtn.href = ROBLOX_PROFILE_URL;

  try {
    const res = await fetch(`/api/roblox/${ROBLOX_USER_ID}`);
    if (!res.ok) throw new Error(`bad response: ${res.status}`);
    const data = await res.json();
    robloxProfileCache = data;
    applyRobloxData(data);
  } catch (err) {
    console.warn("roblox preview fetch failed:", err);
    previewDisplayName.textContent = "couldn't load";
    previewBio.textContent = "roblox lookup failed. try again in a bit";
  }
}

function renderSocialPreview(platform){
  if (platform === "discord") {
    renderDiscordPreview();
  } else if (platform === "roblox") {
    renderRobloxPreview();
  } else {
    renderInstagramPreview();
  }
}

function closeSocialPreview(){
  previewPanel.classList.remove("is-open");
  document.querySelectorAll(".js-preview-trigger").forEach(btn => {
    btn.classList.remove("is-active");
    btn.setAttribute("aria-expanded", "false");
  });
  openPreviewPlatform = null;
}

function openSocialPreview(platform, btn){
  document.querySelectorAll(".js-preview-trigger").forEach(b => {
    b.classList.remove("is-active");
    b.setAttribute("aria-expanded", "false");
  });
  btn.classList.add("is-active");
  btn.setAttribute("aria-expanded", "true");
  renderSocialPreview(platform);
  previewPanel.classList.add("is-open");
  openPreviewPlatform = platform;
}

document.querySelectorAll(".js-preview-trigger").forEach(btn => {
  btn.addEventListener("click", () => {
    const platform = btn.dataset.platform;
    if (openPreviewPlatform === platform) {
      closeSocialPreview();
    } else {
      openSocialPreview(platform, btn);
    }
  });
});

const audioEl = document.getElementById("bgAudio");
const bgVideo = document.getElementById("bgVideo");
const entryGate = document.getElementById("entryGate");
const mainCard = document.getElementById("mainCard");
const nameParticles = document.getElementById("nameParticles");

let audioReady = false;
let mediaEl = audioEl;

// The second crossfade layer (a whole extra <video> + <audio> pair) used to
// exist in the DOM at all times, even with a single-track playlist, which
// permanently doubled decoded-video / GPU-layer memory for no reason. Now
// it's only created lazily, the moment a second track actually needs it.
let bgVideo2 = null;
let audioEl2 = null;

const layers = [{ video: bgVideo, audio: audioEl }, null];

function attachMediaListeners(el){
  el.addEventListener("timeupdate", handleTimeUpdate);
  el.addEventListener("ended", handleEnded);
  el.addEventListener("stalled", () => { if (el === activeEl) el.load(); });
}

function ensureSecondLayer(){
  if (layers[1]) return;

  bgVideo2 = document.createElement("video");
  bgVideo2.id = "bgVideo2";
  bgVideo2.className = "bg-video";
  bgVideo2.muted = true;
  bgVideo2.playsInline = true;
  bgVideo2.preload = "auto";
  bgVideo.insertAdjacentElement("afterend", bgVideo2);

  audioEl2 = document.createElement("audio");
  audioEl2.id = "bgAudio2";
  audioEl2.preload = "auto";
  document.body.appendChild(audioEl2);

  layers[1] = { video: bgVideo2, audio: audioEl2 };
  attachMediaListeners(bgVideo2);
  attachMediaListeners(audioEl2);
}

let activeLayerIndex = 0;
let activeEl = null;
let crossfadeTriggered = false;
let crossfadeStuckSince = 0;
const CROSSFADE_MS = 1200;

async function buildPlaylist(){
  if (typeof TRACKS === "undefined" || !Array.isArray(TRACKS)) {
    console.warn("TRACKS table not found. make sure tracks.js is loaded before script.js");
    return [];
  }
  return TRACKS.map(t => ({ type: t.type, url: t.url, blobUrl: null }));
}

let playlist = [];
let currentTrackIndex = 0;

async function preloadTrack(track){
  if (track.type === "video") return track.url;

  if (track.blobUrl) return track.blobUrl;
  try {
    const res = await fetch(track.url);
    const blob = await res.blob();
    track.blobUrl = URL.createObjectURL(blob);
  } catch (err) {
    console.warn("blob preload failed for", track.url, "Falling back to streamed src:", err);
  }
  return track.blobUrl || track.url;
}

function prefetchRest(fromIndex){
  for (let i = 0; i < playlist.length; i++){
    if (i === fromIndex) continue;
    preloadTrack(playlist[i]);
  }
}

function timeoutPromise(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureRealDuration(el){
  if (isFinite(el.duration) && el.duration > 0) return;

  if (el.readyState === 0) {

    await Promise.race([
      new Promise(resolve => {
        el.addEventListener("loadedmetadata", resolve, { once: true });
        el.load();
      }),
      timeoutPromise(4000)
    ]);
  }

  if (isFinite(el.duration) && el.duration > 0) return;

  await Promise.race([
    new Promise(resolve => {
      const onUpdate = () => {
        el.removeEventListener("timeupdate", onUpdate);
        el.currentTime = 0;
        resolve();
      };
      el.addEventListener("timeupdate", onUpdate, { once: true });
      try {
        el.currentTime = 1e101;
      } catch {
        el.removeEventListener("timeupdate", onUpdate);
        resolve();
      }
    }),
    timeoutPromise(4000)
  ]);
}

function clamp01(v){
  return Math.max(0, Math.min(1, v));
}

async function playSingleTrackLoop(track){
  const isVideo = track.type === "video";
  const target = isVideo ? bgVideo : audioEl;
  const other = isVideo ? audioEl : bgVideo;

  other.pause();
  if (other.tagName === "VIDEO") other.style.opacity = 0;

  const src = await preloadTrack(track);
  target.src = src;
  target.currentTime = 0;
  target.muted = false;
  target.volume = 0.5;
  target.loop = true;
  await ensureRealDuration(target);
  if (target.tagName === "VIDEO") target.style.opacity = 1;

  activeEl = target;
  activeLayerIndex = 0;
  mediaEl = target;
  crossfadeTriggered = false;
  target.play().catch(() => {});
}

async function crossfadeToTrack(i){
  const track = playlist[i];
  if (!track) return;

  if (playlist.length === 1) {
    return playSingleTrackLoop(track);
  }

  ensureSecondLayer();

  const prevEl = activeEl;
  const newLayerIndex = 1 - activeLayerIndex;
  const newLayer = layers[newLayerIndex];
  const isVideo = track.type === "video";
  const newEl = isVideo ? newLayer.video : newLayer.audio;
  const newOtherEl = isVideo ? newLayer.audio : newLayer.video;

  newOtherEl.pause();
  if (newOtherEl.tagName === "VIDEO") newOtherEl.style.opacity = 0;

  const src = await preloadTrack(track);
  newEl.src = src;
  newEl.currentTime = 0;
  newEl.muted = false;
  newEl.loop = false;
  newEl.volume = prevEl ? 0 : 0.5;
  await ensureRealDuration(newEl);
  if (newEl.tagName === "VIDEO") newEl.style.opacity = prevEl ? 0 : 1;
  newEl.play().catch(() => {});

  activeEl = newEl;
  activeLayerIndex = newLayerIndex;
  mediaEl = newEl;

  if (!prevEl) {
    crossfadeTriggered = false;
    return;
  }


  const start = performance.now();
  function step(now){
    const t = Math.min(1, Math.max(0, (now - start) / CROSSFADE_MS));
    newEl.volume = clamp01(0.5 * t);
    if (newEl.tagName === "VIDEO") newEl.style.opacity = t;
    prevEl.volume = clamp01(0.5 * (1 - t));
    if (prevEl.tagName === "VIDEO") prevEl.style.opacity = 1 - t;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      prevEl.pause();
      prevEl.currentTime = 0;
      if (prevEl.tagName === "VIDEO") prevEl.style.opacity = 0;
      crossfadeTriggered = false;
    }
  }
  requestAnimationFrame(step);
}

const nowPlayingFill = document.getElementById("nowPlayingFill");

let fillWriteQueued = false;
function writeNowPlayingFill(el){
  if (fillWriteQueued) return;
  fillWriteQueued = true;
  requestAnimationFrame(() => {
    fillWriteQueued = false;
    if (el.duration && isFinite(el.duration) && nowPlayingFill) {
      nowPlayingFill.style.width = `${clamp01(el.currentTime / el.duration) * 100}%`;
    }
  });
}

function handleTimeUpdate(e){
  const el = e.target;
  if (el !== activeEl) return;

  writeNowPlayingFill(el);

  if (crossfadeTriggered) return;
  if (!el.duration || !isFinite(el.duration)) return;
  const remaining = el.duration - el.currentTime;
  if (remaining <= CROSSFADE_MS / 1000) {
    crossfadeTriggered = true;
    crossfadeStuckSince = performance.now();
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    crossfadeToTrack(currentTrackIndex);
  }
}

function handleEnded(e){
  const el = e.target;
  if (el !== activeEl || crossfadeTriggered) return;
  crossfadeTriggered = true;
  crossfadeStuckSince = performance.now();
  currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
  crossfadeToTrack(currentTrackIndex);
}

attachMediaListeners(bgVideo);
attachMediaListeners(audioEl);

let lastWatchdogTime = -1;
setInterval(() => {
  if (!activeEl || playlist.length <= 1) return;

  if (crossfadeTriggered) {

    if (performance.now() - crossfadeStuckSince > 8000) {
      console.warn("crossfade looked stuck. Retrying");
      crossfadeTriggered = false;
      crossfadeToTrack(currentTrackIndex);
    }
    lastWatchdogTime = -1;
    return;
  }

  if (activeEl.currentTime === lastWatchdogTime) {
    console.warn("playback looked frozen, forcing advance to the next track");
    crossfadeTriggered = true;
    crossfadeStuckSince = performance.now();
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    crossfadeToTrack(currentTrackIndex);
    lastWatchdogTime = -1;
    return;
  }
  lastWatchdogTime = activeEl.currentTime;
}, 2000);

async function resolveMediaSource(){
  const entryText = document.querySelector(".entry-text");
  if (entryText) entryText.textContent = "LOADING...";

  playlist = await buildPlaylist();

  if (playlist.length === 0) {
    console.warn("no tracks in TRACKS table (tracks.js) entry gate will still work, i hope😭.");
    mediaEl = audioEl;
  } else {

    await preloadTrack(playlist[0]);
  }

  if (entryText) entryText.textContent = "CLICK TO ENTER";
}
const mediaReady = resolveMediaSource();

entryGate.addEventListener("click", async () => {
  await mediaReady;

  audioReady = true;

  entryGate.classList.add("is-hidden");
  mainCard.classList.remove("is-blurred");

  if (playlist.length > 0) {
    currentTrackIndex = 0;
    crossfadeToTrack(0).then(() => prefetchRest(0));
  }

  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "playing";
  }
}, { once: true });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && mediaEl && mediaEl.paused && audioReady) {
    mediaEl.play().catch(() => {});
  }
});


const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MAX_PARTICLES = 40;

function spawnNameParticle(){
  if (reducedMotion) return;
  if (nameParticles.childElementCount >= MAX_PARTICLES) return;

  const width = nameParticles.clientWidth || 200;
  const p = document.createElement("span");

  const roll = Math.random();
  let colorClass = "";
  if (roll < 0.32) colorClass = " blue";
  else if (roll < 0.42) colorClass = " gold";
  p.className = "particle" + colorClass;

  const size = 3.5 + Math.random() * 3; // 3.5–6.5px
  p.style.width = `${size}px`;
  p.style.height = `${size}px`;

  const startX = Math.random() * width;
  const drift = (Math.random() - 0.5) * 46;

  p.style.left = `${startX}px`;
  p.style.setProperty("--dx", `${drift}px`);

  nameParticles.appendChild(p);
  p.addEventListener("animationend", () => p.remove());
}

setInterval(spawnNameParticle, 140);

setInterval(() => { if (Math.random() < 0.5) spawnNameParticle(); }, 220);

const canTilt = window.matchMedia("(pointer: fine)").matches && !reducedMotion;

if (canTilt && mainCard) {
  const MAX_TILT_DEG = 6;

  document.addEventListener("mousemove", (e) => {
    const r = mainCard.getBoundingClientRect();
    const rawX = ((e.clientX - r.left) / r.width) * 2 - 1;
    const rawY = ((e.clientY - r.top) / r.height) * 2 - 1;
    const nx = Math.max(-1, Math.min(1, rawX));
    const ny = Math.max(-1, Math.min(1, rawY));
    const rotY = nx * MAX_TILT_DEG;
    const rotX = -ny * MAX_TILT_DEG;
    mainCard.style.transform =
      `translateY(-50%) perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });

  document.addEventListener("mouseleave", () => {
    mainCard.style.transform = "translateY(-50%)";
  });
}

const konamiSequence = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let konamiProgress = 0;

document.addEventListener("keydown", (e) => {
  const expected = konamiSequence[konamiProgress];
  const matched = e.key === expected || e.key.toLowerCase() === expected;

  if (matched) {
    konamiProgress++;
    if (konamiProgress === konamiSequence.length) {
      konamiProgress = 0;
      triggerKonamiEasterEgg();
    }
  } else {
    konamiProgress = (e.key === konamiSequence[0]) ? 1 : 0;
  }
});

function triggerKonamiEasterEgg(){
  if (reducedMotion) return;
  for (let i = 0; i < 40; i++){
    setTimeout(spawnNameParticle, i * 20);
  }
  document.body.classList.add("konami-flash");
  setTimeout(() => document.body.classList.remove("konami-flash"), 1200);
}










/*
  _   _                                                   
 | \ | |  ___ __  __ ___  ___  _ __ ___    ___  _ __  ___ 
 |  \| | / _ \\ \/ // _ \/ __|| '_ ` _ \  / _ \| '__|/ _ \
 | |\  ||  __/ >  <|  __/\__ \| | | | | ||  __/| |  |  __/
 |_| \_| \___|/_/\_\___||___/|_| |_| |_| \___||_|   \___|
                                          Property of @Nexesmere.
*/
