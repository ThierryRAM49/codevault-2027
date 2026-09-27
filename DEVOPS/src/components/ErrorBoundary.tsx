import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non gérée dans l\'arbre applicatif :', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-4 text-center text-white">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
          <p className="max-w-md text-sm text-gray-400">
            Une erreur inattendue s'est produite. Recharger la page résout généralement le problème.
          </p>
          <button
            onClick={() => window.location.assign('/')}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200"
          >
            Retour à l'accueil
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
