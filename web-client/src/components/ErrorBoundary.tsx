import { Component, type ReactNode } from 'react'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
}

/**
 * Error Boundary React per catturare errori nei componenti figli
 * e mostrare un UI di fallback invece di crashare l'intera app
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    
    // In production, you might want to log to an error reporting service
    // e.g., Sentry.captureException(error, { extra: errorInfo })
    
    this.setState({
      error,
      errorInfo: errorInfo.componentStack,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__content">
            <h2 className="error-boundary__title">Ops! Qualcosa è andato storto</h2>
            <p className="error-boundary__message">
              Si è verificato un errore imprevisto. Puoi provare a ricaricare la pagina.
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="error-boundary__details">
                <summary>Dettagli errore (solo in sviluppo)</summary>
                <pre className="error-boundary__error">
                  {this.state.error.toString()}
                  {this.state.errorInfo && `\n\n${this.state.errorInfo}`}
                </pre>
              </details>
            )}
            
            <div className="error-boundary__actions">
              <button
                className="error-boundary__button"
                onClick={this.handleReset}
                type="button"
              >
                Riprova
              </button>
              <button
                className="error-boundary__button error-boundary__button--secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                Ricarica pagina
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
