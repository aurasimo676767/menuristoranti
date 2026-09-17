# Da Andrea BBQ — Menu e area amministratore

Menu pubblico in HTML/CSS/JavaScript e gestione riservata in `/admin`. Le API Node.js sono compatibili con Vercel; i dati sono salvati in Upstash Redis tramite API REST. Non ci sono dipendenze runtime da installare.

## Funzioni

- Piatti: nome, prezzo, descrizione, ingredienti, formato, disponibilità, categoria e ordine.
- Categorie: aggiunta, modifica, eliminazione, ordine e visualizzazione delle aggiunte nei dettagli.
- Bozza salvata sul server, anteprima dei contenuti e pubblicazione esplicita.
- Ultime 20 versioni precedenti alla pubblicazione, recuperabili nella bozza.
- Esportazione della bozza in JSON per conservarne una copia.

I piatti non disponibili vengono esclusi anche dalla ricerca pubblica. Eliminare una categoria elimina i suoi piatti nella bozza. L'ultima categoria non può essere eliminata. Il listino delle aggiunte mostrato nei dettagli rimane definito in `app.js`; la gestione admin riguarda le voci e le categorie del menu, compresa la categoria Extra.

## Attivazione su Vercel

1. Nel progetto Vercel, collega un database **Upstash Redis** dal Marketplace/Storage, oppure crea un database nel tuo account Upstash. Usa un database persistente.
2. Aggiungi nelle **Environment Variables** del progetto:

   | Variabile | Valore |
   | --- | --- |
   | `UPSTASH_REDIS_REST_URL` | URL HTTPS REST del database |
   | `UPSTASH_REDIS_REST_TOKEN` | Token REST con accesso in lettura e scrittura |
   | `ADMIN_PASSWORD_HASH` | Generato al punto seguente |
   | `ADMIN_SESSION_SECRET` | Generato al punto seguente |
   | `MENU_STORE_PREFIX` | Per esempio `andrea-menu-production` |

3. Nel terminale locale esegui `node scripts/admin-secrets.cjs`. Scegli e conferma una password di almeno 8 caratteri. Il comando crea in `.local/` un file con hash della password, segreto di sessione e prefisso del menu. Copia le tre variabili in Vercel. La password non viene stampata né salvata. `.local/` è esclusa da Git e deploy.
4. Mantieni framework **Other**, nessun comando di build e output alla radice. Usa Node.js **24.x**. Pubblica il codice ed esegui un nuovo deploy dopo aver impostato le variabili.
5. Apri `https://TUO-DOMINIO/admin` e accedi con la password scelta. Il primo accesso carica il menu attuale come punto di partenza, senza importazione manuale.
6. Modifica un piatto, salva la bozza e verifica che il menu pubblico non cambi. Controlla l'anteprima, pubblica, poi apri il menu in un'altra scheda e verifica il nuovo contenuto.

Non mettere segreti in HTML, JavaScript pubblico o nel repository. `.env.example` contiene solo i nomi delle variabili. Per Preview e Production usa database distinti o almeno valori diversi di `MENU_STORE_PREFIX`, oltre a password e segreti diversi. Una Preview collegata allo stesso prefisso della Production modificherebbe gli stessi dati.

Documentazione: [Vercel — variabili d'ambiente](https://vercel.com/docs/environment-variables), [Vercel — funzioni Node.js](https://vercel.com/docs/functions/runtimes/node-js), [Upstash — API REST e credenziali](https://upstash.com/docs/redis/features/restapi).

Se l'integrazione crea `KV_REST_API_URL` e `KV_REST_API_TOKEN`, sono riconosciuti automaticamente: non serve rinominarli. Se sono presenti entrambe le coppie complete, prevale quella `UPSTASH_REDIS_REST_*`.

## Uso quotidiano

### Statistiche delle visite

La pagina pubblica carica Vercel Web Analytics da `/_vercel/insights/script.js`, con l'integrazione HTML senza pacchetti o build aggiuntivi. Le pagine admin sono escluse. Abilita Web Analytics nel progetto Vercel e distribuisci il codice dopo l'attivazione. Per verificare la raccolta, visita il dominio pubblico senza blocchi dei contenuti e controlla la richiesta Analytics `view` nella scheda Network del browser e i dati nel pannello Vercel. Lo script è servito dalla piattaforma: non è disponibile nel server locale.

### Offerte programmate

Apri **Offerte** nell’amministrazione oppure `/admin/offerte`. Questa pagina usa lo stesso accesso del menu, ma bozze, revisioni e pubblicazione sono separate: pubblicare le offerte non pubblica le modifiche ai piatti e viceversa.

Puoi creare fino a 12 offerte con titolo, descrizione/condizioni, prezzo facoltativo, foto facoltativa e date di inizio e fine. Le date seguono il fuso `Europe/Rome`: l’offerta parte alle 00:00 del giorno iniziale e rimane valida per tutto il giorno finale, anche al cambio dell’ora legale. I pulsanti **7 giorni** e **1 mese** compilano la scadenza; puoi modificarla liberamente.

Le foto JPG, PNG e WebP (massimo 15 MB in ingresso) vengono ridimensionate nel browser fino a 960 pixel e compresse in JPEG prima del salvataggio. Sono conservate insieme alle offerte nel database esistente, senza nuovi servizi o credenziali. Ogni foto occupa al massimo circa 98 KB; la raccolta delle offerte è limitata a 1,2 MB serializzati. Le offerte non hanno uno storico versioni: usa **Scarica copia della bozza** per conservarne una copia.

**Applica alla bozza** aggiorna la pagina, **Salva bozza** conserva il lavoro, **Pubblica offerte** attiva la programmazione. Le offerte scadute restano nell’admin; puoi modificarle, duplicarle (la copia parte disattivata) o eliminarle. Abilitazione, disattivazione e ordine diventano pubblici dopo **Pubblica offerte**.

Le offerte attive sono nella pagina `/offerte`, raggiungibile dal pulsante fisso con fiamma e conteggio. La home mostra un invito compatto con il numero delle offerte una volta per sessione della scheda, indipendentemente dalla precedente opzione popup delle singole offerte. Senza offerte attive, invito e pulsante scompaiono; la pagina dedicata mostra un messaggio con rimando al menu. La pagina ricontrolla le offerte ogni minuto e quando torna visibile. Le animazioni rispettano la preferenza di movimento ridotto. L’API espone solo offerte pubblicate e attive, mai bozze, programmate o scadute.

Apri `/admin` direttamente: non ci sono link all'amministrazione nel menu pubblico. La protezione dipende dall'autenticazione server, non dall'indirizzo nascosto.

**Applica alla bozza** aggiorna il lavoro nella pagina. **Salva bozza** lo conserva sul server. **Pubblica modifiche** salva e rende visibile il menu ai clienti che aprono o ricaricano la pagina. Chiudere una scheda con modifiche non salvate mostra un avviso.

**Ripristina in bozza** recupera una versione precedente senza cambiare subito il menu pubblico. Controllala e pubblicala quando è pronta. Le versioni precedenti vengono create a ogni pubblicazione, incluso il menu iniziale alla prima pubblicazione.

Se un'altra persona ha salvato dopo il tuo accesso, il server rifiuta la sovrascrittura: scarica una copia della bozza, ricarica dal server e riapplica le tue modifiche. Se la sessione scade, accedi di nuovo nella stessa pagina per conservare il lavoro aperto. Dopo un errore di connessione, ricarica dal server per verificare se il salvataggio è stato ricevuto prima di ripetere l'operazione.

Per cambiare password esegui nuovamente il generatore, aggiorna le due variabili su Vercel e ridistribuisci il progetto. Le vecchie sessioni diventano invalide.

## Sviluppo e verifiche

Requisito: Node.js 24. Copia `.env.example` in `.env.local` e configura un database di sviluppo con prefisso separato. Avvia `npm run dev` e apri `http://127.0.0.1:3000/admin`. Il server locale espone soltanto i file pubblici e le API previste, e ascolta sull'interfaccia locale.

Il menu pubblico si può aprire anche da `index.html`: in questo caso usa `menu-data.js`. Online, con archivio non configurato, viene usato il menu incluso; con archivio configurato ma irraggiungibile viene mostrato un messaggio di indisponibilità, per evitare prezzi vecchi o piatti rimossi.

```text
npm test
npm run check:menu
node scripts/check-browser.cjs [percorso-modulo-playwright] [eseguibile-chromium]
node scripts/check-admin-browser.cjs [percorso-modulo-playwright] [eseguibile-chromium]
node scripts/check-offers-browser.cjs [percorso-modulo-playwright] [eseguibile-chromium]
```

I test admin avviano le API locali e un simulatore HTTP del contratto Redis; non usano account o dati di produzione. Coprono autenticazione, CSRF, revoca, limiti di login, validazione, conflitti, bozze, pubblicazione, storico e indisponibilità del database. I test browser coprono il flusso completo, sessione scaduta e layout a più larghezze. Il collegamento a Upstash e il deploy Vercel vanno verificati dopo la configurazione reale.

## Dati e protezione

- `menu-data.js`: menu iniziale condiviso tra browser e server. Dopo l'attivazione dell'admin, le pubblicazioni online sono nel database e prevalgono sul file. L'importazione del menu iniziale rimane in `scripts/import-menu.cjs`.
- `api/admin.js`: endpoint privato; password verificata con scrypt, cookie HttpOnly/Secure/SameSite, token CSRF e controllo dell'origine.
- `api/menu.js`: espone soltanto l'ultima pubblicazione con piatti disponibili, mai la bozza o lo storico.
- `server/menu-store.js`: validazione e salvataggi atomici con confronto della revisione; storico limitato a 20 pubblicazioni precedenti.
- Sessioni di 8 ore, revoca all'uscita e massimo 10 tentativi di login per indirizzo in 15 minuti.
- Cache disabilitata per API e amministrazione; pagina admin esclusa dall'indicizzazione e protetta da embedding tramite CSP.

Il database deve mantenere i dati senza scadenza o eviction delle chiavi del menu. Un redeploy non cancella il menu nel database. Cambiare database o prefisso riparte invece dal menu incluso nel codice: conserva il collegamento di produzione e le copie esportate.
