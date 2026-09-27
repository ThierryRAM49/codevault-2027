import { AlertCircle, Loader2, Search, Sparkles } from 'lucide-react'
import type { AppAnalysis } from '@/types'

interface AnalysisPageProps {
  processingStep: 'analyzing' | 'getting-recommendations' | null
  error: string | null
  analysis: AppAnalysis | null
  clearError: () => void
  resetApp: () => void
}

const STEPS: { key: 'analyzing' | 'getting-recommendations'; label: string; icon: typeof Search }[] = [
  { key: 'analyzing', label: 'Analyse de votre idée', icon: Search },
  { key: 'getting-recommendations', label: 'Recherche des meilleures plateformes', icon: Sparkles },
]

export function AnalysisPage({ processingStep, error, resetApp, clearError }: AnalysisPageProps) {
  if (error) {
    return (
      <div className="glass animate-fade-in mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <p className="text-sm text-gray-300">{error}</p>
        <button
          onClick={() => {
            clearError()
            resetApp()
          }}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 py-10 text-center">
      {STEPS.map(({ key, label, icon: Icon }) => {
        const isActive = processingStep === key
        const isDone =
          processingStep === 'getting-recommendations' && key === 'analyzing'
        return (
          <div
            key={key}
            className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 transition ${
              isActive
                ? 'border-amber-500/40 bg-amber-500/10'
                : isDone
                  ? 'border-white/10 bg-white/5 opacity-60'
                  : 'border-white/5 bg-transparent opacity-30'
            }`}
          >
            {isActive ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
            ) : (
              <Icon className="h-5 w-5 text-gray-400" />
            )}
            <span className="text-sm text-gray-200">{label}</span>
          </div>
        )
      })}
      <button onClick={resetApp} className="text-xs text-gray-500 underline-offset-4 hover:underline">
        Annuler
      </button>
    </div>
  )
}
