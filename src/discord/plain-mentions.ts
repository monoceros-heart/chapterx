/**
 * Turn plain `@Name` text into real Discord mentions.
 *
 * The context builder shows mentions to the model as `@DisplayName` (see
 * context/stages/mentions.ts), so the model writes them back the same way.
 * Discord treats that as plain text: nobody is pinged, and a mentioned bot
 * never activates. This is the reverse of that rewrite, for names the channel
 * has seen.
 *
 * Only known names are linked, longest first, so "@Claude of the Pantheon"
 * wins over "@Claude". A match must start the text or follow a non-word
 * character (so foo@bar.com is left alone) and must end at a non-word
 * character. Code spans and fenced blocks are left as written.
 */

/** Lowercased name → Discord user ID. */
export type MentionNames = Map<string, string>

const CODE = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function linkPlainMentions(content: string, names: MentionNames): string {
  if (names.size === 0 || !content.includes('@')) return content

  const alternatives = [...names.keys()]
    .filter((n) => n.length > 0)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
  if (alternatives.length === 0) return content
  const pattern = new RegExp(`(^|[^\\w<])@(${alternatives.join('|')})(?![\\w])`, 'giu')

  const link = (text: string) =>
    text.replace(pattern, (match, before: string, name: string) => {
      const id = names.get(name.toLowerCase())
      return id ? `${before}<@${id}>` : match
    })

  // Link only the text between code spans and fenced blocks.
  let out = ''
  let last = 0
  for (const m of content.matchAll(CODE)) {
    out += link(content.slice(last, m.index)) + m[0]
    last = m.index! + m[0].length
  }
  return out + link(content.slice(last))
}
