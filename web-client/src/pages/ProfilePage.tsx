import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useXmpp } from '../contexts/XmppContext'
import { getVCard, publishVCard } from '../services/vcard'
import { compressAvatar, validateImageFile } from '../utils/image'
import './ProfilePage.css'

export function ProfilePage() {
  const navigate = useNavigate()
  const { client, isConnected, jid } = useXmpp()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [avatarData, setAvatarData] = useState<string | undefined>()
  const [avatarType, setAvatarType] = useState<string | undefined>()
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carica vCard corrente
  useEffect(() => {
    if (!client || !isConnected || !jid) {
      setIsLoading(false)
      return
    }

    const loadVCard = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const vcard = await getVCard(client, jid, false)
        
        if (vcard) {
          setFullName(vcard.fullName || '')
          setNickname(vcard.nickname || '')
          setEmail(vcard.email || '')
          setDescription(vcard.description || '')
          setAvatarData(vcard.photoData)
          setAvatarType(vcard.photoType)
        }
      } catch (err) {
        console.error('Errore nel caricamento vCard:', err)
        setError('Impossibile caricare il profilo')
      } finally {
        setIsLoading(false)
      }
    }

    loadVCard()
  }, [client, isConnected, jid])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Valida il file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Immagine non valida')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      // Comprimi l'immagine
      const { data, type } = await compressAvatar(file)
      setAvatarData(data)
      setAvatarType(type)
    } catch (err) {
      console.error('Errore nella compressione immagine:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento immagine')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarData(undefined)
    setAvatarType(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!client || !isConnected) {
      setError('Non connesso al server')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await publishVCard(client, {
        fullName: fullName.trim() || undefined,
        nickname: nickname.trim() || undefined,
        email: email.trim() || undefined,
        description: description.trim() || undefined,
        photoData: avatarData,
        photoType: avatarType,
      })

      if (result) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('Impossibile salvare il profilo')
      }
    } catch (err) {
      console.error('Errore nel salvataggio profilo:', err)
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = () => {
    if (fullName) {
      const parts = fullName.trim().split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return fullName[0]?.toUpperCase() || '?'
    }
    if (nickname) {
      return nickname[0]?.toUpperCase() || '?'
    }
    if (jid) {
      return jid[0]?.toUpperCase() || '?'
    }
    return '?'
  }

  if (!isConnected) {
    return (
      <div className="profile-page">
        <header className="profile-page__header">
          <button 
            className="profile-page__back-btn"
            onClick={() => navigate('/conversations')}
            aria-label="Torna alle conversazioni"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>Profilo</h1>
        </header>
        <div className="profile-page__error">
          <p>Non connesso al server XMPP</p>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <header className="profile-page__header">
        <button 
          className="profile-page__back-btn"
          onClick={() => navigate('/conversations')}
          aria-label="Torna alle conversazioni"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Profilo</h1>
      </header>

      <main className="profile-page__content">
        {isLoading ? (
          <div className="profile-page__loading">
            <div className="profile-page__spinner" />
            <p>Caricamento...</p>
          </div>
        ) : (
          <>
            {/* Avatar Section */}
            <div className="profile-page__avatar-section">
              <div className="profile-page__avatar">
                {avatarData && avatarType ? (
                  <img 
                    src={`data:${avatarType};base64,${avatarData}`}
                    alt="Avatar"
                    className="profile-page__avatar-img"
                  />
                ) : (
                  <span className="profile-page__avatar-initials">
                    {getInitials()}
                  </span>
                )}
              </div>
              
              <div className="profile-page__avatar-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="profile-page__file-input"
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload" className="profile-page__btn profile-page__btn--secondary">
                  {avatarData ? 'Cambia foto' : 'Aggiungi foto'}
                </label>
                {avatarData && (
                  <button 
                    onClick={handleRemoveAvatar}
                    className="profile-page__btn profile-page__btn--danger"
                  >
                    Rimuovi foto
                  </button>
                )}
              </div>
            </div>

            {/* JID Display */}
            <div className="profile-page__jid">
              <label>Il tuo JID</label>
              <div className="profile-page__jid-value">{jid}</div>
            </div>

            {/* Form Fields */}
            <div className="profile-page__form">
              <div className="profile-page__field">
                <label htmlFor="fullName">Nome completo</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Mario Rossi"
                  maxLength={100}
                />
              </div>

              <div className="profile-page__field">
                <label htmlFor="nickname">Nickname</label>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="mario"
                  maxLength={50}
                />
              </div>

              <div className="profile-page__field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mario@example.com"
                  maxLength={100}
                />
              </div>

              <div className="profile-page__field">
                <label htmlFor="description">Bio</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Racconta qualcosa su di te..."
                  maxLength={300}
                  rows={4}
                />
                <span className="profile-page__char-count">
                  {description.length}/300
                </span>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="profile-page__message profile-page__message--error">
                {error}
              </div>
            )}

            {success && (
              <div className="profile-page__message profile-page__message--success">
                Profilo salvato con successo!
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer con bottone fisso sempre visibile */}
      {!isLoading && (
        <footer className="profile-page__footer">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="profile-page__btn profile-page__btn--primary"
          >
            {isSaving ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
        </footer>
      )}
    </div>
  )
}
