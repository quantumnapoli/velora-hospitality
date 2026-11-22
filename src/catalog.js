export const finishes = [
  { id: 'avorio', name: 'Bianco Avorio', color: '#e9dfd0', roughness: .72, prompt: 'warm ivory white' },
  { id: 'sabbia', name: 'Sabbia', color: '#c4a98a', roughness: .74, prompt: 'warm sand beige' },
  { id: 'azzurro', name: 'Azzurro Neutro', color: '#8597a3', roughness: .68, prompt: 'muted powder blue-grey' },
  { id: 'grafite', name: 'Grafite', color: '#3b3a38', roughness: .6, prompt: 'deep graphite charcoal grey' },
]

export const markTones = [
  { id: 'tono', name: 'Tono su tono' },
  { id: 'grafite', name: 'Grafite', color: '#2f2d2a', roughness: .55, metalness: 0 },
  { id: 'oro', name: 'Oro satinato', color: '#c59b5f', roughness: .32, metalness: .9 },
]

/** Carattere del marchio d'esempio mostrato nella hero. */
export const heroFont = '/fonts/serif.json'

/**
 * Prodotto standard mostrato nel configuratore. Tutto è fissato da Velora: il cliente carica solo il logo.
 * - `model`: GLB con asse Y in alto, riscalato all'altezza reale `height` (mm).
 * - `mark.box`: area massima del logo (mm); il logo vi viene inscritto senza deformarlo.
 * - `mark.heightPct`: altezza del centro del marchio (% dell'altezza); `angle`: 0 = fronte.
 * - `mark.medallion`: medaglione ovale fisso (mm) oppure `null`.
 * - `render.prompt`: istruzioni per l'immagine definitiva (usate dalla funzione /api/render).
 */
export const product = {
  id: 'vaso-onda', name: 'Vaso Onda', detail: 'Alto · 320 mm', model: '/models/vaso-onda-alto.glb', height: 320,
  finish: 'avorio',
  description: 'Silhouette slanciata con otto onde sovrapposte, stampata in 3D con finitura minerale opaca. Il logo della struttura è inciso su un medaglione ovale, nello stesso colore del vaso.',
  mark: { heightPct: 18, angle: 0, box: { w: 56, h: 38 }, depth: 1.2, medallion: { w: 84, h: 56 }, tone: 'tono' },
  render: {
    // foto del pezzo reale: è la forma che l'immagine definitiva deve rispettare
    reference: '/images/vaso-riferimento.jpg',
    /** Prompt per l'Image API; `{color}` viene sostituito con la finitura scelta. */
    prompt: [
      'The first image is the exact product reference. Reproduce this same vase: identical silhouette, proportions, neck and lip, the same broad overlapping sculptural swirls and the smooth oval medallion near the base. Do not redesign or simplify the vase.',
      'Material: matte mineral 3D-printed stone with a very fine texture. Colour of the whole vase: {color}. The vase, the medallion and the logo are all this single colour.',
      'Inside the oval medallion, remove any existing text completely and place the logo from the second image, centred, about 70% of the medallion width, reproduced faithfully: same letters, symbols and proportions; do not add, translate or invent anything.',
      'The logo is ENGRAVED (debossed) about 1 mm into the surface, carved into the same material, the same colour as the vase, readable only through the soft shadows and highlights of the carved edges. No ink, no paint, no print, no contrasting colour.',
      'Setting: luxury hotel bathroom vanity in warm beige marble, soft warm daylight from the left, subtle reflections, shallow depth of field, elegant editorial interior photography.',
      'Vertical composition, the whole vase centred and fully visible, no people, no watermark.',
    ].join(' '),
  },
}

export const products = [product]

export const demoMark = { line1: 'GRAND HOTEL', line2: "PARKER'S", stars: 5 }

export const collection = [
  ['Vasi scultorei', 'Elementi iconici per hall e suite', 'vases'],
  ['Posacenere di design', 'Eleganza e funzionalità', 'ashtray'],
  ['Portaspazzolini', 'Igiene e stile in una forma compatta', 'oral-care'],
  ['Copri portafazzoletti', 'Custodia per box standard', 'tissue'],
  ['Set cortesia', 'Organizzazione raffinata', 'amenities'],
  ['Room sign', 'Segnaletica personalizzata', 'room-sign'],
  ['Centrotavola', 'Design scenografico', 'centerpiece'],
]

export const sectors = [
  ['Hotel & Resort', 'bed'],
  ['Ristoranti & Lounge', 'cloche'],
  ['SPA & Wellness', 'lotus'],
  ['Uffici & Hospitality', 'people'],
  ['Retail & Concept Store', 'bag'],
  ['Eventi & Fiere', 'star'],
]
