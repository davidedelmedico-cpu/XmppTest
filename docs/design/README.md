# 🎨 Design

Documentazione design e identità visiva di Alfred.

## Documenti

### Brand Identity
- **[brand-identity.md](./brand-identity.md)** - Identità del brand Alfred
  - Colore istituzionale: `#2D2926` (Dark Charcoal)
  - Palette colori
  - Logo e icona
  - Typography
  - Linee guida utilizzo

### Architettura
- **[database-architecture.md](./database-architecture.md)** - Scelta architetturale del database locale
  - Database locale come cache sincronizzata dal server
  - Principi di sincronizzazione
  - Pattern corretti e scorretti

## Principi Design

### 1. Minimalismo Funzionale
- Interfaccia pulita, senza elementi superflui
- Focus sul contenuto (messaggi)
- Spazi bianchi generosi
- Gerarchia visiva chiara

### 2. Ispirazione Modern Messaging
- Layout Telegram/WhatsApp web
- Sidebar + Main panel
- Header fixed con azioni
- FAB per azione primaria

### 3. Accessibilità First
- Contrasto WCAG 2.1 Level AA
- Focus states visibili
- Keyboard navigation completa
- Screen reader friendly

### 4. Responsive
- Mobile first approach
- Breakpoint tablet (768px)
- Breakpoint desktop (1024px)
- Touch-friendly targets (48px min)

## Colori

### Primari
```css
--primary: #2D2926      /* Dark Charcoal */
--primary-hover: #3d3632
--primary-active: #1e1b19
```

### Neutrali
```css
--bg-primary: #ffffff
--bg-secondary: #f5f7ff
--text-primary: #2D2926
--text-secondary: #64748b
--border: #e2e8f0
```

### Stati
```css
--success: #10b981
--warning: #f59e0b
--error: #ef4444
--info: #3b82f6
```

## Typography

```css
font-family: 'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif;

/* Heading */
h1: 24px / 700
h2: 20px / 600
h3: 18px / 600

/* Body */
body: 14px / 400
small: 12px / 400
```

## Components

### Button
- Primary: Dark Charcoal background
- Secondary: Transparent con border
- Ghost: Solo testo
- Radius: 8px
- Padding: 12px 24px

### Input
- Border: 1px #e2e8f0
- Focus: 2px #2D2926
- Radius: 8px
- Padding: 12px 16px

### Card
- Background: white
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Radius: 12px
- Padding: 16px

## Animazioni

### Durations
```css
--duration-fast: 150ms
--duration-normal: 300ms
--duration-slow: 500ms
```

### Easings
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-in: cubic-bezier(0.4, 0, 1, 1)
```

### Transizioni Comuni
- Hover: `all 150ms ease-in-out`
- Modal: `opacity 300ms, transform 300ms`
- Slide: `transform 300ms ease-out`

## Icone

- Set: Custom SVG (minimali)
- Dimensioni: 20px, 24px, 32px
- Stroke: 2px
- Style: Rounded

## Vedere Anche

- [Implementazione Login](../implementation/login-system.md) - Esempio glassmorphism
- [Component Library](#) - Coming soon
