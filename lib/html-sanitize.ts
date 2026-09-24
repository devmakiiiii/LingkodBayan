const ALLOWED_TAGS = new Set([
  // Text and block elements
  'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins', 'sub', 'sup', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'hr',
  'ul', 'ol', 'li', 'span', 'div', 'a',
  // Media (TinyMCE image plugin)
  'img', 'figure', 'figcaption',
  // Tables (the announcements editor enables the TinyMCE table plugin)
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
])

const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'title', 'class', 'id', 'style',
  'src', 'alt', 'width', 'height', 'loading',
  'colspan', 'rowspan', 'scope',
])

// Attribute values are decoded before the scheme check so that obfuscated
// payloads such as `java&#115;cript:alert(1)` cannot slip through.
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&colon;/gi, ':')
    .replace(/&(tab|newline);/gi, '')
}

function normalizeUrlCandidate(value: string): string {
  return decodeEntities(value).replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase()
}

/**
 * Blocks executable URL schemes. `img src` additionally permits only inline
 * `data:image/*` payloads (TinyMCE can emit those for pasted images).
 */
function isSafeUrlAttribute(attrName: string, value: string): boolean {
  const candidate = normalizeUrlCandidate(value)

  if (attrName === 'src') {
    if (candidate.startsWith('data:')) {
      return candidate.startsWith('data:image/')
    }
    return !/^(javascript|vbscript):/.test(candidate)
  }

  if (attrName === 'href') {
    return !/^(javascript|vbscript|data):/.test(candidate)
  }

  return true
}

function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  const tagRegex = /<\/?([a-zA-Z0-9]+)([^>]*)>/g
  const result: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(html)) !== null) {
    const fullMatch = match[0]
    const tagName = match[1].toLowerCase()
    const attrsString = match[2]

    result.push(html.slice(lastIndex, match.index))

    if (tagName === 'br') {
      result.push('<br>')
      lastIndex = match.index + fullMatch.length
      continue
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      lastIndex = match.index + fullMatch.length
      continue
    }

    const sanitizedAttrs: string[] = []
    const attrRegex = /([a-zA-Z0-9\-:]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g
    let attrMatch: RegExpExecArray | null
    const seenAttrs = new Set<string>()

    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
      const attrName = attrMatch[1].toLowerCase()
      if (!ALLOWED_ATTRS.has(attrName) || seenAttrs.has(attrName)) {
        continue
      }
      seenAttrs.add(attrName)

      if (attrMatch[2]) {
        let value = attrMatch[2]
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (!isSafeUrlAttribute(attrName, value)) {
          continue
        }
        if (attrName === 'target' && value === '_blank') {
          sanitizedAttrs.push('target="_blank" rel="noopener noreferrer"')
          continue
        }
        sanitizedAttrs.push(`${attrName}="${value.replace(/"/g, '&quot;')}"`)
      } else {
        sanitizedAttrs.push(attrName)
      }
    }

    const isSelfClosing = ['br', 'img', 'hr', 'input'].includes(tagName)
    const tag = `<${tagName}${sanitizedAttrs.length > 0 ? ' ' + sanitizedAttrs.join(' ') : ''}>`

    if (fullMatch.startsWith('</')) {
      result.push(`</${tagName}>`)
    } else if (isSelfClosing) {
      result.push(`${tag}/>`)
    } else {
      result.push(tag)
    }

    lastIndex = match.index + fullMatch.length
  }

  result.push(html.slice(lastIndex))
  return result.join('')
}

export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html)
}
