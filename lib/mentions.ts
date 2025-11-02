/**
 * Utility functions for handling @mentions in chat
 */

/**
 * Extract @mentions from a message text
 * Returns array of usernames (without @)
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(text)) !== null) {
    const username = match[1]
    if (username && !mentions.includes(username)) {
      mentions.push(username)
    }
  }

  return mentions
}

/**
 * Render message with highlighted mentions
 * Returns JSX-ready array with text and mention spans
 */
export function renderMessageWithMentions(
  content: string,
  highlightClass: string = 'text-accent font-medium'
): Array<{ type: 'text' | 'mention'; content: string }> {
  const parts: Array<{ type: 'text' | 'mention'; content: string }> = []
  const mentionRegex = /@(\w+)/g
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
      })
    }

    // Add mention
    parts.push({
      type: 'mention',
      content: match[0], // Includes @
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    })
  }

  // If no mentions, return the whole content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content })
  }

  return parts
}

