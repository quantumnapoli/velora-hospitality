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
- `src/catalog.js` — prodotti configurabili (GLB + altezza reale in mm), finiture, font, marchio demo.
- `src/three/core.js` — caricamento GLB (meshopt), mappa cilindrica della superficie,
  vettorializzazione loghi (SVG / PNG / JPG), estrusione e avvolgimento sulla superficie.
- `src/three/studio.js` — scena del configuratore, trascinamento del marchio, export STL/PNG.
- `src/three/hero.js` — vaso animato nella hero.
- `scripts/build-models.mjs` — genera i vasi procedurali (provvisori) e li comprime con gltfpack.

## Sostituire un modello con quello definitivo
Esporta il GLB con asse Y in alto, mettilo in `public/models/` e aggiorna `model` e `height`
(mm reali) in `src/catalog.js`. Scala, appoggio a terra e mappa della superficie su cui si avvolge
il logo sono calcolati automaticamente; `mark.heightPct` e `mark.size` impostano la posizione iniziale.
Sono supportati GLB normali o compressi meshopt (gltfpack).
