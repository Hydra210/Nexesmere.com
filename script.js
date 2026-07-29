// ===================================================================
// CONFIG
// ===================================================================
const DISCORD_ID = "728856632288608336";

// ===================================================================
// CUSTOM CURSOR — opaque dot with a black stroke that smoothly turns
// white when hovering anything clickable. self-contained (builds its
// own element), only runs on fine-pointer devices since touch screens
// have no cursor to replace.
// ===================================================================
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

// ===================================================================
// ICON FALLBACKS — hides an icon gracefully if the asset is missing,
// instead of leaving a broken-image box on the page
// ===================================================================
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

// ===================================================================
// MY TIME — hardcoded to YOUR timezone, not the visitor's. shows
// what time it actually is for you regardless of who's looking or
// where they're at. change the timeZone string below if you move.
// ===================================================================
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

// ===================================================================
// LANYARD — live discord presence over websocket
// docs: https://github.com/Phineas/lanyard
// ===================================================================
let heartbeatInterval = null;

function connectLanyard(){
  const ws = new WebSocket("wss://api.lanyard.rest/socket");

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch(msg.op){
      case 1: { // HELLO — start heartbeat, then subscribe
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
      case 0: { // EVENT — presence data
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
  lastPresenceData = data; // keep the latest payload around for the discord preview panel

  const user = data.discord_user;
  const displayNameEl = document.getElementById("displayName");
  const usernameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");
  const decoEl = document.getElementById("decoRing");
  const statusDot = document.getElementById("statusDot");
  const dndIcon = document.getElementById("dndIcon");
  const statusText = document.getElementById("statusText");
  const feed = document.getElementById("activityFeed");

  // identity — global_name is the "display name", username is the handle
  displayNameEl.textContent = user.global_name || user.username || "unknown";
  usernameEl.textContent = "@" + (user.username || "unknown");

  const ext = user.avatar && user.avatar.startsWith("a_") ? "gif" : "png";
  avatarEl.src = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  // avatar decoration (if discord account has one equipped)
  if (user.avatar_decoration_data && user.avatar_decoration_data.asset) {
    decoEl.src = `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png`;
    decoEl.hidden = false;
  } else {
    decoEl.hidden = true;
  }

  // status dot
  statusDot.dataset.status = data.discord_status || "offline";

  const showDndIcon = data.discord_status === "dnd" && dndIcon.dataset.broken !== "1";
  dndIcon.hidden = !showDndIcon;
  statusDot.style.visibility = showDndIcon ? "hidden" : "visible";

  // custom status text (activity type 4)
  const customStatus = (data.activities || []).find(a => a.type === 4);
  statusText.textContent = customStatus && customStatus.state
    ? customStatus.state
    : (data.discord_status || "offline").toUpperCase();

  // activity feed
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

  // keeps the discord preview panel live if it's already open when a new
  // presence update comes in, instead of freezing on whatever it had first
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

let lastPresenceData = null; // most recent lanyard payload — declared before connectLanyard() runs
let openPreviewPlatform = null; // which preview panel is currently open, if any

connectLanyard();

// ===================================================================
// SOCIAL PREVIEWS — dropdown panel under the social row showing
// profile info per platform. discord is fully live off the lanyard
// payload above. roblox is fetched live from our own backend (see
// server.py) which proxies roblox's api server-side, since browsers
// can't call roblox directly (their api never sends back
// Access-Control-Allow-Origin, so the request gets blocked by CORS
// before the response reaches JS — a server has no such restriction).
// instagram is still filled in by hand below since there's no api at
// all for looking up an arbitrary profile without owning the account.
// update PROFILE_DATA.instagram whenever that changes.
// ===================================================================
const PROFILE_DATA = {
  instagram: {
    pfp: "icons/preview-instagram.jpg", // drop a saved copy of your pfp here — the CDN link in the html you sent is signed and expires
    username: "pat2769_",
    displayName: "PAT😝",
    posts: 38,
    bio: "----------------------\n┆　┆　┆　┆　┆\n┆　┆  ࣪ ˖☆ ࣪⭑┆ ݁˖ .☆ . ݁ ˖ \n☆⊹ ࣪ ┆ ˖ ࣪　⊹ ࣪ ★ ⋆.˚  ⊹ ࣪\n   ࣪ ˖⋆˚★ ₊ ⊹　  ࣪˖ ࣪ ₊  ࣪ ˖　\n. ݁　⊹ ࣪ ˖　　　 ࣪ ˖",
    url: "https://www.instagram.com/pat2769_/"
  }
};

const ROBLOX_USER_ID = "1230783705";
const ROBLOX_PROFILE_URL = "https://www.roblox.com/users/1230783705/profile";
let robloxProfileCache = null; // avoids re-hitting our own backend every time the panel is reopened

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

  // "visibility" — which client(s) you're actively signed in on, since
  // discord doesn't expose a real privacy toggle through the public api
  const platforms = [];
  if (lastPresenceData.active_on_discord_desktop) platforms.push("Desktop");
  if (lastPresenceData.active_on_discord_mobile) platforms.push("Mobile");
  if (lastPresenceData.active_on_discord_web) platforms.push("Web");
  previewStats.appendChild(buildPreviewStat("Visibility", platforms.length ? platforms.join(", ") : "Offline"));

  // bio comes from lanyard's kv store, not the presence payload itself —
  // set it once via: DM the lanyard bot ".apikey", then
  // PUT https://api.lanyard.rest/v1/users/728856632288608336/kv/bio
  // with your bio text as the request body
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
    previewBio.textContent = "roblox lookup failed — try again in a bit";
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

// ===================================================================
// PLAYBACK STATE
// ===================================================================
const audioEl = document.getElementById("bgAudio");
const audioEl2 = document.getElementById("bgAudio2");
const bgVideo = document.getElementById("bgVideo");
const bgVideo2 = document.getElementById("bgVideo2");
const entryGate = document.getElementById("entryGate");
const mainCard = document.getElementById("mainCard");
const nameParticles = document.getElementById("nameParticles");

let audioReady = false; // true once playback has actually started
let mediaEl = audioEl; // whichever element is currently the primary one playing

// two overlapping "layers" (one video + one audio slot each) so we
// can play the next track underneath the current one and crossfade
// between them instead of hard-cutting
const layers = [
  { video: bgVideo, audio: audioEl },
  { video: bgVideo2, audio: audioEl2 }
];
let activeLayerIndex = 0;
let activeEl = null; // the element actually driving playback right now
let crossfadeTriggered = false;
let crossfadeStuckSince = 0; // timestamp of when crossfadeTriggered last flipped true
const CROSSFADE_MS = 1200;
// PLAYLIST — built straight from the TRACKS table in tracks.js.
// Playback order = table order, loops back to the top after the
// last entry. tracks.js must load before this file (see index.html).
// ===================================================================
async function buildPlaylist(){
  if (typeof TRACKS === "undefined" || !Array.isArray(TRACKS)) {
    console.warn("TRACKS table not found — make sure tracks.js is loaded before script.js");
    return [];
  }
  return TRACKS.map(t => ({ type: t.type, url: t.url, blobUrl: null }));
}

let playlist = [];
let currentTrackIndex = 0;

// fully downloads one track into a blob before it plays — same deal
// as before, no half-buffered streaming stutter
async function preloadTrack(track){
  if (track.blobUrl) return track.blobUrl;
  try {
    const res = await fetch(track.url);
    const blob = await res.blob();
    track.blobUrl = URL.createObjectURL(blob);
  } catch (err) {
    console.warn("blob preload failed for", track.url, "— falling back to streamed src:", err);
  }
  return track.blobUrl || track.url;
}

// quietly preloads everything else in the background once one track
// is playing, so switching tracks is instant instead of buffering
// mid-playlist
function prefetchRest(fromIndex){
  for (let i = 0; i < playlist.length; i++){
    if (i === fromIndex) continue;
    preloadTrack(playlist[i]);
  }
}

// classic browser bug — some files loaded from a blob: URL report
// .duration as Infinity forever instead of the real length, since
// blob URLs skip the normal metadata negotiation a streamed URL gets.
// the fix is a known trick: seek to a huge timestamp once, which
// forces the browser to actually compute the real duration, then
// snap back to 0. without this, our "fade before it ends" logic has
// no way to know when the track is about to end and just hangs.
function timeoutPromise(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureRealDuration(el){
  if (isFinite(el.duration) && el.duration > 0) return;

  if (el.readyState === 0) {
    // race against a timeout — some browsers/files just never fire
    // loadedmetadata, and without this the whole crossfade (and
    // therefore the entire playlist) hangs forever waiting on it
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

// hard clamp so a stray float rounding error can NEVER throw
// IndexSizeError on .volume again, no matter what causes it
function clamp01(v){
  return Math.max(0, Math.min(1, v));
}

// plays a track with no fade — only used when there's just ONE track
// in the whole playlist, since native `loop` is smoother and cheaper
// than fading a track into itself every time it repeats
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
  crossfadeTriggered = false; // nothing fading — safe to watch again immediately
  target.play().catch(() => {});
}

// the real crossfade — starts the next track on the OTHER layer at
// zero volume/opacity, ramps it up while ramping the current one
// down over CROSSFADE_MS, works for any video<->audio combo
async function crossfadeToTrack(i){
  const track = playlist[i];
  if (!track) return;

  if (playlist.length === 1) {
    return playSingleTrackLoop(track);
  }

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
  newEl.loop = false; // looping is handled by the playlist cycling itself now
  newEl.volume = prevEl ? 0 : 0.5;
  await ensureRealDuration(newEl);
  if (newEl.tagName === "VIDEO") newEl.style.opacity = prevEl ? 0 : 1;
  newEl.play().catch(() => {});

  activeEl = newEl;
  activeLayerIndex = newLayerIndex;
  mediaEl = newEl;

  if (!prevEl) {
    crossfadeTriggered = false; // no old track to fade — this crossfade is instantly done
    return;
  }

  // NOTE: crossfadeTriggered stays TRUE for the entire fade animation
  // below, not just the track-swap above — clearing it early was the
  // actual bug. it let the watchdog think nothing was in-flight while
  // this fade was still running, so it fired a SECOND overlapping
  // crossfade on top of this one, and the two fights over .volume
  // sent it negative and crashed the whole thing.
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
      crossfadeTriggered = false; // fade animation is ACTUALLY done now
    }
  }
  requestAnimationFrame(step);
}

const nowPlayingFill = document.getElementById("nowPlayingFill");

// starts the crossfade to the next track slightly BEFORE the current
// one physically ends, so the transition is gapless instead of
// waiting for silence then fading in
function handleTimeUpdate(e){
  const el = e.target;
  if (el !== activeEl) return;

  if (el.duration && isFinite(el.duration) && nowPlayingFill) {
    nowPlayingFill.style.width = `${clamp01(el.currentTime / el.duration) * 100}%`;
  }

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

// fallback in case timeupdate granularity ever misses the window —
// makes sure the playlist never just dead-stops
function handleEnded(e){
  const el = e.target;
  if (el !== activeEl || crossfadeTriggered) return;
  crossfadeTriggered = true;
  crossfadeStuckSince = performance.now();
  currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
  crossfadeToTrack(currentTrackIndex);
}

const allMediaEls = [bgVideo, bgVideo2, audioEl, audioEl2];

allMediaEls.forEach(el => {
  el.addEventListener("timeupdate", handleTimeUpdate);
  el.addEventListener("ended", handleEnded);
  // stutter mitigation — force a reload if the active source stalls
  el.addEventListener("stalled", () => { if (el === activeEl) el.load(); });
});

// watchdog — if playback ever straight-up freezes for whatever reason
// (a stuck decode, another blob quirk, whatever) and currentTime just
// isn't moving, force it to the next track instead of dying silently
let lastWatchdogTime = -1;
setInterval(() => {
  if (!activeEl || playlist.length <= 1) return;

  if (crossfadeTriggered) {
    // a crossfade is in flight — that's normal and can take a couple
    // seconds (preload + fade), so give it room. but if it's been
    // "in progress" way longer than that, it's genuinely hung (this
    // used to be possible forever before ensureRealDuration got a
    // timeout) — recover instead of leaving the site silent forever
    if (performance.now() - crossfadeStuckSince > 8000) {
      console.warn("crossfade looked stuck — retrying");
      crossfadeTriggered = false;
      crossfadeToTrack(currentTrackIndex);
    }
    lastWatchdogTime = -1;
    return;
  }

  // NOTE: deliberately not skipping when activeEl.paused — a track
  // pauses itself the instant it naturally ends, and that's exactly
  // the freeze case this watchdog needs to catch (e.g. if a .play()
  // call ever gets silently rejected by the browser). currentTime
  // staying frozen across two ticks is what actually matters.
  if (activeEl.currentTime === lastWatchdogTime) {
    console.warn("playback looked frozen — forcing advance to the next track");
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
    console.warn("no tracks in TRACKS table (tracks.js) — entry gate will still work, just silently.");
    mediaEl = audioEl;
  } else {
    // buildPlaylist() itself is now instant (just reads the TRACKS
    // table), so without this the gate flipped to "CLICK TO ENTER"
    // before the actual video/audio had downloaded at all. waiting
    // on preloadTrack here forces it to sit on "LOADING..." until
    // the first track is FULLY fetched as a blob — same blob gets
    // reused instantly on click since preloadTrack caches it.
    await preloadTrack(playlist[0]);
  }

  if (entryText) entryText.textContent = "CLICK TO ENTER";
}
const mediaReady = resolveMediaSource();

entryGate.addEventListener("click", async () => {
  await mediaReady; // make sure the playlist is built before starting playback

  audioReady = true;

  // hide the gate the instant the click is handled — don't make the user
  // stare at "CLICK TO ENTER" while the track's full blob downloads below
  entryGate.classList.add("is-hidden");
  mainCard.classList.remove("is-blurred");

  if (playlist.length > 0) {
    currentTrackIndex = 0;
    crossfadeToTrack(0).then(() => prefetchRest(0)); // load in the background, don't block the UI on it
  }

  // tells the browser this is an active playback session so it backs
  // off throttling it as hard when the tab loses focus
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "playing";
  }
}, { once: true });

// tab-switch cutout fix — browsers can suspend/throttle playback when
// the tab loses focus and don't always resume it cleanly on their own.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && mediaEl && mediaEl.paused && audioReady) {
    mediaEl.play().catch(() => {});
  }
});

// ===================================================================
// NAME PARTICLES — small glowing dots drifting up around the display name
// ===================================================================
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function spawnNameParticle(){
  if (reducedMotion) return;

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
  const drift = (Math.random() - 0.5) * 46; // px horizontal wander while floating up

  p.style.left = `${startX}px`;
  p.style.setProperty("--dx", `${drift}px`);

  nameParticles.appendChild(p);
  p.addEventListener("animationend", () => p.remove());
}

setInterval(spawnNameParticle, 140);
// occasional double-spawn so it never feels too sparse
setInterval(() => { if (Math.random() < 0.5) spawnNameParticle(); }, 220);

// ===================================================================
// CARD TILT — follows the cursor. perspective() lives right inside
// this element's own transform, so it doesn't need a `perspective`
// property on a parent (which would've messed with the fixed-position
// video/canvas layers elsewhere on the page). CSS transition on the
// card handles the smoothing, so no extra rAF loop needed here either.
// ===================================================================
const canTilt = window.matchMedia("(pointer: fine)").matches && !reducedMotion;

if (canTilt && mainCard) {
  const MAX_TILT_DEG = 6;

  document.addEventListener("mousemove", (e) => {
    const r = mainCard.getBoundingClientRect();
    const rawX = ((e.clientX - r.left) / r.width) * 2 - 1;  // -1..1 across the card, unbounded outside it
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

// ===================================================================
// KONAMI CODE EASTER EGG — up up down down left right left right b a
// ===================================================================
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
                                                                                                                                     
                   KKKKKKKKK    KKKKKKK                                                                                              
     @@@@@@@@@     K:::::::K    K:::::K                                                                                              
   @@:::::::::@@   K:::::::K    K:::::K                                                                                              
 @@:::::::::::::@@ K:::::::K   K::::::K                                                                                              
@:::::::@@@:::::::@KK::::::K  K:::::KKK  aaaaaaaaaaaaa    aaaaaaaaaaaaa  nnnn  nnnnnnnn yyyyyyy           yyyyyyyxxxxxxx      xxxxxxx
@::::::@   @::::::@  K:::::K K:::::K     a::::::::::::a   a::::::::::::a n:::nn::::::::nny:::::y         y:::::y  x:::::x    x:::::x 
@:::::@  @@@@:::::@  K::::::K:::::K      aaaaaaaaa:::::a  aaaaaaaaa:::::an::::::::::::::nny:::::y       y:::::y    x:::::x  x:::::x  
@:::::@  @::::::::@  K:::::::::::K                a::::a           a::::ann:::::::::::::::ny:::::y     y:::::y      x:::::xx:::::x   
@:::::@  @::::::::@  K:::::::::::K         aaaaaaa:::::a    aaaaaaa:::::a  n:::::nnnn:::::n y:::::y   y:::::y        x::::::::::x    
@:::::@  @:::::::@@  K::::::K:::::K      aa::::::::::::a  aa::::::::::::a  n::::n    n::::n  y:::::y y:::::y          x::::::::x     
@:::::@  @@@@@@@@    K:::::K K:::::K    a::::aaaa::::::a a::::aaaa::::::a  n::::n    n::::n   y:::::y:::::y           x::::::::x     
@::::::@           KK::::::K  K:::::KKKa::::a    a:::::aa::::a    a:::::a  n::::n    n::::n    y:::::::::y           x::::::::::x    
@:::::::@@@@@@@@   K:::::::K   K::::::Ka::::a    a:::::aa::::a    a:::::a  n::::n    n::::n     y:::::::y           x:::::xx:::::x   
 @@:::::::::::::@  K:::::::K    K:::::Ka:::::aaaa::::::aa:::::aaaa::::::a  n::::n    n::::n      y:::::y           x:::::x  x:::::x  
   @@:::::::::::@  K:::::::K    K:::::K a::::::::::aa:::aa::::::::::aa:::a n::::n    n::::n     y:::::y           x:::::x    x:::::x 
     @@@@@@@@@@@   KKKKKKKKK    KKKKKKK  aaaaaaaaaa  aaaa aaaaaaaaaa  aaaa nnnnnn    nnnnnn    y:::::y           xxxxxxx      xxxxxxx
                                                                                              y:::::y                                
                                                                                             y:::::y                                 
                                                                                            y:::::y                                  
                                                                                           y:::::y                                   
                                                                                          yyyyyyy
*/
