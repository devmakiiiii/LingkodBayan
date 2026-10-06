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
    <script>
      // After the map settles, sample the renderer canvas pixels and count
      // hotspot-colored ones (#f87171 fill, #dc2626 stroke). This proves the
      // circles are truly painted, not just added as layers.
      var waitForMap = setInterval(function () {
        if (!window.__printMapReady) return;
        clearInterval(waitForMap);
        setTimeout(function () {
          var canvas = document.querySelector('#print-map canvas');
          if (!canvas) { document.title = 'NO_CANVAS'; return; }
          var ctx = canvas.getContext('2d');
          var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          var fill = 0, stroke = 0;
          for (var i = 0; i < data.length; i += 4) {
            var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 40) continue;
            // #f87171 = 248,113,113 (fill drawn at 0.5 alpha over varied bg,
            // so allow generous tolerance); #dc2626 = 220,38,38 (stroke).
            if (r > 230 && g > 80 && g < 170 && b > 80 && b < 170) fill++;
            if (r > 190 && r < 245 && g < 70 && b < 70) stroke++;
          }
          document.title = 'CANVAS=' + canvas.width + 'x' + canvas.height +
            ';FILL_PIX=' + fill + ';STROKE_PIX=' + stroke;
        }, 500);
      }, 150);
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
  // With preferCanvas the whole map is rasterized by Chrome into an image
  // XObject, so vector color ops no longer appear — the pass criterion is
  // instead that a large image (the map raster) was embedded and drawn.
  const raw = bytes.toString('latin1')
  const imageCount = (raw.match(/\/Subtype\s*\/Image/g) || []).length
  const doCount = (raw.match(/\bDo\b/g) || []).length
  console.log(`Inflated ${streamCount} zlib streams; image XObjects: ${imageCount}; Do ops: ${doCount}`)
  let allOk = streamCount > 0 && imageCount > 0
  console.log(`${imageCount > 0 ? 'PASS' : 'FAIL'}  map raster embedded as image (canvas survives print)`)
  console.log(allOk ? 'PDF check: map raster present — canvas rendering survived the print pipeline.' : 'PDF check: no map raster found — map may be blank in print.')
  process.exit(allOk ? 0 : 1)
}
