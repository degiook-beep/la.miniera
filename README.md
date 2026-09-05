# La Miniera — repo

App web per l'inventario per locali/container/box/oggetti, con navigazione esplosa e cattura foto.
Frontend statico + modulo Drive lato browser (OAuth "a gettone", scope minimo `drive.file`).

## Struttura
- `index.html` — l'applicazione (single file, dati in `localStorage`).
- `drive.js` — modulo storage/Drive (OAuth Google, upload contestuale, sync catalogo JSON).
- `vercel.json` — config host.

## Modalità storage (degradazione automatica)
1. **Drive** — se hai messo il Google Client ID e sei connesso: le foto full-res vanno sul **tuo** Drive nella cartella `La Miniera - Inbox`, con nome contestuale `BOX__Pn__oggetto__timestamp.jpg`; in locale resta il thumbnail.
2. **Condividi** — fallback: dallo scatto puoi usare il menù di sistema (dove supportato).
3. **Locale** — minimo: thumbnail solo sul dispositivo. Funziona sempre.

L'app funziona **al 100% anche senza Drive**. Il Drive è un innesto opzionale.

---

## A) Deploy su Vercel (host solido, gratis)
1. Crea un repository su **GitHub** e carica questi file (index.html, drive.js, vercel.json).
2. Vai su **vercel.com** → *Add New Project* → importa il repo GitHub.
3. Framework preset: **Other** (è statico). Deploy. Otterrai un URL tipo `https://la-miniera-xxxx.vercel.app`.
   - Ad ogni push su GitHub, Vercel ri-deploya da solo (versionamento vero).

## B) Google OAuth (per la modalità Drive) — una tantum
1. **console.cloud.google.com** → crea un progetto (o usane uno).
2. *API e servizi* → **Abilita** la **Google Drive API**.
3. *Schermata consenso OAuth*: tipo **Esterno**; compila i campi minimi; aggiungi te stesso come **utente di test**.
4. *Credenziali* → **Crea credenziali** → **ID client OAuth** → tipo **Applicazione web**.
   - **Origini JavaScript autorizzate**: incolla l'URL Vercel **esatto** (es. `https://la-miniera-xxxx.vercel.app`), senza slash finale.
   - (Redirect URI non serve per questo flusso a gettone.)
5. Copia l'**ID client** (`....apps.googleusercontent.com`).

## C) Collega e prova
1. Apri il sito Vercel sul telefono/PC → **Impostazioni · Drive**.
2. Incolla l'**ID client** → *Salva ID* → *Connetti Drive* (accetta i permessi Google).
3. Apri un oggetto → **Scatta / scegli foto reale**. La foto full-res sale su `La Miniera - Inbox`; il thumbnail resta in locale.
4. *Sincronizza catalogo su Drive* salva anche il catalogo (JSON) sul tuo Drive.

## Note oneste
- Il gettone Google lato browser dura ~1 ora; il rinnovo è **silenzioso** finché la sessione Google è viva. Un rinnovo *davvero* permanente (refresh token) richiede una piccola funzione serverless: è il passo successivo (cartella `api/`).
- Con `drive.file` l'app vede solo ciò che crea: perciò usa una **sua** cartella `La Miniera - Inbox` (non quella `1 - Da processare` creata dal connettore). Chi processa in chat ha comunque accesso completo al Drive e la legge senza problemi.
- Il riconoscimento (oggetti + ritagli HD) resta un passaggio **in chat** finché non c'è un backend con chiave API. Questa build fa **cattura + storage**, non riconoscimento automatico.
- La modalità Drive richiede **https** (Vercel): da `file://` locale parte il fallback.

## Roadmap
- `api/refresh` — funzione serverless per il refresh token duraturo.
- `api/recognize` — engine di riconoscimento (usa la chiave API dell'utente): legge l'Inbox, genera i ritagli HD, riscrive i risultati; l'app li recepisce al refresh.
