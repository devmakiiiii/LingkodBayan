/**
 * Dev-only probe (not imported anywhere): generates the print report with mock
 * clustered complaints and writes it to a local file so the map can be
 * inspected in a browser without logging into the app.
 *
 * Run with: npx tsx scripts/print-map-probe.ts
 */
import { buildComplaintsHotspotMapScript } from '../lib/admin-reporting'
import { BARANGAY_BARRETTO_CENTER } from '../lib/barangay-map'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// Three clusters of 3 reports each near the barangay centre (~200 m apart), so
// every cluster should trip the >= 2 threshold and draw a hotspot circle.
const complaints = Array.from({ length: 9 }, (_, i) => {
  const cluster = i % 3
  const jitter = (i % 3) * 0.0008
  return {
    latitude: BARANGAY_BARRETTO_CENTER[0] + (cluster === 0 ? 0.002 : cluster === 1 ? -0.003 : 0.004) + jitter,
    longitude: BARANGAY_BARRETTO_CENTER[1] + (cluster === 0 ? 0.001 : cluster === 1 ? -0.002 : 0.003) + jitter,
    status: ['pending', 'processing', 'resolved'][cluster],
    subject: `Cluster ${cluster + 1} complaint #${i + 1}`,
  }
})

const mapScript = buildComplaintsHotspotMapScript(complaints)

const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="/leaflet/leaflet.css" />
    <style>
      body { margin: 0; }
      #print-map { width: 1000px; height: 640px; border: 1px solid #cbd5e1; background: #e2e8f0; }
      /* Mirrors the print popup's print-color rules in openPrintableReport —
         keep the two in sync when changing print fidelity settings. */
      @media print {
        html, body, #print-map, #print-map * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    </style>
  </head>
  <body>
    <div id="print-map"></div>
    <script src="/leaflet/leaflet.js"><\/script>
    <script>
      ${mapScript}
    <\/script>
  </body>
</html>`

// public/ is served by the dev server; dot-folders are not. The probe must be
// reachable at /print-probe/index.html so Leaflet and the tiles load normally.
mkdirSync('public/print-probe', { recursive: true })
writeFileSync('public/print-probe/index.html', html)
console.log('Wrote public/print-probe/index.html — open http://localhost:3000/print-probe/index.html')

/**
 * When run with `--check-pdf <path>`, decompresses the PDF's content streams
 * and reports which fill colors actually made it into the print output —
 * proving whether the hotspot circles survived print rendering.
 */
if (process.argv.includes('--check-pdf')) {
  const pdfPath = process.argv[process.argv.indexOf('--check-pdf') + 1]
  const bytes = readFileSync(pdfPath)
  const colors = new Set<string>()
  let streamCount = 0
  // Chrome emits colors as single-digit-leading floats (".9725 .4431 .4431 rg"),
  // so collect every `r g b rg|RG` op from every zlib stream we can inflate.
  for (let i = 0; i < bytes.length - 8; i++) {
    if (!(bytes[i] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(bytes[i + 1]))) continue
    try {
      const inflated = inflateSync(bytes.subarray(i, bytes.length))
      streamCount += 1
      const text = inflated.toString('latin1')
      for (const m of text.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (?:rg|RG)\b/g)) {
        colors.add(`${m[1]} ${m[2]} ${m[3]}`)
      }
      // Do NOT skip ahead after a successful inflate: a false-positive header
      // can inflate into garbage and skipping it would jump over real streams.
    } catch {
      /* false-positive zlib header; keep scanning */
    }
  }
  const expected: Record<string, string[]> = {
    'hotspot fill #f87171': ['.9725', '.4431'],
    'pin pending #ef4444': ['.9373', '.2667'],
    'pin processing #eab308': ['.9176', '.7020'],
    'pin resolved #22c55e': ['.1333', '.7686'],
    'boundary stroke #1d4ed8': ['.1137', '.3059'],
  }
  console.log(`Inflated ${streamCount} zlib streams; distinct rg/RG colors: ${colors.size}`)
  let allOk = streamCount > 0
  for (const [label, [r, g]] of Object.entries(expected)) {
    const hit = [...colors].some((c) => c.startsWith(`${r} ${g}`))
    console.log(`${hit ? 'PASS' : 'FAIL'}  ${label}`)
    if (!hit) allOk = false
  }
  console.log('Colors found:', [...colors].slice(0, 40).join(' | ') || '(none)')
  console.log(allOk ? 'PDF check: all expected colors present.' : 'PDF check: MISSING COLORS — hotspots likely stripped.')
  process.exit(allOk ? 0 : 1)
}
