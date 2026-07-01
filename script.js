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
const audioEl = document.getElementById("bgAudio");
const entryGate = document.getElementById("entryGate");
const mainCard = document.getElementById("mainCard");

let audioCtx, analyser, dataArray, sourceNode;
let audioReady = false;

function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function setupAudioGraph(){
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audioEl);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

entryGate.addEventListener("click", async () => {
  if (!audioReady) {
    setupAudioGraph();
    audioReady = true;
  }
  await audioCtx.resume();
  audioEl.volume = 0.5;
  audioEl.play().catch(() => {});

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
  if (audioReady && !audioEl.paused) {
    drawReactive();
  } else {
    drawIdle(t);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
