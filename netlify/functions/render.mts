import type { Config, Context } from '@netlify/functions'
import { finishes, product } from '../../src/catalog.js'

/**
 * Immagine "definitiva": riceve il logo e la finitura scelta; al modello passa la foto del vaso reale
 * (servita dal sito stesso) e il logo, con l'istruzione di incidere il logo nel medaglione.
 * Usa l'Image API dedicata (POST /api/v1/images): le due immagini vanno in `input_references`.
 *
 * Variabili d'ambiente (Netlify → Project configuration → Environment variables, scope Functions):
 *   OPENROUTER_API_KEY      obbligatoria
 *   OPENROUTER_IMAGE_MODEL  facoltativa, id del modello OpenRouter (default sotto)
 */
const DEFAULT_MODEL = 'openai/gpt-image-2.6-flare'
const MAX_IMAGE = 2_500_000 // caratteri di data URL per immagine (~1,8 MB)

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const isImage = (value: unknown): value is string =>
  typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= MAX_IMAGE

/** Image API: `data[].b64_json` (base64 senza prefisso) oppure `data[].url`. */
function findImage(data: any): string | null {
  for (const item of Array.isArray(data?.data) ? data.data : []) {
    if (typeof item?.b64_json === 'string' && item.b64_json) {
      const b64 = item.b64_json.replace(/^data:image\/\w+;base64,/, '')
      const type = b64.startsWith('/9j/') ? 'jpeg' : b64.startsWith('UklGR') ? 'webp' : 'png'
      return `data:image/${type};base64,${b64}`
    }
    if (typeof item?.url === 'string' && /^(https:|data:image\/)/.test(item.url)) return item.url
  }
  return null
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405)
  const apiKey = Netlify.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return json({ error: 'Generazione non configurata: manca OPENROUTER_API_KEY.' }, 503)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Richiesta non valida.' }, 400) }
  if (body?.product !== product.id) return json({ error: 'Prodotto sconosciuto.' }, 400)
  if (!isImage(body.logo)) return json({ error: 'Logo mancante o troppo grande.' }, 400)
  const finish = finishes.find(item => item.id === body.finish)
  if (!finish) return json({ error: 'Finitura sconosciuta.' }, 400)
  // https obbligatorio: OpenRouter scarica la foto di riferimento da qui
  const origin = (context.site?.url || new URL(req.url).origin).replace(/^http:\/\/(?!localhost|127\.)/, 'https://')
  const reference = new URL(product.render.reference, origin).href
  const prompt = product.render.prompt.replaceAll('{color}', `${finish.prompt} (${finish.color})`)

  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      signal: AbortSignal.timeout(58_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': origin,
        'X-Title': 'Velora configuratore',
      },
      body: JSON.stringify({
        model: Netlify.env.get('OPENROUTER_IMAGE_MODEL') || DEFAULT_MODEL,
        prompt,
        input_references: [
          { type: 'image_url', image_url: { url: reference } },
          { type: 'image_url', image_url: { url: body.logo } },
        ],
      }),
    })
  } catch (error) {
    const timeout = (error as Error)?.name === 'TimeoutError'
    return json({ error: timeout ? 'Il generatore non ha risposto in tempo. Riprova.' : 'Generatore non raggiungibile.' }, 504)
  }

  const data: any = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('OpenRouter', response.status, JSON.stringify(data?.error ?? data).slice(0, 500))
    const status = response.status === 402 ? 402 : response.status === 429 ? 429 : 502
    return json({ error: status === 402 ? 'Credito OpenRouter esaurito.' : status === 429 ? 'Troppe richieste, riprova tra poco.' : 'La generazione non è riuscita.' }, status)
  }
  const image = findImage(data)
  if (!image) {
    console.error('OpenRouter senza immagine', JSON.stringify(data).slice(0, 500))
    return json({ error: 'Il modello non ha restituito un\'immagine.' }, 502)
  }
  return json({ image, model: data?.model ?? Netlify.env.get('OPENROUTER_IMAGE_MODEL') ?? DEFAULT_MODEL })
}

export const config: Config = {
  path: '/api/render',
  method: 'POST',
  // ogni generazione costa credito: limite per IP
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
