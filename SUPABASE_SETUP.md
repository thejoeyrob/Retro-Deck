# Retro Deck Supabase connection

The PWA runs locally without Supabase. The cloud connection enables the one-tap catalogue flow: search My Abandonware, select a supported console title, fetch its selected game file on the server, store it in a private Supabase Storage bucket, then import the file and cover into the device's IndexedDB collection.

## Required Supabase setup

1. Create a dedicated Supabase project for Retro Deck.
2. In Authentication, enable anonymous sign-ins.
3. Deploy `SUPABASE_EDGE_FUNCTION_RETRODECK.ts` as an Edge Function named `retrodeck-catalog` with JWT verification enabled.
4. Keep the normal Supabase server environment variables available to the function. Do not put the service-role key in the PWA.
5. Put the project URL and publishable key in `retrodeck-config.js`.
6. Redeploy the PWA. The Discover screen will automatically switch from local-file fallback to one-tap cloud import.

The Edge Function creates a private `retrodeck-private` Storage bucket on first use and issues short-lived signed URLs. Cloud objects are partitioned by the authenticated anonymous user ID.

## Front-end config

```js
window.RETRO_DECK_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_KEY',
  functionName: 'retrodeck-catalog'
};
```

No server secret belongs in GitHub Pages or any public JavaScript file.
