/*
  Retro Deck cloud connection.
  Leave blank for local-only mode. A dedicated Supabase project can be
  connected later without changing the rest of the PWA.
*/
window.RETRO_DECK_CONFIG = Object.assign({
  supabaseUrl: '',
  publishableKey: '',
  functionName: 'retrodeck-catalog'
}, window.RETRO_DECK_CONFIG || {});
