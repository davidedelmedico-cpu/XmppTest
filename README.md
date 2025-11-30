# Alfred

<div align="center">

![Alfred Logo](web-client/public/favicon.svg)

**Client web XMPP moderno per messaggistica istantanea**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![XMPP](https://img.shields.io/badge/XMPP-Stanza.js-green?style=flat)](https://stanzajs.org/)

[Demo](#) | [Documentazione](docs/) | [Contributing](#contributing)

</div>

---

## 📋 Indice

- [Panoramica](#-panoramica)
- [Funzionalità](#-funzionalità)
- [Quick Start](#-quick-start)
- [Architettura](#-architettura)
- [Documentazione](#-documentazione)
- [Sviluppo](#-sviluppo)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Panoramica

**Alfred** è un client web XMPP moderno che porta la messaggistica istantanea nel browser con un'interfaccia pulita e performante.

### Caratteristiche Principali

- 🚀 **Veloce**: Apertura chat < 100ms grazie a cache locale completa
- 💾 **Offline-First**: Funziona anche senza connessione
- 🎨 **Design Moderno**: Interfaccia ispirata a Telegram/WhatsApp web
- 📱 **Responsive**: Ottimizzato per mobile e desktop
- 🔒 **Privacy**: Nessun tracking, dati locali criptati
- ⚡ **Performante**: Gestisce migliaia di messaggi senza lag

---

## ✨ Funzionalità

### Implementate ✅

- ✅ **Login XMPP** con popup glassmorphism
- ✅ **Lista conversazioni** con sincronizzazione ottimizzata
- ✅ **Chat 1-to-1** con invio/ricezione messaggi in real-time
- ✅ **Gestione vCard** (avatar, nomi, info contatti)
- ✅ **Pull-to-refresh** per sincronizzazione manuale
- ✅ **Cache locale** completa (IndexedDB)
- ✅ **Typing indicators** e presence
- ✅ **Message Archive Management** (MAM - XEP-0313)
- ✅ **Paginazione messaggi** con lazy loading
- ✅ **Ricerca conversazioni**
- ✅ **Profilo utente** con modifica vCard

### In Roadmap 🚧

- 🚧 **Chat di gruppo** (MUC - XEP-0045)
- 🚧 **Crittografia E2E** (OMEMO - XEP-0384)
- 🚧 **Condivisione file** (HTTP Upload - XEP-0363)
- 🚧 **Voice/Video calls** (Jingle - XEP-0166)
- 🚧 **Push notifications**
- 🚧 **PWA** con service worker
- 🚧 **Dark mode**
- 🚧 **Emoji picker**
- 🚧 **Markdown support**

---

## 🚀 Quick Start

### Prerequisiti

- **Node.js** >= 18.x
- **npm** >= 9.x
- Un account XMPP (es: su [conversations.im](https://account.conversations.im/))

### Installazione

```bash
# 1. Clona repository
git clone https://github.com/[your-username]/alfred.git
cd alfred/web-client

# 2. Installa dipendenze
npm install

# 3. Avvia development server
npm run dev

# 4. Apri browser
# http://localhost:5173/XmppTest/
```

### Primo Login

1. Inserisci JID XMPP (es: `user@conversations.im`)
2. Inserisci password
3. Clicca "Connetti"

---

## 🏗️ Architettura

Alfred segue un'architettura a layer ben definita:

```
┌─────────────────────────────────────┐
│         React UI Layer              │
│  (Components, Pages, Hooks)         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Context Layer (State)          │
│     XmppContext, RouterContext      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Services Layer                │
│  (XMPP, Sync, Messages, VCard)      │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐ ┌─────▼──────┐
│  XMPP/MAM   │ │  IndexedDB │
│   Server    │ │   (Cache)  │
└─────────────┘ └────────────┘
```

### Stack Tecnologico

| Categoria | Tecnologia | Versione |
|-----------|------------|----------|
| **Frontend** | React | 18.3.x |
| **Language** | TypeScript | 5.x |
| **Build Tool** | Vite | 5.x |
| **Router** | React Router | 6.x |
| **XMPP** | Stanza.js | 12.21.x |
| **Database** | IndexedDB (idb) | 8.x |
| **Styling** | CSS Modules | - |

### Principi Architetturali

1. **Offline-First**: Cache locale completa, sincronizzazione intelligente
2. **Cache-First Loading**: Mostra sempre prima dati locali
3. **Minimal Server Queries**: Massimizza uso cache, minimizza query
4. **Separation of Concerns**: UI, State, Business Logic ben separati

Per dettagli completi: [docs/architecture/](docs/architecture/)

---

## 📚 Documentazione

La documentazione è organizzata per categoria:

### 📖 [Guide](docs/guides/)
Guide pratiche per sviluppatori:
- [Sistema di Routing](docs/guides/routing-system.md)
- Altre guide in arrivo

### 🏗️ [Architettura](docs/architecture/)
Documentazione architetturale:
- [Overview](docs/architecture/README.md)
- [Analisi Conversazioni](docs/architecture/conversations-analysis.md)
- [Strategia MAM](docs/architecture/mam-global-strategy-explained.md)

### 🔧 [Implementazione](docs/implementation/)
Dettagli implementativi:
- [Sistema Login](docs/implementation/login-system.md)
- [Sistema Sincronizzazione](docs/implementation/sync-system-complete.md)

### 🎨 [Design](docs/design/)
Design e UI/UX:
- [Brand Identity](docs/design/brand-identity.md)
- Colore istituzionale: **#2D2926** (Dark Charcoal)

### 📝 [Decisioni](docs/decisions/)
Architecture Decision Records:
- [No Message Deletion](docs/decisions/no-message-deletion.md)
- Altre decisioni documentate

### 🔧 [Fix](docs/fixes/)
Bug fix e ottimizzazioni:
- [Pull-to-Refresh Fix](docs/fixes/pull-to-refresh-fix.md)
- [Known Issues](docs/fixes/known-issues.md)

### 🗂️ [Archivio](docs/archive/)
Documenti storici e ricerca:
- [XMPP Research](docs/archive/xmpp-research/)
- [Old Docs](docs/archive/old-docs/)

**Indice completo**: [docs/INDICE.md](docs/INDICE.md)

---

## 💻 Sviluppo

### Struttura Progetto

```
alfred/
├── web-client/                 # Applicazione React
│   ├── src/
│   │   ├── components/        # Componenti riutilizzabili
│   │   ├── pages/             # Pagine/route
│   │   ├── contexts/          # React Context (state globale)
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # Logica business (XMPP, DB, ecc)
│   │   ├── utils/             # Utility functions
│   │   └── config/            # Configurazione
│   ├── public/                # Asset statici
│   └── package.json
├── docs/                       # Documentazione
└── README.md
```

### Script Disponibili

```bash
# Development
npm run dev              # Start dev server (hot reload)
npm run build            # Build production
npm run preview          # Preview build localmente

# Quality
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run type-check       # TypeScript check

# Testing (coming soon)
npm run test             # Run unit tests
npm run test:e2e         # Run E2E tests
```

### Convenzioni Codice

- **TypeScript**: Strict mode, no `any`
- **Naming**: 
  - Components: PascalCase (`LoginPopup.tsx`)
  - Hooks: camelCase con `use` prefix (`useMessages.ts`)
  - Services: camelCase (`conversations.ts`)
- **Imports**: Absolute da `src/` (`import { useXmpp } from '../contexts/XmppContext'`)
- **Styling**: CSS Modules co-located con componenti
- **Comments**: JSDoc per funzioni pubbliche

### Custom Hooks Pattern

Alfred usa custom hooks per separare logica da UI:

```typescript
// Esempio: useMessages hook
const {
  messages,          // State: array messaggi
  isLoading,         // State: caricamento
  sendMessage,       // Action: invia messaggio
  loadMoreMessages,  // Action: paginazione
} = useMessages({ jid, client, isConnected })
```

**Hooks disponibili**:
- `useMessages` - Gestione messaggi
- `useChatScroll` - Gestione scroll
- `usePullToRefresh` - Pull-to-refresh gesture
- `useBackButton` - Back button Android

---

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

### Manual Testing

Scenari principali da testare:

1. **Login Flow**
   - [ ] Login con credenziali valide
   - [ ] Login con credenziali invalide
   - [ ] Auto-login al refresh
   - [ ] Logout volontario

2. **Conversations**
   - [ ] Lista conversazioni carica
   - [ ] Pull-to-refresh sincronizza
   - [ ] Ricerca conversazioni
   - [ ] Avatar e nomi corretti

3. **Chat**
   - [ ] Apertura chat istantanea (< 100ms)
   - [ ] Invio messaggio
   - [ ] Ricezione messaggio real-time
   - [ ] Paginazione messaggi vecchi
   - [ ] Pull-to-refresh chat

4. **Offline Mode**
   - [ ] Funzionamento con rete disattivata
   - [ ] Messaggi visibili dalla cache
   - [ ] Re-sincronizzazione quando torna online

---

## 🚀 Deployment

### GitHub Pages

Alfred è configurato per deployment automatico su GitHub Pages:

```bash
# 1. Build production
npm run build

# 2. Deploy (automatico via GitHub Actions)
# Push su branch main → deploy automatico
```

**URL**: `https://[username].github.io/alfred/`

### Configurazione

Modifica `vite.config.ts` per cambiare base URL:

```typescript
export default defineConfig({
  base: '/alfred/',  // Cambia per tuo repository
  // ...
})
```

### Self-Hosting

Per hosting su server custom:

```bash
# 1. Build
npm run build

# 2. Copia dist/ sul server
scp -r dist/* user@server:/var/www/html/

# 3. Configura web server (nginx/apache)
# Servire come SPA (redirect a index.html)
```

**Note**: Alfred usa HashRouter, quindi funziona su qualsiasi hosting statico senza configurazione server-side.

---

## 🤝 Contributing

Contributi sono benvenuti! Per contribuire:

### 1. Fork & Clone

```bash
git clone https://github.com/[your-username]/alfred.git
cd alfred/web-client
```

### 2. Crea Branch

```bash
git checkout -b feature/my-feature
# oppure
git checkout -b fix/my-bugfix
```

### 3. Sviluppa

- Segui convenzioni codice
- Scrivi test se applicable
- Aggiorna documentazione se necessario

### 4. Commit

```bash
git add .
git commit -m "feat: add my feature"
# oppure
git commit -m "fix: resolve bug XYZ"
```

**Convenzione commit**: [Conventional Commits](https://www.conventionalcommits.org/)
- `feat:` - Nuova feature
- `fix:` - Bug fix
- `docs:` - Documentazione
- `style:` - Formattazione
- `refactor:` - Refactoring
- `test:` - Testing
- `chore:` - Maintenance

### 5. Push & Pull Request

```bash
git push origin feature/my-feature
```

Poi apri Pull Request su GitHub.

### Guidelines

- **Code Style**: Segui ESLint config esistente
- **Testing**: Aggiungi test per nuove feature
- **Documentation**: Aggiorna docs/ se necessario
- **Performance**: Non degradare performance esistenti
- **Accessibility**: Mantieni accessibilità WCAG 2.1 AA

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 👏 Acknowledgments

- [Stanza.js](https://stanzajs.org/) - XMPP library
- [React](https://reactjs.org/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [conversations.im](https://conversations.im/) - XMPP server per testing

---

## 📞 Contatti

- **Issues**: [GitHub Issues](https://github.com/[your-username]/alfred/issues)
- **Discussions**: [GitHub Discussions](https://github.com/[your-username]/alfred/discussions)
- **Email**: [your-email@example.com](mailto:your-email@example.com)

---

## 🗺️ Roadmap

### Q1 2026
- [ ] Chat di gruppo (MUC)
- [ ] Condivisione file
- [ ] Dark mode

### Q2 2026
- [ ] OMEMO (E2E encryption)
- [ ] PWA con offline support completo
- [ ] Push notifications

### Q3 2026
- [ ] Voice/Video calls
- [ ] Desktop app (Electron)

### Future
- [ ] Mobile app (React Native)
- [ ] Plugin system
- [ ] Themes marketplace

---

<div align="center">

**Made with ❤️ by [Your Name]**

[⬆ Torna su](#alfred)

</div>
