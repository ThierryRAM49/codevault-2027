import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { AppAnalysis, Recommendation } from '@/types'

interface ShareableCardModalProps {
  isOpen: boolean
  onClose: () => void
  analysis: AppAnalysis | null
  topRecommendation: Recommendation | null
}

export function ShareableCardModal({ isOpen, onClose, analysis, topRecommendation }: ShareableCardModalProps) {
  const [copied, setCopied] = useState(false)
  if (!isOpen || !analysis || !topRecommendation?.platform_data) return null

  const platform = topRecommendation.platform_data
  const summary = `Mon idée d'application (« ${analysis.six_word_description} ») correspond à ${platform.name} à ${topRecommendation.match_score} %. Trouvé avec l'outil de sélection de plateforme IA.`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Le presse-papiers peut être indisponible — on ignore silencieusement.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass animate-fade-in w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Partagez votre résultat</h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-dots rounded-2xl border border-white/10 bg-gradient-to-br from-amber-900/40 to-orange-900/20 p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-amber-300">Meilleure correspondance</p>
          <p className="gradient-text mt-2 text-2xl font-bold">{platform.name}</p>
          <p className="mt-1 text-3xl font-extrabold text-white">{topRecommendation.match_score} %</p>
          <p className="mt-3 text-sm text-gray-300">« {analysis.six_word_description} »</p>
        </div>

        <button
          onClick={handleCopy}
          className="btn-premium mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Résumé copié' : 'Copier le résumé'}
        </button>
      </div>
    </div>
  )
}
