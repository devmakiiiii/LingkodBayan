// Temporary structural validator for charter SQL migrations.
// Splits statements at semicolons that are OUTSIDE strings/comments/dollar-quotes,
// then checks paren balance and quote parity per statement.
const fs = require('fs')

let problems = 0
for (const file of process.argv.slice(2)) {
  const text = fs.readFileSync(file, 'utf8')
  const stmts = []
  let cur = ''
  let inStr = false
  let inComment = false
  let dollar = null
  let depth = 0
  let line = 1
  let stmtStart = 1

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n') {
      line++
      if (inComment) inComment = false
      cur += ch
      continue
    }
    if (inComment) { cur += ch; continue }
    if (dollar !== null) {
      if (text.startsWith(dollar, i)) { cur += dollar; i += dollar.length - 1; dollar = null; continue }
      cur += ch; continue
    }
    if (inStr) {
      if (ch === "'") {
        if (text[i + 1] === "'") { cur += "''"; i++; continue }
        inStr = false
      }
      cur += ch; continue
    }
    if (ch === '-' && text[i + 1] === '-') { inComment = true; cur += ch; continue }
    if (ch === "'") { inStr = true; cur += ch; continue }
    if (ch === '$') {
      const m = /^\$[A-Za-z_0-9]*\$/.exec(text.slice(i))
      if (m) { dollar = m[0]; cur += m[0]; i += m[0].length - 1; continue }
    }
    if (ch === '(') depth++
    if (ch === ')') {
      depth--
      if (depth < 0) { console.log(`${file}:${line} unbalanced ')'`); problems++ ; depth = 0 }
    }
    if (ch === ';') {
      stmts.push({ sql: cur + ';', start: stmtStart })
      cur = ''
      stmtStart = line + 1
      continue
    }
    cur += ch
  }

  if (inStr) { console.log(`${file}: unterminated string at EOF`); problems++ }
  if (dollar !== null) { console.log(`${file}: unterminated dollar-quote ${dollar} at EOF`); problems++ }
  if (depth !== 0) { console.log(`${file}: paren depth ${depth} at EOF`); problems++ }

  let checked = 0
  for (const { sql, start } of stmts) {
    const body = sql.replace(/--[^\n]*/g, '')
    if (!body.trim() || body.trim().startsWith('---')) continue
    checked++
    let open = 0, close = 0, quotes = 0, inS = false
    for (let i = 0; i < body.length; i++) {
      const ch = body[i]
      if (inS) { if (ch === "'") { if (body[i + 1] === "'") { i++; continue } inS = false }; continue }
      if (ch === "'") { inS = true; quotes++; continue }
      if (ch === '(') open++
      if (ch === ')') close++
    }
    const first = body.trim().split('\n')[0].slice(0, 60)
    if (open !== close) { console.log(`${file}:${start} paren imbalance (${open}/${close}): ${first}`); problems++ }
    const quoteChars = (body.match(/'/g) || []).length
    if (quoteChars % 2 !== 0) { console.log(`${file}:${start} odd quote chars (${quoteChars}): ${first}`); problems++ }
  }
  console.log(`${file}: statements=${checked} problems=${problems}`)
}
process.exit(problems ? 1 : 0)
