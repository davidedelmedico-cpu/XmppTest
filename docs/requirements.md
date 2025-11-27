# Web XMPP Client – Initial Requirements

## Stack
- **Frontend framework:** React + Vite (fast tooling, easy GitHub Pages deploy, great TS support)
- **Language:** TypeScript for stronger typing around XMPP protocol objects
- **State management:** React hooks + lightweight context (no heavy store needed yet)

## XMPP Library
- **Choice:** [`stanza`](https://github.com/legastero/stanza)
  - Browser-focused, handles WebSocket/BOSH, good plugin ecosystem
  - Simple registration/login helpers
  - Actively maintained and pure JS (no native bindings)

## Immediate Features
1. In-band account registration (XEP-0077) against configurable server
2. Username/password login to existing XMPP account
3. Basic presence/connection status indicator to confirm successful auth

## Design Guidelines
- Take inspiration from WhatsApp/Telegram web layout (clean sidebar + main panel)
- Responsive but desktop-first for now; mobile tweaks can follow
- Neutral palette, subtle shadows, legible typography

## Hosting/Distribution
- Static build suitable for GitHub Pages (pure HTML/CSS/JS bundle)
- No backend required unless future features demand it

## Notes & Next Steps
- Pick a public XMPP host that allows in-band registration for demo (e.g., `jabber.hot-chilli.net`)
- After login flow works, extend to roster view and chat threads
