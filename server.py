"""
Nexesmere portfolio — backend.

Wraps the static profile site in a tiny web service so the roblox preview
can hit roblox's api server-side. Browsers can't call it directly — roblox's
api never sends back Access-Control-Allow-Origin, so the request gets
blocked by CORS before the response ever reaches JS. A server has no such
restriction, so this just fetches it here and hands the clean result back.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ===================================================================
# CONFIG
# ===================================================================
CONFIG: dict[str, Any] = {
    "roblox_user_endpoint": "https://users.roblox.com/v1/users/{user_id}",
    "roblox_thumb_endpoint": "https://thumbnails.roblox.com/v1/users/avatar-headshot",
    "thumb_size": "150x150",
    "cache_ttl_seconds": 300,  # profiles don't change second to second, no reason to hammer roblox's api every load
    "request_timeout": 6.0,
}

# ===================================================================
# STATE
# ===================================================================
_roblox_cache: dict[int, tuple[float, dict[str, Any]]] = {}  # user_id -> (fetched_at, payload)

# ===================================================================
# HELPERS
# ===================================================================
async def fetch_roblox_profile(user_id: int) -> dict[str, Any]:
    """Pulls username / display name / bio + headshot url server-side, where CORS doesn't apply."""
    cached = _roblox_cache.get(user_id)
    if cached and (time.time() - cached[0]) < CONFIG["cache_ttl_seconds"]:
        return cached[1]

    async with httpx.AsyncClient(timeout=CONFIG["request_timeout"]) as client:
        user_resp = await client.get(CONFIG["roblox_user_endpoint"].format(user_id=user_id))
        if user_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="roblox user lookup failed")
        user_data = user_resp.json()

        thumb_resp = await client.get(
            CONFIG["roblox_thumb_endpoint"],
            params={
                "userIds": user_id,
                "size": CONFIG["thumb_size"],
                "format": "Png",
                "isCircular": "false",
            },
        )
        thumb_url = None
        if thumb_resp.status_code == 200:
            entries = thumb_resp.json().get("data") or []
            if entries:
                thumb_url = entries[0].get("imageUrl")

    payload = {
        "username": user_data.get("name"),
        "displayName": user_data.get("displayName"),
        "bio": user_data.get("description") or "",
        "pfp": thumb_url,
    }
    _roblox_cache[user_id] = (time.time(), payload)
    return payload

# ===================================================================
# CORE LOGIC / ROUTES
# ===================================================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # read-only public roblox data, nothing sensitive riding along with it
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/roblox/{user_id}")
async def get_roblox_profile(user_id: int) -> dict[str, Any]:
    return await fetch_roblox_profile(user_id)


# mounted last so the /api routes above always take priority over the catch-all
app.mount("/", StaticFiles(directory=".", html=True), name="static")

#  _   _                                                   
# | \ | |  ___ __  __ ___  ___  _ __ ___    ___  _ __  ___ 
# |  \| | / _ \\ \/ // _ \/ __|| '_ ` _ \  / _ \| '__|/ _ \
# | |\  ||  __/ >  <|  __/\__ \| | | | | ||  __/| |  |  __/
# |_| \_| \___|/_/\_\___||___/|_| |_| |_| \___||_|   \___|
#                                          Proporty Of @Nexesmere.


