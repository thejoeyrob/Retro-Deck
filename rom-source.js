/*
  JW Retro Deck ROM source adapter.

  This build deliberately ships without a third-party ROM download source.
  To connect an authorised/public-domain/homebrew source, replace or extend this
  file and assign window.RETRO_DECK_ROM_SOURCE to an adapter shaped like:

  {
    name: 'My Game Source',
    async search(query) {
      return [{ id, title, platform, coverUrl, downloadUrl, fileName }];
    },
    // Optional. If omitted Retro Deck fetches result.downloadUrl itself.
    async download(result) {
      return Blob | ArrayBuffer | File;
    }
  }

  The UI never needs to redirect the player away from Retro Deck.
*/
window.RETRO_DECK_ROM_SOURCE = window.RETRO_DECK_ROM_SOURCE || null;
window.registerRetroDeckRomSource = function registerRetroDeckRomSource(adapter){
  window.RETRO_DECK_ROM_SOURCE = adapter || null;
  window.dispatchEvent(new CustomEvent('retrodeck-source-changed'));
};
