/**
 * Utility per la gestione e compressione delle immagini avatar
 */

/**
 * Dimensioni target per gli avatar
 */
export const AVATAR_SIZE = {
  WIDTH: 200,
  HEIGHT: 200,
  MAX_FILE_SIZE: 100 * 1024, // 100KB
  QUALITY: 0.85, // Qualità JPEG/WebP (0-1)
}

/**
 * Ridimensiona e comprime un'immagine per l'uso come avatar
 * 
 * @param file - File immagine da processare
 * @returns Promise con { data: string, type: string } - base64 e MIME type
 */
export async function compressAvatar(file: File): Promise<{ data: string; type: string }> {
  return new Promise((resolve, reject) => {
    // Verifica che sia un'immagine
    if (!file.type.startsWith('image/')) {
      reject(new Error('Il file deve essere un\'immagine'))
      return
    }

    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Crea canvas con dimensioni target
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Impossibile creare contesto canvas'))
          return
        }

        // Calcola dimensioni mantenendo aspect ratio
        let width = img.width
        let height = img.height
        const maxDim = AVATAR_SIZE.WIDTH

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        // Imposta dimensioni canvas
        canvas.width = width
        canvas.height = height

        // Disegna immagine ridimensionata
        ctx.drawImage(img, 0, 0, width, height)

        // Determina formato output (preferisci WebP se supportato, altrimenti JPEG)
        let outputFormat = 'image/jpeg'
        let quality = AVATAR_SIZE.QUALITY

        // Prova WebP se il browser lo supporta
        if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
          outputFormat = 'image/webp'
        }

        // Converti in base64
        let dataURL = canvas.toDataURL(outputFormat, quality)

        // Se l'immagine è ancora troppo grande, riduci ulteriormente la qualità
        let attempts = 0
        while (dataURL.length > AVATAR_SIZE.MAX_FILE_SIZE * 1.37 && attempts < 5) {
          // 1.37 è il fattore di conversione base64 (4/3)
          quality -= 0.1
          if (quality < 0.3) break
          dataURL = canvas.toDataURL(outputFormat, quality)
          attempts++
        }

        // Estrai solo i dati base64 (rimuovi il prefisso "data:image/xxx;base64,")
        const base64Data = dataURL.split(',')[1]

        resolve({
          data: base64Data,
          type: outputFormat,
        })
      }

      img.onerror = () => {
        reject(new Error('Impossibile caricare l\'immagine'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('Impossibile leggere il file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Converte un data URL in base64 (rimuove il prefisso)
 */
export function dataURLtoBase64(dataURL: string): string {
  return dataURL.split(',')[1]
}

/**
 * Converte base64 in data URL
 */
export function base64toDataURL(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`
}

/**
 * Valida che un'immagine sia nei limiti accettabili
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Verifica tipo
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Il file deve essere un\'immagine' }
  }

  // Verifica dimensione massima (prima della compressione: 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'L\'immagine è troppo grande (max 5MB)' }
  }

  // Verifica formati supportati
  const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!supportedFormats.includes(file.type)) {
    return { valid: false, error: 'Formato non supportato. Usa JPEG, PNG, WebP o GIF' }
  }

  return { valid: true }
}

/**
 * Genera un colore di sfondo casuale per gli avatar senza immagine
 * Basato sul JID per consistenza
 */
export function generateAvatarColor(jid: string): string {
  const colors = [
    '#667eea',
    '#764ba2',
    '#f093fb',
    '#4facfe',
    '#43e97b',
    '#fa709a',
    '#fee140',
    '#30cfd0',
    '#a8edea',
    '#ff6a88',
  ]

  // Usa il JID per generare un indice consistente
  let hash = 0
  for (let i = 0; i < jid.length; i++) {
    hash = jid.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}
