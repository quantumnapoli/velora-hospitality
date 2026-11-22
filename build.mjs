import { cp, mkdir } from 'node:fs/promises'
import * as esbuild from 'esbuild'

await mkdir('dist', { recursive: true })
await cp('public', 'dist', { recursive: true })
const options = {
  entryPoints: { app: 'src/app.jsx' },
  bundle: true,
  external: ['/images/*'],
  splitting: true,
  format: 'esm',
  minify: !process.argv.includes('--serve'),
  outdir: 'dist',
  jsx: 'automatic',
}
if (process.argv.includes('--serve')) {
  const context = await esbuild.context(options)
  await context.watch()
  console.log(await context.serve({ servedir: 'dist', host: '127.0.0.1', port: 4173 }))
} else {
  await esbuild.build(options)
}
