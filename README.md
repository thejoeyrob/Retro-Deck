# JW Retro Deck v1.9.0

Root-flat installable PWA for a personal retro ROM collection with a purpose-built console interface.

## Library / menu
- Console-style home with a large Continue/Ready spotlight for the most recent game.
- Three-column cover collection, live filtering, 15-game paging and same-screen discovery.
- Local ROM import with platform detection where possible.
- Improved cover matching using title variants, ROM filename/internal title, fuzzy Libretro box-art matching and a secondary web-art fallback.
- Imported ROM data is stored locally in IndexedDB.

## Gameplay
- Starting a game switches Retro Deck into a dedicated full-screen game state. The app library/header cannot remain visible behind the console.
- Exit the game to return to the library.
- Portrait: screen above, fixed D-pad/stick and action geometry below.
- Landscape: movement left, game centre, action buttons right.
- Game video keeps the platform/native aspect ratio and uses the largest practical display area without stretching.
- Movement control can be D-pad or self-centring analog stick.
- Button colour presets: SNES, NES, Game Boy, GBA, DS, Switch and Master System.

## Bluetooth / wired controllers
- Standard browser Gamepad API support with automatic mapping plus manual per-command remapping.
- Controller display mode removes the virtual console shell and maximises the game picture.
- Default exit from controller display is triple-press R3; this can be reassigned.
- Touch overlay in controller mode is OFF by default. It can be enabled in Controller Setup, after which tapping the game reveals transparent Menu / Select / Start controls.

## iOS / installed PWA touch handling
- Gameplay/control shell disables iOS text-selection flashes, callouts, tap highlights and accidental context menus.
- The protection is scoped to gameplay only, so search fields, text inputs, textareas and editable app fields remain normal.

## ROM / catalogue policy
- Game search is used for metadata and artwork discovery.
- Commercial ROMs are not automatically downloaded by Retro Deck. Select a result and choose a ROM copy you own.
- Automatic import can be used for a source explicitly marked redistributable/public-domain.
- Mountain King is bundled from the ROM supplied directly by the owner for this build.

## Deployment
Upload the files from this ZIP directly to the repository root. The service-worker cache is versioned `v1.9.0` so the prior installed shell is replaced after activation.
