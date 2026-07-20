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
  previewBio.textContent = (lastPresenceData.kv && lastPresenceData.kv.bio) || "https://guns.lol/patrick2769"

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
// AUDIO-REACTIVE VISUALIZER
// ===================================================================
const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d");
const starsCanvas = document.getElementById("stars");
const starsCtx = starsCanvas.getContext("2d");
const audioEl = document.getElementById("bgAudio");
const audioEl2 = document.getElementById("bgAudio2");
const bgVideo = document.getElementById("bgVideo");
const bgVideo2 = document.getElementById("bgVideo2");
const entryGate = document.getElementById("entryGate");
const mainCard = document.getElementById("mainCard");
const nameParticles = document.getElementById("nameParticles");

let audioCtx, analyser, dataArray;
let audioReady = false;
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

// starfield state
let stars = [];

function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  starsCanvas.width = window.innerWidth;
  starsCanvas.height = window.innerHeight;
  initStars();
}
window.addEventListener("resize", resizeCanvas);

function initStars(){
  const w = starsCanvas.width, h = starsCanvas.height;
  const count = Math.round((w * h) / 9000); // scales with screen size
  stars = [];
  for (let i = 0; i < count; i++){
    const roll = Math.random();
    let hue = "white";
    if (roll < 0.16) hue = "blue";
    else if (roll < 0.22) hue = "warm";

    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + 0.4,
      baseAlpha: Math.random() * 0.5 + 0.35,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.8 + 0.3,
      driftX: (Math.random() - 0.5) * 0.04,
      driftY: (Math.random() - 0.5) * 0.04,
      hue
    });
  }
}

// pre-rendered glow sprites — drawing these with drawImage is WAY
// cheaper than recomputing ctx.shadowBlur per star per frame, which
// was quietly wrecking your GPU process for no visual upside
const GLOW_SIZE = 24;
function makeGlowSprite(rgb){
  const c = document.createElement("canvas");
  c.width = GLOW_SIZE;
  c.height = GLOW_SIZE;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(GLOW_SIZE/2, GLOW_SIZE/2, 0, GLOW_SIZE/2, GLOW_SIZE/2, GLOW_SIZE/2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  return c;
}
const glowSprites = {
  white: makeGlowSprite("242,242,237"),
  blue: makeGlowSprite("150,190,255"),
  warm: makeGlowSprite("255,225,195")
};

function drawStars(t){
  const w = starsCanvas.width, h = starsCanvas.height;
  starsCtx.clearRect(0, 0, w, h);

  for (const s of stars){
    const twinkle = Math.sin(t * 0.001 * s.speed + s.phase);
    const alpha = Math.max(0, Math.min(1, s.baseAlpha + twinkle * 0.3));

    const sprite = glowSprites[s.hue] || glowSprites.white;
    const size = s.r * 9;
    starsCtx.globalAlpha = alpha;
    starsCtx.drawImage(sprite, s.x - size / 2, s.y - size / 2, size, size);

    // slow ambient drift, wraps around edges
    s.x += s.driftX;
    s.y += s.driftY;
    if (s.x < 0) s.x = w;
    if (s.x > w) s.x = 0;
    if (s.y < 0) s.y = h;
    if (s.y > h) s.y = 0;
  }
  starsCtx.globalAlpha = 1;
}

resizeCanvas();

// ===================================================================
// PLAYLIST — numbered tracks (track1, track2, track3...) checked in
// order, each one independently .mp4 (video bg) or .mp3 (audio-only),
// mixed freely in any order. loops back to track 1 after the last
// one plays. falls back to the old unnumbered "music/track.mp4" /
// "music/track.mp3" naming if no numbered tracks exist.
// ===================================================================
const MAX_TRACKS = 50;

// this site's render.yaml rewrites every missing path to index.html
// (SPA-style fallback), so a plain HEAD status check would think
// EVERY track number "exists" since Render just serves index.html
// instead of a real 404. checking content-type instead of just the
// status code is what filters the fakes out.
async function fileIsRealMedia(url, expectedTypePrefix){
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith(expectedTypePrefix);
  } catch {
    return false;
  }
}

async function buildPlaylist(){
  const list = [];
  for (let i = 1; i <= MAX_TRACKS; i++){
    const mp4Url = `music/track${i}.mp4`;
    const mp3Url = `music/track${i}.mp3`;
    if (await fileIsRealMedia(mp4Url, "video/")) {
      list.push({ type: "video", url: mp4Url, blobUrl: null });
    } else if (await fileIsRealMedia(mp3Url, "audio/")) {
      list.push({ type: "audio", url: mp3Url, blobUrl: null });
    } else {
      break; // numbering stops being contiguous — playlist ends here
    }
  }

  // legacy fallback — no track1 found, check the old unnumbered names
  if (list.length === 0) {
    if (await fileIsRealMedia("music/track.mp4", "video/")) {
      list.push({ type: "video", url: "music/track.mp4", blobUrl: null });
    } else if (await fileIsRealMedia("music/track.mp3", "audio/")) {
      list.push({ type: "audio", url: "music/track.mp3", blobUrl: null });
    }
  }

  return list;
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

// starts the crossfade to the next track slightly BEFORE the current
// one physically ends, so the transition is gapless instead of
// waiting for silence then fading in
function handleTimeUpdate(e){
  const el = e.target;
  if (el !== activeEl || crossfadeTriggered) return;
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
    console.warn("no tracks found in /music (checked track1.mp4/mp3 upward, plus legacy track.mp4/mp3) — entry gate will still work, just silently.");
    mediaEl = audioEl;
  }

  if (entryText) entryText.textContent = "CLICK TO ENTER";
}
const mediaReady = resolveMediaSource();

function setupAudioGraph(){
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  // all 4 elements get wired into the graph up front, since a
  // MediaElementSourceNode can only ever be created ONCE per element —
  // this lets the crossfade freely swap between layers/types later
  // without rebuilding the graph every time
  allMediaEls.forEach(el => {
    const source = audioCtx.createMediaElementSource(el);
    source.connect(analyser);
  });

  analyser.connect(audioCtx.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

entryGate.addEventListener("click", async () => {
  await mediaReady; // make sure the playlist is built before wiring the graph

  if (!audioReady) {
    setupAudioGraph();
    audioReady = true;
  }
  await audioCtx.resume();

  if (playlist.length > 0) {
    currentTrackIndex = 0;
    await crossfadeToTrack(0);
    prefetchRest(0); // load the rest of the playlist in the background
  }

  entryGate.classList.add("is-hidden");
  mainCard.classList.remove("is-blurred");

  // tells the browser this is an active playback session so it backs
  // off throttling it as hard when the tab loses focus
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "playing";
  }
}, { once: true });

// tab-switch cutout fix — browsers auto-suspend the AudioContext when
// the tab loses focus/visibility to save power, and don't always
// resume it cleanly on their own. force it back on when we return.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && audioReady && audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (!document.hidden && mediaEl && mediaEl.paused && audioReady) {
    mediaEl.play().catch(() => {});
  }
});

function drawIdle(t){
  // ambient idle motion before audio is enabled — sparse flat baseline
  const w = canvas.width, h = canvas.height, mid = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(242,242,237,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const bars = 64;
  const gap = w / bars;
  for (let i = 0; i < bars; i++){
    const x = i * gap;
    const wave = Math.sin(i * 0.4 + t * 0.001) * 6;
    ctx.moveTo(x, mid - wave);
    ctx.lineTo(x, mid + wave);
  }
  ctx.stroke();
}

function drawReactive(){
  analyser.getByteFrequencyData(dataArray);
  const w = canvas.width, h = canvas.height, mid = h / 2;
  ctx.clearRect(0, 0, w, h);

  const bars = dataArray.length;
  const gap = w / bars;

  ctx.lineCap = "square";

  for (let i = 0; i < bars; i++){
    const v = dataArray[i] / 255;
    const barH = v * (h * 0.42);
    const x = i * gap;

    const alpha = 0.18 + v * 0.7;
    ctx.strokeStyle = `rgba(242,242,237,${alpha})`;
    ctx.lineWidth = Math.max(1.5, gap * 0.55);

    ctx.beginPath();
    ctx.moveTo(x, mid - barH);
    ctx.lineTo(x, mid + barH);
    ctx.stroke();
  }

  // hairline center axis — "tuff" straight edge through the noise
  ctx.strokeStyle = "rgba(242,242,237,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();
}

function loop(t){
  drawStars(t);
  if (audioReady && !mediaEl.paused) {
    drawReactive();
  } else {
    drawIdle(t);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

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
