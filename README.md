# JW Retro Deck v1.3.0

Flat GitHub-Pages-ready PWA.

## What changed in v1.3

- Added a persistent multi-system **ROM Library** backed by IndexedDB.
- Import one or multiple ROM files; they remain in the Retro Deck library on that device.
- Automatic platform detection for common single-file formats:
  - Atari 2600
  - Nintendo NES
  - Super Nintendo / SNES
  - Game Boy / Game Boy Color / Game Boy Advance
  - Sega Mega Drive / Genesis
  - Sega Master System
  - Sega Game Gear
  - Nintendo 64
- Mega Drive/Genesis cartridge-header recognition (including internal game title where available).
- Game Boy, GBA and SNES internal-title recognition where available.
- SHA-1 and CRC32 fingerprints are stored with each ROM for future exact-match metadata/source integrations.
- Automatic cover-art matching against the Libretro thumbnail collection. A matched cover is saved into IndexedDB with the ROM so it remains attached to the library entry.
- Adaptive EmulatorJS launcher selects the correct emulator core for the detected platform.
- Existing Retro Deck D-pad and four action buttons are retained as the outer controller. During ROM play the two centre system buttons become START and SELECT.
- Removed the visible imitation-game collection. Only **Snake** and **Table Tennis** remain as built-in quick games.
- Added a search/filter box for the user's ROM collection.
- Added a ROM details editor so title/platform can be corrected manually and cover matching can be retried.
- Added a source-search screen and adapter hook ready for an authorised ROM catalogue/source.

## ROM source integration

`rom-source.js` is intentionally unconfigured in this package. A source can be connected without changing the rest of the app by assigning:

```js
window.RETRO_DECK_ROM_SOURCE = {
  name: 'Source name',
  async search(query) {
    return [
      {
        id: 'source-id',
        title: 'Game title',
        platform: 'Sega Mega Drive',
        coverUrl: 'https://…',
        downloadUrl: 'https://…',
        fileName: 'Game (Europe).md'
      }
    ];
  }
};
```

A source may instead implement `download(result)` if download authentication or a custom request is required. Search results are rendered inside Retro Deck; selecting **INSTALL** downloads the ROM into the app's own IndexedDB library without redirecting to another site.

Only connect sources and ROM files you are authorised to access/use (for example your own dumps, homebrew/public-domain ROMs, or a service that grants download rights).

## Emulator engine

ROM play uses EmulatorJS through its stable CDN and selects a system core dynamically. On first use of a given core, an internet connection may be required for the emulator assets. The service worker caches successfully fetched assets for subsequent use where the browser permits it.

## Cover art

Retro Deck attempts title/filename matching against Libretro's public thumbnail repositories. If a match is found, the image is copied into the local IndexedDB record. Cover lookup therefore needs internet access the first time it runs.

## Install / deploy

Upload the **contents** of this ZIP to the root of your GitHub Pages repository (not the enclosing folder). The app remains a flat PWA: `index.html`, scripts, styles, manifest, service worker and image assets all sit at repository root.
