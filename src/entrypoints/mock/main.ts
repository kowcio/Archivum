/**
 * Mock tab page script — sets tab title/favicon from query params so each mock tab
 * looks distinct in the tab strip and the options table, fully offline.
 * (Inline <script> is blocked by the extension CSP, hence a separate module.)
 */
const params = new URLSearchParams(location.search)

const title = params.get('title') || 'Mock tab'
document.title = title
document.querySelector('[data-testid="mock-title"]')!.textContent = title
document.querySelector('[data-testid="mock-src"]')!.textContent = params.get('src') ?? ''

// Only accept inline data: favicons — never trigger a network request.
const icon = params.get('icon')
if (icon?.startsWith('data:image/')) {
  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = icon
  document.head.append(link)
}
