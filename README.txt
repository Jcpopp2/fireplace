TV LED Studio — iPad PWA

WHAT THIS IS
This is a static Progressive Web App conversion of the TV LED Python editor.
It is designed for touch use on an iPad and can work offline after it has been loaded once.

FILES
- index.html
- styles.css
- app.js
- manifest.webmanifest
- sw.js
- icon-192.png / icon-512.png

HOW TO TRY IT ON A COMPUTER
A PWA/service worker should be served over HTTP rather than opened by double-clicking index.html.

From this folder:
    python -m http.server 8000

Then open:
    http://localhost:8000

HOW TO USE IT ON AN IPAD
The best route is to put this folder on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).
Then on the iPad:
1. Open the HTTPS URL in Safari.
2. Tap Share.
3. Tap "Add to Home Screen".
4. Launch TV LED Studio from the Home Screen once while online.
5. The service worker caches the editor so it can open offline later, including on a plane.

PROJECT COMPATIBILITY
The loader understands:
- V4/V5-style JSON with Sections -> Groups -> Frames
- older JSON with Groups
- older JSON with a flat Frames list

The PWA saves the same Sections -> Groups -> Frames concept and retains runtime_random metadata.

WHAT IS INCLUDED IN THIS FIRST PWA PORT
- Touch brush, select-brush, and erase
- 3-pane / 48-LED visual editor
- Sections -> Groups -> Frames
- Context-aware duplicate/delete/rename
- Move selected item up/down
- Generic Undo
- Playback preview
- Wipe, Comet, Gradient, Wave, Flame, Physics Bounce
- Fade In, Fade Out, Fade In + Out
- Shimmer In / Shimmer Out
- Effect color transitions
- Random Color
- Randomize Chosen Effect with MIN/MAX fields
- Randomize Everything
- JSON save/load
- Arduino code generation and .ino export
- Offline PWA shell/cache

NOTES
- This is a PWA, not an App Store-signed native iPad app.
- iPadOS installation requires serving the folder from HTTPS.
- Browser downloads on iPad go through Safari/Files.
- Drag/drop hierarchy movement has been represented as touch-friendly Move Up/Move Down controls in this initial port. That is a deliberate touch adaptation and can be upgraded to direct long-press drag in a later PWA version.


PWA V2 IPAD IMPROVEMENTS
- More compact landscape layout.
- Effect Generator scrolls independently in landscape mode.
- Sticky bottom controls remain reachable.
- Select Multiple mode for Sections, Groups, or Frames.
- Bulk Delete.
- Bulk Move Up / Move Down while preserving selected-item order.
