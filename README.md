# JW Retro Deck v1.6.0

Flat GitHub Pages-ready PWA, rebuilt around a premium game-collection surface rather than a generic web dashboard.

## Highlights
- Three-column cover library with reactive title filtering and 15-game / five-row pagination
- Same-page **Collection** and **Discover** navigation — no catalogue pop-up required
- Strongly relevance-filtered My Abandonware title search so exact searches do not fill with unrelated popular games
- Full keyboard text entry in search fields without game-control keys swallowing letters
- Automatic artwork lookup using Libretro box-art first, with Wikipedia artwork fallback
- Portrait case slots that preserve original cover proportions and use a textured/blurred fill behind square artwork
- Clear **Collection**, **Find game**, **Import**, **Find artwork**, and **Show more** actions
- Existing IndexedDB ROM collection, system detection, EmulatorJS controls, Snake and Table Tennis preserved
- Optional Retro Deck Cloud client plus Supabase Edge Function source for authenticated background catalogue import and private storage

## Deploy the PWA
Upload the contents of this ZIP to the repository root. Existing locally stored ROMs remain in the browser database when the deployed site keeps the same origin.

## Optional one-tap cloud import
The PWA works without Supabase by falling back to local file selection. For server-side catalogue import, use `SUPABASE_SETUP.md` and deploy `SUPABASE_EDGE_FUNCTION_RETRODECK.ts` to a dedicated Retro Deck Supabase project. Keep the service-role key server-side only.

Only add game files you are legally entitled to use.
