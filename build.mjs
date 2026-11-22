import { cp, mkdir, rm } from 'node:fs/promises'
import * as esbuild from 'esbuild'

const serve = process.argv.includes('--serve')
await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })
await cp('public', 'dist', { recursive: true })

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
