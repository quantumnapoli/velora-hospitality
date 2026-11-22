import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import * as esbuild from 'esbuild'

const serve = process.argv.includes('--serve')
await rm('dist', { recursive: true, force: true })
await mkdir('dist/fonts', { recursive: true })
await cp('public', 'dist', { recursive: true })

// Font tipografici per i marchi in rilievo: solo i glifi latini (riduce ~70% del peso).
const fonts = {
  serif: 'node_modules/three/examples/fonts/droid/droid_serif_regular.typeface.json',
  elegante: 'node_modules/three/examples/fonts/optimer_regular.typeface.json',
  moderno: 'node_modules/three/examples/fonts/helvetiker_bold.typeface.json',
}
for (const [name, path] of Object.entries(fonts)) {
  const font = JSON.parse(await readFile(path, 'utf8'))
  font.glyphs = Object.fromEntries(Object.entries(font.glyphs).filter(([char]) => {
    const code = char.codePointAt(0)
    return code >= 0x20 && code <= 0x17f || '’‘“”–—·•€'.includes(char)
  }))
  await writeFile(`dist/fonts/${name}.json`, JSON.stringify(font))
}

const options = {
  entryPoints: { app: 'src/app.jsx' },
  bundle: true,
  external: ['/images/*'],
  splitting: true,
  format: 'esm',
  minify: !serve,
  sourcemap: serve,
  outdir: 'dist',
  jsx: 'automatic',
  target: 'es2022',
  legalComments: 'none',
}
if (serve) {
  const context = await esbuild.context(options)
  await context.watch()
  const { port } = await context.serve({ servedir: 'dist', host: '127.0.0.1', port: 4173 })
  console.log(`http://127.0.0.1:${port}`)
} else {
  await esbuild.build(options)
}
