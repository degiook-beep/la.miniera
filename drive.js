/* =========================================================================
   La Miniera — modulo storage / Google Drive (lato browser, senza server)
   - OAuth "a gettone" con Google Identity Services, scope minimo drive.file
   - Upload full-res contestuale nella cartella "La Miniera - Inbox"
   - Catalogo (JSON) sincronizzato sul Drive dell'utente
   - Degradazione: Drive -> (Condividi) -> Locale
   Nota: richiede il sito servito in HTTPS (Vercel) e un Google Client ID
         il cui "authorized JavaScript origin" corrisponda all'URL del sito.
   ========================================================================= */
(function () {
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var CLIENT_ID = localStorage.getItem('miniera:gclient') || '';
  var tokenClient = null, accessToken = null, tokenExp = 0, inboxId = null, catalogId = null, afterAuth = null;
  var S = (window.MineraStorage = {});

  S.getClientId = function () { return CLIENT_ID; };
  S.setClientId = function (id) { CLIENT_ID = (id || '').trim(); localStorage.setItem('miniera:gclient', CLIENT_ID); accessToken = null; tokenClient = null; if (CLIENT_ID) init(); if (S.onStatus) S.onStatus(); };
  S.isDriveReady = function () { return !!(CLIENT_ID && accessToken && Date.now() < tokenExp); };
  S.canShare = function () { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob()], 'x.jpg', { type: 'image/jpeg' })] })); } catch (e) { return false; } };
  S.mode = function () { return S.isDriveReady() ? 'drive' : (CLIENT_ID ? 'drive-off' : (S.canShare() ? 'share' : 'local')); };

  function loadGis(cb) {
    if (window.google && google.accounts && google.accounts.oauth2) return cb();
    var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client';
    s.onload = function () { cb(); }; s.onerror = function () { cb(new Error('gis')); };
    document.head.appendChild(s);
  }
  function init() {
    if (!CLIENT_ID) return;
    loadGis(function (err) {
      if (err) return;
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPE,
        callback: function (resp) {
          if (resp && resp.access_token) {
            accessToken = resp.access_token;
            tokenExp = Date.now() + ((resp.expires_in ? resp.expires_in * 1000 : 3600000) - 60000);
            ensureInbox();
            if (S.onStatus) S.onStatus();
            if (afterAuth) { var f = afterAuth; afterAuth = null; f(); }
          }
        }
      });
    });
  }
  // richiesta interattiva (bottone "Connetti")
  S.connect = function (cb) {
    if (!CLIENT_ID) { alert('Inserisci prima il Google Client ID nelle impostazioni.'); return; }
    afterAuth = cb || null;
    var ask = function () { tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' }); };
    if (tokenClient) ask(); else { init(); setTimeout(function () { if (tokenClient) ask(); }, 700); }
  };
  // rinnovo silenzioso del gettone (finché la sessione Google è viva)
  S.ensureToken = function (cb) {
    if (S.isDriveReady()) return cb && cb();
    afterAuth = cb || null;
    if (tokenClient) tokenClient.requestAccessToken({ prompt: '' });
    else { init(); setTimeout(function () { if (tokenClient) tokenClient.requestAccessToken({ prompt: '' }); }, 700); }
  };

  function api(url, opts) {
    opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + accessToken }, opts.headers || {});
    return fetch(url, opts).then(function (r) { if (r.status === 401) { accessToken = null; throw new Error('token'); } return r; });
  }
  function ensureInbox() {
    if (inboxId) return Promise.resolve(inboxId);
    var q = "mimeType='application/vnd.google-apps.folder' and name='La Miniera - Inbox' and trashed=false";
    return api('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.files && j.files.length) { inboxId = j.files[0].id; return inboxId; }
        return api('https://www.googleapis.com/drive/v3/files?fields=id', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'La Miniera - Inbox', mimeType: 'application/vnd.google-apps.folder' })
        }).then(function (r) { return r.json(); }).then(function (j2) { inboxId = j2.id; return inboxId; });
      }).catch(function () { return null; });
  }

  // upload foto full-res con nome contestuale; ritorna {id,name}
  S.uploadPhoto = function (file, name) {
    return ensureInbox().then(function () {
      var meta = { name: name, parents: inboxId ? [inboxId] : undefined };
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', file);
      return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', { method: 'POST', body: form })
        .then(function (r) { return r.json(); });
    });
  };

  // catalogo JSON: salva/aggiorna
  S.saveCatalog = function (obj) {
    if (!S.isDriveReady()) return Promise.resolve(false);
    var content = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    return ensureInbox().then(function () {
      if (catalogId) {
        return api('https://www.googleapis.com/upload/drive/v3/files/' + catalogId + '?uploadType=media', { method: 'PATCH', body: content }).then(function () { return true; });
      }
      var q = "name='la-miniera-catalog.json' and trashed=false";
      return api('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.files && j.files.length) { catalogId = j.files[0].id; return api('https://www.googleapis.com/upload/drive/v3/files/' + catalogId + '?uploadType=media', { method: 'PATCH', body: content }).then(function () { return true; }); }
          var meta = { name: 'la-miniera-catalog.json', parents: inboxId ? [inboxId] : undefined };
          var form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
          form.append('file', content);
          return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form })
            .then(function (r) { return r.json(); }).then(function (j2) { catalogId = j2.id; return true; });
        });
    }).catch(function () { return false; });
  };
  S.loadCatalog = function () {
    if (!S.isDriveReady()) return Promise.resolve(null);
    var q = "name='la-miniera-catalog.json' and trashed=false";
    return api('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!(j.files && j.files.length)) return null; catalogId = j.files[0].id; return api('https://www.googleapis.com/drive/v3/files/' + catalogId + '?alt=media').then(function (r) { return r.json(); }); })
      .catch(function () { return null; });
  };

  if (CLIENT_ID) init();
})();
