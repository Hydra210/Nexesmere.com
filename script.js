// ===================================================================
// CONFIG
// ===================================================================
const DISCORD_ID = "728856632288608336";

// ===================================================================
// CLOCK
// ===================================================================
function tickClock(){
  const el = document.getElementById("clock");
  const now = new Date();
  el.textContent = now.toTimeString().slice(0,8);
}
setInterval(tickClock, 1000);
tickClock();

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

connectLanyard();

// ===================================================================
// AUDIO-REACTIVE VISUALIZER
// ===================================================================
const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d");
const starsCanvas = document.getElementById("stars");
const starsCtx = starsCanvas.getContext("2d");
const audioEl = document.getElementById("bgAudio");
const bgVideo = document.getElementById("bgVideo");
const entryGate = document.getElementById("entryGate");
const mainCard = document.getElementById("mainCard");
const nameParticles = document.getElementById("nameParticles");

let audioCtx, analyser, dataArray, sourceNode;
let audioReady = false;
let mediaEl = audioEl; // whichever element ends up playing — video or audio

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

function drawStars(t){
  const w = starsCanvas.width, h = starsCanvas.height;
  starsCtx.clearRect(0, 0, w, h);

  for (const s of stars){
    const twinkle = Math.sin(t * 0.001 * s.speed + s.phase);
    const alpha = Math.max(0, Math.min(1, s.baseAlpha + twinkle * 0.3));

    let color;
    if (s.hue === "blue") color = `rgba(150,190,255,${alpha})`;
    else if (s.hue === "warm") color = `rgba(255,225,195,${alpha})`;
    else color = `rgba(242,242,237,${alpha})`;

    starsCtx.beginPath();
    starsCtx.fillStyle = color;
    starsCtx.shadowColor = color;
    starsCtx.shadowBlur = s.r * 4;
    starsCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    starsCtx.fill();

    // slow ambient drift, wraps around edges
    s.x += s.driftX;
    s.y += s.driftY;
    if (s.x < 0) s.x = w;
    if (s.x > w) s.x = 0;
    if (s.y < 0) s.y = h;
    if (s.y > h) s.y = 0;
  }
}

resizeCanvas();

// ===================================================================
// MEDIA SOURCE — mp4 (video, becomes the blurred background) takes
// priority over mp3 (audio-only, plain black background)
// ===================================================================
async function fileExists(url){
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveMediaSource(){
  if (await fileExists("music/track.mp4")) {
    bgVideo.src = "music/track.mp4";
    bgVideo.hidden = false;
    mediaEl = bgVideo;
    return;
  }
  if (await fileExists("music/track.mp3")) {
    audioEl.src = "music/track.mp3";
    mediaEl = audioEl;
    return;
  }
  console.warn("no music/track.mp4 or music/track.mp3 found — entry gate will still work, just silently.");
  mediaEl = audioEl;
}
const mediaReady = resolveMediaSource();

// failsafe loop — some mp4s don't loop clean natively if the moov atom
// is jacked up, so force it manually as a backup to the `loop` attribute
bgVideo.addEventListener("ended", () => {
  bgVideo.currentTime = 0;
  bgVideo.play().catch(() => {});
});

// stutter mitigation — don't let it sit there half-buffered,
// force it to reload once we know it's the active source
bgVideo.addEventListener("stalled", () => bgVideo.load());

function setupAudioGraph(){
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(mediaEl);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

entryGate.addEventListener("click", async () => {
  await mediaReady; // make sure we know which file we're playing before wiring the graph

  if (!audioReady) {
    setupAudioGraph();
    audioReady = true;
  }
  await audioCtx.resume();
  mediaEl.muted = false;
  mediaEl.volume = 0.5;
  mediaEl.play().catch(() => {});

  entryGate.classList.add("hidden");
  mainCard.classList.remove("blurred");
}, { once: true });

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

