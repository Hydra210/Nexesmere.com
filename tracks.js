// ===================================================================
// CFG: TRACKS
// -------------------------------------------------------------------
// Table of background tracks for the site. Playback order = the
// order they're listed here — the playlist loops back to the top
// after the last entry plays. File NAMES don't matter anymore (no
// more track1.mp4/track2.mp3 naming rules) since every entry gives
// its own direct URL.
//
// type must be "video" for .mp4 (shows as the background video) or
// "audio" for .mp3/.wav/etc (audio-only, no background video swap).
//
// With only one entry, script.js will just loop that single track
// natively instead of crossfading it into itself.
//
// credits: @Nexesmere
// ===================================================================

const TRACKS = [
  { url: "https://pub-a17495cad61f41da8d8e455e1292573b.r2.dev/track1.mp4", type: "video" },
];
