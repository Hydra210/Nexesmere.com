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
- pfp (animated if you have a gif avatar)
- username
- status dot (online/idle/dnd/offline)
- custom status text
- avatar decoration, if your account has one equipped
- current activity (game/app), spotify now playing

**not pulled:** discord "profile effects" (the animated backgrounds behind your profile in the discord client). discord doesn't expose those through lanyard or any public api right now, so there's no honest way to pull them live. if you want that look, easiest move is faking it with a css animation behind the avatar instead of trying to mirror the real one.

## music
autoplay-with-sound is blocked by browsers until the user interacts with the page, so there's a "TAP FOR SOUND" button top right. once clicked it unmutes and kicks off the visualizer reacting to the actual frequency data instead of the idle sine wave.

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
