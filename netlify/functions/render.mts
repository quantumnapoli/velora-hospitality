import type { Config, Context } from '@netlify/functions'
import { product } from '../../src/catalog.js'

/**
 * Immagine "definitiva": riceve la vista 3D del prodotto con il logo e il logo originale,
 * chiede a un modello di generazione immagini via OpenRouter una foto fotorealistica.
 *
 * Variabili d'ambiente (Netlify → Project configuration → Environment variables, scope Functions):
 *   OPENROUTER_API_KEY      obbligatoria
 *   OPENROUTER_IMAGE_MODEL  facoltativa, id del modello OpenRouter (default sotto)
 */
const DEFAULT_MODEL = 'openai/gpt-5-image'
const MAX_IMAGE = 2_500_000 // caratteri di data URL per immagine (~1,8 MB)

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const isImage = (value: unknown): value is string =>
  typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= MAX_IMAGE

/** Le risposte con immagini arrivano in `message.images` oppure come parti del contenuto. */
function findImage(message: any): string | null {
  const candidates = [
    ...(Array.isArray(message?.images) ? message.images : []),
    ...(Array.isArray(message?.content) ? message.content : []),
  ]
  for (const part of candidates) {
    const url = part?.image_url?.url ?? part?.url ?? (part?.b64_json && `data:image/png;base64,${part.b64_json}`)
    if (typeof url === 'string' && (url.startsWith('data:image/') || url.startsWith('https://'))) return url
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
  if (!isImage(body.preview) || !isImage(body.logo)) return json({ error: 'Immagini mancanti o troppo grandi.' }, 400)

  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(55_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': context.site?.url ?? 'https://velora-hospitality.netlify.app',
        'X-Title': 'Velora configuratore',
      },
      body: JSON.stringify({
        model: Netlify.env.get('OPENROUTER_IMAGE_MODEL') || DEFAULT_MODEL,
        modalities: ['image', 'text'],
        image_config: { aspect_ratio: '4:5' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: product.render.prompt },
            { type: 'image_url', image_url: { url: body.preview } },
            { type: 'image_url', image_url: { url: body.logo } },
          ],
        }],
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
  const image = findImage(data?.choices?.[0]?.message)
  if (!image) {
    console.error('OpenRouter senza immagine', JSON.stringify(data).slice(0, 500))
    return json({ error: 'Il modello non ha restituito un\'immagine.' }, 502)
  }
  return json({ image, model: data?.model ?? null })
}

export const config: Config = {
  path: '/api/render',
  method: 'POST',
  // ogni generazione costa credito: limite per IP
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
