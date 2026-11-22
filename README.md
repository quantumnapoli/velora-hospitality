# Velora — 3D Design Objects

Sito vetrina + configuratore 3D (React 19, three.js r160, esbuild, Netlify Forms).

```
npm install
npm run dev      # http://127.0.0.1:4173
npm run build    # → dist/
npm run models   # rigenera i GLB provvisori in public/models
```

## Struttura
- `src/app.jsx` — pagina: hero 3D, configuratore, collezione, materiali, settori, preventivo.
- `src/catalog.js` — prodotto standard (GLB, altezza reale, posizione del logo, prompt), finiture.
- `src/three/core.js` — caricamento GLB (meshopt), mappa cilindrica della superficie,
  vettorializzazione loghi (SVG / PNG / JPG), estrusione e avvolgimento sulla superficie.
- `src/three/studio.js` — scena del configuratore e vista fissa inviata al generatore.
- `netlify/functions/render.mts` — proxy verso OpenRouter (la chiave resta sul server).
- `src/three/hero.js` — vaso animato nella hero.
- `scripts/build-models.mjs` — genera i vasi procedurali (provvisori) e li comprime con gltfpack.

## Flusso del configuratore
Un solo prodotto standard (`product` in `src/catalog.js`): il cliente carica soltanto il logo.
Posizione, area massima del logo (`mark.box`), medaglione, spessore e colori sono fissati nel catalogo.
1. Il logo (SVG, PNG, JPG, WebP) viene vettorializzato, estruso e avvolto sul medaglione: anteprima 3D.
2. "Genera immagine definitiva" invia a `/api/render` (funzione Netlify `netlify/functions/render.mts`)
   una vista frontale fissa del 3D e il logo; la funzione chiama l'Image API di OpenRouter (`POST /api/v1/images`) e restituisce la foto.

Variabili d'ambiente su Netlify (scope **Functions**, poi rifare il deploy):
- `OPENROUTER_API_KEY` — obbligatoria.
- `OPENROUTER_IMAGE_MODEL` — facoltativa, default `openai/gpt-image-2.6-flare`. Deve essere un modello
  dell'Image API di OpenRouter che accetta `input_references` (immagini di riferimento).
Il prompt è in `product.render.prompt`. Limite: 6 generazioni al minuto per IP.

## Sostituire un modello con quello definitivo
Esporta il GLB con asse Y in alto, mettilo in `public/models/` e aggiorna `model` e `height`
(mm reali) di `product` in `src/catalog.js`. Scala, appoggio a terra e mappa della superficie su cui si avvolge
il logo sono calcolati automaticamente; `mark.heightPct`, `mark.box` e `mark.medallion` fissano posizione e misure del logo.
Sono supportati GLB normali o compressi meshopt (gltfpack).
