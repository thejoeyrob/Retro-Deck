# JW Retro Deck v2.0.0

Root-flat installable PWA for a personal retro ROM collection with a purpose-built console interface.

## Library / menu
- Console-skin-linked main menu: Nintendo Grey, Super Famicom, Game Boy, Master System, Portable Black, Switch Neon, Carbon Black and Neon Circuit each drive the library colour/material scheme as well as the game shell.
- Netflix-style featured rail above the collection. It loops automatically, supports swipe/previous/next navigation, and can show Jump Back In, favourite/most-played titles and personalised suggestions.
- Recommendations use the user's installed titles, chosen favourites, play counts, platforms and genre/franchise similarity.
- Featured artwork and collection artwork use independent/stable object URLs so the featured panel no longer causes the collection tile artwork to disappear.
- Favourite toggle added to game details.
- Three-column mobile cover collection, live filtering, 15-game paging and same-screen discovery.
- `Retro Deck 50`: 50 acclaimed, emulator-compatible classics are preloaded as discovery metadata and recommendation candidates. Commercial ROM binaries are not bundled.
- Improved cover matching using title variants, ROM filename/internal title, fuzzy Libretro box-art matching and a secondary web-art fallback.

## Jump Back In / local progress
- EmulatorJS state snapshots are captured to local IndexedDB on normal game exit and periodically during play where the active core supports state capture.
- A Jump Back In feature appears when a saved state exists and starts the game with that state preloaded.
- Save data and ROMs remain on the user's device; they are not written into the app repository.

## Gameplay
- Starting a game switches Retro Deck into a dedicated full-screen game state. Exit the game to return to the library.
- Portrait: screen above, fixed D-pad/stick and action geometry below.
- Landscape: movement left, game centre, action buttons right.
- Game video keeps the platform/native aspect ratio and uses the largest practical display area without stretching.
- Movement control can be D-pad or self-centring analog stick.
- Button colour presets: SNES, NES, Game Boy, GBA, DS, Switch and Master System.

## Bluetooth / wired controllers
- Standard browser Gamepad API support with automatic mapping plus manual per-command remapping.
- Controller display mode removes the virtual console shell and maximises the game picture.
- Default exit from controller display is triple-press R3; this can be reassigned.
- Touch overlay in controller mode is OFF by default. It can be enabled in Controller Setup.

## iOS / installed PWA touch handling
- Gameplay/control shell disables iOS text-selection flashes, callouts, tap highlights and accidental context menus.
- Search fields, text inputs, textareas and editable app fields remain normal.

## ROM / catalogue policy
- Commercial ROMs are not automatically downloaded or bundled. `Retro Deck 50` preloads title/platform/year/recommendation metadata and original box-art lookup candidates.
- Select a catalogue title and add a ROM copy you own.
- Automatic import remains available for sources explicitly marked redistributable/public-domain.
- Mountain King is bundled from the ROM supplied directly by the owner for this build.
- Snake and Table Tennis remain included Retro Deck Originals.

## Deployment
Upload the files from this ZIP directly to the repository root. The service-worker cache is versioned `v2.0.0` so the installed PWA replaces v1.9 assets after activation.
