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

export const fonts = [
  { id: 'classico', name: 'Classico', url: '/fonts/serif.json' },
  { id: 'elegante', name: 'Elegante', url: '/fonts/elegante.json' },
  { id: 'moderno', name: 'Moderno', url: '/fonts/moderno.json' },
]

/**
 * Modelli 3D configurabili. `model` è un GLB qualsiasi (asse Y in alto): viene riscalato
 * all'altezza reale `height` (mm). Sostituendo il file si sostituisce il prodotto.
 */
export const products = [
  {
    id: 'vaso-alto', name: 'Vaso Onda', detail: 'Alto · 320 mm', model: '/models/vaso-onda-alto.glb', height: 320,
    mark: { heightPct: 18, size: 62 },
    description: 'Silhouette slanciata con otto onde sovrapposte. Elemento iconico per hall e suite.',
  },
  {
    id: 'vaso-basso', name: 'Vaso Onda', detail: 'Basso · 200 mm', model: '/models/vaso-onda-basso.glb', height: 200,
    mark: { heightPct: 24, size: 58 },
    description: 'Forma raccolta a dodici petali, pensata per tavoli, reception e centrotavola.',
  },
  {
    id: 'portaspazzolini', name: 'Portaspazzolini', detail: 'Bagno · 115 mm', model: '/models/portaspazzolini.glb', height: 115,
    mark: { heightPct: 30, size: 40 },
    description: 'Contenitore aperto per il piano lavabo, con onda alta e base pulita per il marchio.',
  },
]

export const demoMark = { line1: 'GRAND HOTEL', line2: "PARKER'S", stars: 5, font: 'classico' }

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
