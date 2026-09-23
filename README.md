# JW Retro Deck v1.4.0

Flat GitHub-Pages-ready PWA.

## v1.4 highlights

- Keeps **Snake** and **Table Tennis** as the only visible built-in quick games.
- Persistent multi-system ROM collection stored in IndexedDB.
- Automatic ROM platform/header recognition and SHA-1/CRC32 fingerprinting.
- Adaptive EmulatorJS launching for Atari 2600, NES, SNES, Game Boy/Color/Advance, Mega Drive/Genesis, Master System, Game Gear and Nintendo 64.
- Original-style box/front-cover matching through Libretro thumbnail repositories; matched artwork is copied into the local library record.
- **My Abandonware catalogue search** is wired into the existing in-app source-search screen.
- Catalogue results are shown in Retro Deck. Selecting **ADD ROM** opens the device file picker, then the chosen ROM is stored in Retro Deck with the selected catalogue title/platform/year and automatic cover matching.
- The My Abandonware integration is metadata/catalogue-only. It does not retrieve or expose third-party ROM download URLs.
- The adapter attempts a direct read-only catalogue request first. If browser CORS blocks that public HTML page, it can fall back to the public AllOrigins metadata relay; the relay is used only to read catalogue HTML, never to retrieve game files. If both paths are unavailable, local ROM import remains available. A small offline metadata seed supports Streets of Rage 1/2/3 and Road Rash as a graceful fallback/demo.

## ROM library

Supported common single-file formats include `.a26`, `.bin`, `.rom`, `.nes`, `.unf`, `.unif`, `.sfc`, `.smc`, `.fig`, `.gb`, `.gbc`, `.gba`, `.md`, `.gen`, `.smd`, `.68k`, `.sms`, `.gg`, `.z64`, `.n64` and `.v64`.

Mega Drive/Genesis header recognition means a correctly dumped Streets of Rage cartridge file can normally be identified as Sega Mega Drive/Genesis even when the filename itself is generic.

## My Abandonware source workflow

1. Tap **SEARCH SOURCE**.
2. Search for a game title, for example `Streets of Rage`.
3. Choose the catalogue match.
4. Tap **ADD ROM**.
5. Pick the ROM file you already have on the device.
6. Retro Deck stores the ROM locally, detects the platform, adds catalogue metadata and searches for matching box art.
7. The game then appears as a cover thumbnail in **YOUR COLLECTION** and launches through the matching emulator core.

No browser redirect is required for the catalogue/result selection flow.

## Install / deploy

Upload the **contents** of this ZIP to the root of the GitHub Pages repository. Do not upload the enclosing folder. The build remains flat: `index.html`, scripts, styles, service worker, manifest and images are all at root level.
