# nexesmere.com readme


just so yk i didnt build this to be some kind of template for anyone to just use, i just made it for myself so its not super modular or beginner proofed in some spots. most of the easy stuff (discord id, timezone, links, pfps) is just changing a value and ur good. but if u wanna do bigger stuff like adding a whole new social platform, thats gonna mean actually writing/editing js, not just swapping text. if that sounds annoying just paste the file into claude and tell him what u wanna add, itll walk u through it or just do it for u.

heres where to go for the stuff u would prob want to change.

## file map

| file | what it does |
|---|---|
| `index.html` | the actual page, social buttons, project links |
| `script.js` | basically all the logic, discord id, timezone, social preview data, etc |
| `tracks.js` | bg video/audio playlist |
| `style.css` | colors, fonts, layout, animations |
| `server.py` | tiny backend, only exists for the roblox lookup |
| `icons/` | social icons + the dnd icon |
| `render.yaml` / `requirements.txt` | deploy stuff for render.com |

---

## 1. making it show ur discord instead of mine

this doesnt use a static pfp/name, it pulls ur discord presence over the lanyard websocket. to switch it to ur account

open `script.js`, line 1:
```js
const DISCORD_ID = "728856632288608336";
```
swap that for ur own discord user id (right click ur name in discord > copy user id, u gotta turn on dev mode first in settings > advanced).

sooo lanyard only works if the account has joined the lanyard discord server (https://discord.gg/lanyard) at least once. If ur not in the server it wont load anything for discord, thats why, so go join it, and thats it u dont have to do anything else with lanyard.

once thats done it auto updates ur pfp, display name, username, status dot, "now playing" feed, avatar decoration, all of it. (just not ur bio😔)

## 2. the "my time" clock

find this in `script.js`:
```js
const MY_TIMEZONE = "America/New_York";
```
change it to ur own timezone (https://en.wikipedia.org/wiki/List_of_tz_database_time_zones),
## 3. social links

theres 2 kinds of "social" stuff here, the little preview buttons that pop open a mini card (insta/discord/roblox), and the plain project chip links at the bottom.

### changing where an existing one links to

sadly i could not manage to find somthing to publicly expose instgram information, so it will have to be updated manually, if u want to show ur insta.

- **instagram**: open `script.js`, find `PROFILE_DATA` near the top:
  ```js
  const PROFILE_DATA = {
    instagram: {
      pfp: "icons/preview-instagram.jpg",
      username: "pat2769_",
      displayName: "PAT😝",
      posts: 38,
      bio: "...",
      url: "https://www.instagram.com/pat2769_/"
    }
  };
  ```
  just change username/displayName/posts/bio/url and swap the pfp file for ur own pic in `icons/`.
- **roblox**: find these lines a bit further down:
  ```js
  const ROBLOX_USER_ID = "1230783705";
  const ROBLOX_PROFILE_URL = "https://www.roblox.com/users/1230783705/profile";
  ```
  swap the id and url. this one auto pulls ur roblox pfp/name/bio from `server.py` so u dont gotta fill that stuff in by hand like instagram.
- **discord**: this always just mirrors whatever `DISCORD_ID` u set in step 1, nothing else to touch.

### adding a whole new social (twitter, youtube, whatever)
this is the one part thats actual coding, not just swapping a value, since this wasnt built to be generic. if u dont wanna mess with it by hand, just paste `script.js` and `index.html` into claude and say "add a twitter social preview like the instagram one" and itll handle it.

### the project chips at the bottom

same thing pretty much, just ask claude to change, or add new ones, or if u want to do it manually i actually know how cuz im pro but here:

open `index.html`, find:
```html
<div class="projects-row">
  <a class="project-chip" href="https://exedevelopement.com/sentinel/" target="_blank" rel="noopener noreferrer">Sentinel</a>
  <a class="project-chip" href="https://eywa.lol" target="_blank" rel="noopener noreferrer">eywa.lol</a>
</div>
```
each `<a>` is one chip, text in the middle is the label, `href` is where it goes. add/remove `<a class="project-chip">` lines however u want.
so basically, just coppy each line and change the link to ur link, and change the text in the middle of `<a>` to the lable of the site like Error or somt
## 4. pfps

- **main avatar**: comes straight from discord through `DISCORD_ID`.
- **instagram preview pic**: `icons/preview-instagram.jpg`, just replace the file (keep the name, or update the `pfp` path in `PROFILE_DATA.instagram` if u rename it)
- **roblox preview pic**: pulled from roblox through `server.py`, nothing to upload, just follows `ROBLOX_USER_ID`
- **the small social button icons**: swap the pngs in `icons/` (`instagram.png`, `discord.png`, `roblox.png`), keep the filenames matching what `index.html` points to, or edit the `src` paths urself

## 5. bg video/music playlist

open `tracks.js`:
```js
const TRACKS = [
  { url: "https://pub-a17495cad61f41da8d8e455e1292573b.r2.dev/track1.mp4", type: "video" },
];
```
add as many as u want, each one needs a direct `url` to a hosted file and a `type` of `"video"` or `"audio"`. it dhould crossfades between them, but i havent tested that yet. files gotta be hosted somewhere with a direct link (cloudflare r2, s3, etc)

## 6. colors/fonts/layout

all in `style.css`. one big stylesheet, theres css variables near the top for the main colors, search for `:root` to find them and tweak from there.
or just use claude lol.

## 7. running it / deploying

only needs the python backend cuz of the roblox lookup (`/api/roblox/{user_id}` in `server.py`), everything else is just static html/js.

**run it locally first so yk it works😡:**
```bash
pip install -r requirements.txt
uvicorn server:app --reload
```
then open `http://127.0.0.1:8000`

**deploying:** `render.yaml` is already set up for render so just make a new webservice and deploy.
```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

---

**tldr checklist to make it urs:**
- [ ] `DISCORD_ID` in `script.js` (and join the lanyard discord with that account)
- [ ] `MY_TIMEZONE` in `script.js`
- [ ] `PROFILE_DATA.instagram` in `script.js` (or just delete the button if u dont want it)
- [ ] `ROBLOX_USER_ID` + `ROBLOX_PROFILE_URL` in `script.js`
- [ ] project chips in `index.html`
- [ ] icons in `icons/`
- [ ] `TRACKS` in `tracks.js`
