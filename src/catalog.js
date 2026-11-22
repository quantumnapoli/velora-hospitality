export const finishes = [
  { id: 'avorio', name: 'Bianco Avorio', color: '#e9dfd0', roughness: .72 },
  { id: 'sabbia', name: 'Sabbia', color: '#c4a98a', roughness: .74 },
  { id: 'azzurro', name: 'Azzurro Neutro', color: '#8597a3', roughness: .68 },
  { id: 'grafite', name: 'Grafite', color: '#3b3a38', roughness: .6 },
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
  description: 'Silhouette slanciata con otto onde sovrapposte, stampata in 3D con finitura minerale opaca. Il marchio della struttura compare in rilievo su un medaglione ovale.',
  mark: { heightPct: 18, angle: 0, box: { w: 56, h: 38 }, depth: 1.2, medallion: { w: 84, h: 56 }, tone: 'grafite' },
  render: {
    prompt: [
      'Create a photorealistic product photograph of the exact vase shown in the first image.',
      'Keep its shape, proportions and the overlapping sculptural swirls exactly as they are, with a matte ivory mineral finish like fine 3D-printed stone.',
      'On the front of the vase there is a smooth oval medallion carrying the logo in raised relief (about 1 mm), in the same position and size as in the first image.',
      'The logo must be reproduced faithfully from the second image: same letters, symbols, shapes and proportions, dark graphite colour. Do not invent, translate or add any text or element.',
      'Setting: luxury hotel bathroom vanity in warm beige marble, soft warm daylight from the left, subtle reflections, shallow depth of field, elegant editorial interior photography.',
      'Vertical 4:5 composition, the whole vase centred and fully visible, no people, no watermark.',
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
