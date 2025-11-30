# Brand Identity - Identità del Brand

## Nome Ufficiale

**Alfred** - Messaggistica istantanea

Il nome ufficiale dell'applicazione è **Alfred**.

---

## Colore Istituzionale Ufficiale

Il colore istituzionale ufficiale di Alfred è:

### **#2D2926** - Dark Charcoal

Questo è il colore principale che rappresenta l'identità visiva di **Alfred** e viene utilizzato in tutti gli elementi chiave dell'interfaccia.

---

## Palette Colori Principale

### Colore Primario
- **Colore principale**: `#2D2926`
- **Nome**: Dark Charcoal
- **RGB**: rgb(45, 41, 38)
- **Uso**: Header, barre di navigazione, pulsanti primari, elementi di focus

### Varianti del Colore Primario

#### Hover State
- **Colore**: `#3d3632`
- **Uso**: Effetto hover sui bottoni e elementi interattivi

#### Active State
- **Colore**: `#1e1b19`
- **Uso**: Effetto active/pressed sui bottoni

#### Gradiente
- **Gradiente**: `linear-gradient(135deg, #2D2926, #4a433e)`
- **Uso**: Pulsanti con effetto gradiente

---

## Implementazione Tecnica

### File CSS Principali
Il colore istituzionale è implementato nei seguenti file:

1. **index.css** - Stili globali e focus states
2. **App.css** - Layout principale e bottoni
3. **ConversationsPage.css** - Pagina conversazioni
4. **ChatPage.css** - Pagina chat
5. **NewConversationPopup.css** - Popup nuova conversazione
6. **LoginPopup.css** - Popup di login

### Esempi di Utilizzo

```css
/* Header e barre di navigazione */
.header {
  background: #2D2926;
}

/* Bottoni primari */
.button-primary {
  background: #2D2926;
}

.button-primary:hover {
  background: #3d3632;
}

.button-primary:active {
  background: #1e1b19;
}

/* Focus states per accessibilità */
*:focus-visible {
  outline: 2px solid #2D2926;
}

/* Gradienti */
.button-gradient {
  background: linear-gradient(135deg, #2D2926, #4a433e);
}

/* Ombre e trasparenze */
.shadow-primary {
  box-shadow: 0 0 0 3px rgba(45, 41, 38, 0.1);
}
```

---

## Linee Guida per l'Uso del Colore

### ✅ Dove Usare il Colore Istituzionale

- Header delle pagine
- Barre di navigazione
- Pulsanti di azione primaria
- Elementi di focus per l'accessibilità
- Indicatori di stato attivo
- FAB (Floating Action Button)
- Bordi di input in focus

### ❌ Dove NON Usare il Colore Istituzionale

- Sfondi di messaggi
- Testo normale
- Bordi decorativi secondari
- Elementi di sfondo generale

---

## Accessibilità

Il colore `#2D2926` è stato scelto per garantire:

- **Contrasto adeguato** con il testo bianco (#ffffff) per la leggibilità
- **WCAG 2.1 Level AA** compliance per il contrasto
- **Visibilità** su diversi dispositivi e condizioni di illuminazione
- **Coerenza** visiva in modalità chiara e scura

### Ratios di Contrasto

- Testo bianco su #2D2926: **15.8:1** ✅ (AAA)
- Testo grigio chiaro (#f5f7ff) su #2D2926: **15.2:1** ✅ (AAA)

---

## Storia del Colore

### Versione 1.0
- **Data**: 30 Novembre 2025
- **Colore**: `#2D2926` (Dark Charcoal)
- **Motivo**: Colore istituzionale ufficiale, elegante e professionale

### Versione Precedente
- **Colore**: `#5682a3` (Steel Blue)
- **Sostituito**: 30 Novembre 2025

---

## Note per Sviluppatori

### Aggiungere Nuovi Componenti
Quando si creano nuovi componenti che richiedono il colore istituzionale:

1. Usare sempre `#2D2926` per il colore principale
2. Usare `#3d3632` per gli stati hover
3. Usare `#1e1b19` per gli stati active
4. Usare `rgba(45, 41, 38, 0.1)` per ombre e trasparenze leggere
5. Usare `rgba(45, 41, 38, 0.2)` per ombre e trasparenze in dark mode

### Manutenzione
Per modificare il colore istituzionale in futuro:

1. Cercare `#2D2926` in tutti i file CSS
2. Aggiornare anche le varianti (`#3d3632`, `#1e1b19`)
3. Aggiornare i valori rgba corrispondenti
4. Testare il contrasto con WCAG 2.1
5. Aggiornare questo documento

---

## Logo e Icona

L'applicazione **Alfred** utilizza un'icona minimalista che rappresenta una spunta (✓) all'interno di un cerchio:

- **Forma**: Cerchio con spunta
- **Colore principale**: `#2D2926` (Dark Charcoal)
- **Colore spunta**: Bianco (`#FFFFFF`)
- **Formato SVG**: Disponibile in `/web-client/src/components/SplashScreen.tsx`

```svg
<svg width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#2D2926" />
  <path d="M20 32L28 40L44 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
</svg>
```

---

## Typography

### Titolo App
- **Nome**: Alfred
- **Tagline**: "Messaggistica istantanea"
- **Font Family**: 'Inter', 'SF Pro Display', system-ui

---

## Contatti e Riferimenti

Per domande sull'identità del brand di **Alfred** o sull'uso dei colori, consultare:
- Questo documento: `/docs/brand-identity.md`
- Repository: https://github.com/[your-repo]

**Ultimo aggiornamento**: 30 Novembre 2025
