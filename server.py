from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


CONFIG: dict[str, Any] = {
    "roblox_user_endpoint": "https://users.roblox.com/v1/users/{user_id}",
    "roblox_thumb_endpoint": "https://thumbnails.roblox.com/v1/users/avatar-headshot",
    "thumb_size": "150x150",
    "cache_ttl_seconds": 300,
    "request_timeout": 6.0,
}

_roblox_cache: dict[int, tuple[float, dict[str, Any]]] = {}

async def fetch_roblox_profile(user_id: int) -> dict[str, Any]:

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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/api/roblox/{user_id}")
async def get_roblox_profile(user_id: int) -> dict[str, Any]:
    return await fetch_roblox_profile(user_id)

app.mount("/", StaticFiles(directory=".", html=True), name="static")