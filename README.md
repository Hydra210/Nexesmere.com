# nexesmere profile

personal bio-link style page. black/white, audio-reactive canvas visualizer, live discord presence pulled from lanyard.

## files
- `index.html` — structure
- `style.css` — theme
- `script.js` — lanyard websocket + visualizer + audio unlock
- `music/track.mp3` — drop your own audio file here with this exact name (or change the path in `index.html`'s `<audio>` tag)
- `render.yaml` — static site config for render

## discord data (lanyard)
your discord id is already wired in at the top of `script.js`:

```js
const DISCORD_ID = "728856632288608336";
```

lanyard needs you to be in their discord server for presence to work: https://discord.gg/lanyard — join it once and your presence will start showing up on any site using the api, no bot install needed.

pulled automatically:
- pfp (animated if you have a gif avatar), shown in full color
- display name (big) + @username (small underneath)
- status dot (online/idle/dnd/offline)
- custom status text
- avatar decoration, if your account has one equipped
- current activity (game/app), spotify now playing

**not pulled: discord "profile effects."** those are the animated backgrounds behind your pfp inside the discord client itself. as of now discord doesn't expose them through lanyard or any public api, so there's no legitimate way to pull them live — anything claiming to do that is either scraping in a way that'll break constantly or straight up faking it. if you want that vibe here, the honest move is a css animation behind the avatar built to look similar, not a real mirror of it.

## click to enter
the whole page loads blurred behind a "CLICK TO ENTER" gate. clicking it does three things at once, in the same user gesture (required for browsers to allow audio):
1. unblurs the card
2. starts the audio context
3. plays `music/track.mp3` immediately at 50% volume

after that the visualizer switches from its idle sine wave to reacting off real frequency data from the track.

## background details
- **stars** — a full starfield behind everything, twinkling on independent sine cycles, slow ambient drift, mostly white with a scattering tinted blue and a few warm/amber ones for realism
- **name particles** — glowing dots (white/blue/gold) continuously drift up around your display name, sized and spaced to actually read at a glance rather than just a subtle dusting
- **display name animation** — a light shine sweeps across the text every few seconds, plus a quick glitch tick every ~6.5s (brief offset + soft color-split, still monochrome/blue to match the theme)
- all of the above respect `prefers-reduced-motion` — particles stop spawning, the shine/glitch turns off (name goes solid), and the pfp pulse turns off if that's set on the visitor's system

## music
swap `music/track.mp3` for whatever you want. mp3/ogg/wav all work, just update the `src` on the `<audio>` tag in `index.html` if you rename it.

## deploy on render
1. push this repo to github
2. render dashboard → new → static site → connect the repo
3. build command: leave blank
4. publish directory: `.`
5. deploy

(`render.yaml` above does this automatically if you use render's "blueprint" deploy option instead of clicking through manually)

## notes
- everything's grayscale/contrast-filtered on purpose, even if your actual pfp has color, to keep the theme consistent
- visualizer draws off the real `<audio>` element via the web audio api, mirrored bars off a center axis
- reduced-motion is respected (kills the avatar pulse animation)
