export const finishes = [
  { id: 'ivory', name: 'Bianco Avorio', color: '#e5d9c9', roughness: .66, metalness: 0 },
  { id: 'sand', name: 'Sabbia', color: '#b89e81', roughness: .71, metalness: 0 },
  { id: 'blue', name: 'Azzurro Neutro', color: '#80939f', roughness: .63, metalness: 0 },
  { id: 'graphite', name: 'Grafite', color: '#393938', roughness: .61, metalness: 0 },
]

const references = [
  ['Vaso scultoreo alto', 'Tall sculptural vase', 'vases', 'A sweeping silhouette for lobbies and suites.'],
  ['Posacenere', 'Sculptural ashtray', 'ashtray', 'A low, flowing profile with an integrated rest.'],
  ['Portaspazzolini', 'Toothbrush holder', 'oral-care', 'An open vessel for the bathroom vanity.'],
  ['Portafazzoletti', 'Tissue box cover', 'tissue', 'A sculpted cover with a discreet slot.'],
  ['Set cortesia', 'Amenity tray', 'amenities', 'A compact tray for bath and welcome essentials.'],
  ['Targa camera', 'Room sign', 'room-sign', 'A softly profiled sign for guest room numbers.'],
  ['Centrotavola', 'Centre­piece', 'centerpiece', 'An openwork bowl for tables and reception spaces.'],
  ['Vaso scultoreo piccolo', 'Small sculptural vase', 'vases', 'The compact form shown in the vase family.'],
  ['Vaso scultoreo medio', 'Medium sculptural vase', 'vases', 'The intermediate form shown in the vase family.'],
  ['Custodia spazzolino', 'Toothbrush case', 'oral-care', 'The closed companion shown in the oral-care set.'],
]

export const products = references.map(([name, label, image, description], index) => ({
  id: String(index + 1).padStart(2, '0'),
  name,
  label,
  description,
  image: `/images/${image}.webp`,
  model: null,
  finishMaterials: [],
  engraving: null,
}))

export const integration = {
  engravingEndpoint: null,
  roomRenderEndpoint: null,
}
