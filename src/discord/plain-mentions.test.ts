import { describe, it, expect } from 'vitest'
import { linkPlainMentions, type MentionNames } from './plain-mentions.js'

const CLAUDE = '1555031232415535295'
const OPUS = '1559316309362212914'
const names: MentionNames = new Map([
  ['claude of the pantheon', CLAUDE],
  ['claudepantheon', CLAUDE],
  ['claude', '300000000000000003'],
  ['opus of the pantheon', OPUS],
])

describe('linkPlainMentions', () => {
  it('links the message that motivated this: a display name with spaces', () => {
    expect(linkPlainMentions("@Claude of the Pantheon, hello. I'm Opus.", names))
      .toBe(`<@${CLAUDE}>, hello. I'm Opus.`)
  })

  it('prefers the longest known name', () => {
    expect(linkPlainMentions('hi @Claude of the Pantheon and @Claude', names))
      .toBe(`hi <@${CLAUDE}> and <@300000000000000003>`)
  })

  it('matches usernames, case-insensitively', () => {
    expect(linkPlainMentions('@claudepantheon?', names)).toBe(`<@${CLAUDE}>?`)
  })

  it('leaves unknown names, emails and partial words alone', () => {
    const text = '@nobody mail me at me@claude.ai or ping @Claudette'
    expect(linkPlainMentions(text, names)).toBe(text)
  })

  it('leaves code spans and fenced blocks alone', () => {
    const text = 'see `@Claude` and\n```\n@Opus of the Pantheon\n```\nthen @Claude'
    expect(linkPlainMentions(text, names))
      .toBe('see `@Claude` and\n```\n@Opus of the Pantheon\n```\nthen <@300000000000000003>')
  })

  it('leaves existing <@...> mentions to resolveMentions', () => {
    expect(linkPlainMentions('<@ClaudePantheon> hi', names)).toBe('<@ClaudePantheon> hi')
  })
})

describe('DiscordConnector.resolveMentions with plain @Name', () => {
  it('links names from the channel cache, but never the bot itself', async () => {
    const { DiscordConnector } = await import('./connector.js')
    const { EventQueue } = await import('../agent/event-queue.js')
    const { mkdtempSync, rmSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const cacheDir = mkdtempSync(join(tmpdir(), 'plain-mentions-test-'))
    try {
      const connector = new DiscordConnector(new EventQueue(), { token: 'fake', cacheDir, maxBackoffMs: 100 })
      const msg = (id: string, username: string, displayName: string) =>
        ({ author: { id, username, globalName: null }, member: { displayName } })
      ;(connector as any).client = { user: { id: OPUS }, channels: { fetch: async () => ({}) } }
      ;(connector as any).messageCache.set('ch', [
        msg(CLAUDE, 'ClaudePantheon', 'Claude of the Pantheon'),
        null,
        msg(OPUS, 'OpusPantheon', 'Opus of the Pantheon'),
      ])
      const out = await (connector as any).resolveMentions(
        "@Claude of the Pantheon, hello. I'm @Opus of the Pantheon.", 'ch')
      expect(out).toBe(`<@${CLAUDE}>, hello. I'm @Opus of the Pantheon.`)
    } finally {
      rmSync(cacheDir, { recursive: true, force: true })
    }
  })
})
