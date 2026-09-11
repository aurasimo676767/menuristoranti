# Oliva — Menu digitale

Menu dimostrativo responsive per un ristorante, realizzato in HTML, CSS e JavaScript senza dipendenze o build. Pronto per Vercel: framework **Other**, directory principale della repository, nessun comando di build.

## Personalizzazione

- `index.html`: nome, logo testuale, presentazione, indirizzo, orari e coperto.
- `app.js`: categorie, piatti, prezzi, foto, etichette e allergeni.
- `style.css`: stili di base. `menu.css`: design della carta, indice laterale, righe dei piatti e scheda dettagli mobile. Le animazioni rispettano la preferenza di movimento ridotto.

Foto illustrative da Unsplash e caratteri da Google Fonts richiedono accesso a Internet. Il locale, l'indirizzo e il menu sono dimostrativi: sostituire con dati reali e verificare ingredienti e allergeni con il ristorante prima dell'uso pubblico.

## Anteprima

Aprire `index.html` nel browser oppure servire la cartella con un server statico, per esempio `python -m http.server 8080`.

## QR

Dopo il deploy, il QR dovrà contenere l'URL pubblico stabile del sito (o il dominio del locale). Il menu è accessibile senza login, installazione o scansione aggiuntiva. Usando lo stesso URL, le modifiche al menu non richiedono di ristampare il QR.
