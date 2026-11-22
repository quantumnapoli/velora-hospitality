let database
function open() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('forma-ospite', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('project')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return database
}

export async function projectStore(value) {
  const db = await open()
  const transaction = db.transaction('project', value ? 'readwrite' : 'readonly')
  const store = transaction.objectStore('project')
  const request = value ? store.put(value, 'current') : store.get('current')
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function traceLogo(file) {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)
  const transparent = data.some((value, index) => index % 4 === 3 && value < 32)
  const isInk = (x, y) => {
    const i = (y * width + x) * 4
    return transparent ? data[i + 3] >= 128 : data[i + 3] >= 128 && (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) < 128
  }
  const runs = []
  for (let y = 0; y < height; y++) {
    let start = -1
    for (let x = 0; x <= width; x++) {
      if (x < width && isInk(x, y)) {
        if (start === -1) start = x
      } else if (start !== -1) {
        runs.push(`M${start} ${y}h${x - start}v1H${start}z`)
        start = -1
      }
    }
  }
  if (!runs.length) throw new Error('No logo silhouette detected. Try a high-contrast mark.')
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path d="${runs.join('')}"/></svg>`], { type: 'image/svg+xml' })
}
