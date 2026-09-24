# JW Retro Deck v1.7.0

A root-flat installable PWA for hosting and playing a personal retro ROM collection with a console-class interface.

## Core library
- Three-column cover library with live filtering and 15-game paging.
- Local ROM import, metadata editing, artwork lookup and same-screen discovery.
- IndexedDB storage for imported games.
- EmulatorJS-based playback for supported systems plus the included Retro Deck originals.

## Controller support
Retro Deck uses the browser Gamepad API for compatible Bluetooth and wired controllers. Pair the controller in the device's Bluetooth/USB settings, open Retro Deck and press any controller button.

- Standard controller auto-map.
- D-pad plus optional left-stick navigation.
- Face buttons, L1/R1, L2/R2, Start and Select routing.
- Per-command manual remapping: Adjust -> press button -> release -> press the same button again to confirm.
- Persistent saved controller configuration.
- Controller display mode removes the on-screen console hardware and maximises the game image.
- Default controller-display exit: triple-press R3. This is user-assignable.

## Screen behaviour
- Portrait touch mode: game above, large controls below.
- Landscape touch mode: D-pad left, game centre, action controls right.
- Controller mode: game-only display with platform aspect ratio preserved.
- Rotation never pauses or restarts gameplay.

## Deployment
Upload the files in this ZIP directly to the repository root. Do not upload the containing folder.

The service worker cache name is versioned at v1.7.0 so an existing deployment will replace the older shell after the new service worker activates.
