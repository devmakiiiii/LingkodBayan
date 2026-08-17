const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote',
])

const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'class', 'id', 'style',
])

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
        if (attrName === 'href' && /^javascript:/i.test(value)) {
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
