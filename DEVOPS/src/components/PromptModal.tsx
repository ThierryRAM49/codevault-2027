import { useState } from 'react'
import { Check, Copy, ExternalLink, Mail, TerminalSquare, X } from 'lucide-react'
import type { AppAnalysis, Recommendation } from '@/types'
import { buildMailto } from '@/lib/contact'
import { ScaffoldModal } from './ScaffoldModal'

interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  recommendation: Recommendation | null
  analysis: AppAnalysis | null
}

function buildStarterPrompt(analysis: AppAnalysis | null, platformName: string): string {
  const description = analysis?.six_word_description ?? "l'idée d'application décrite ci-dessous"
  return [
    `Je construis : ${description}.`,
    `Plateforme cible : ${platformName}.`,
    '',
    'Merci de générer un projet de démarrage pour cette idée, incluant :',
    '- Une structure de dossiers adaptée à la plateforme ci-dessus',
    '- Un modèle de données minimal pour les entités principales',
    '- Un flux fonctionnel de bout en bout (créer → afficher → lister)',
    '- Des notes sur les prochaines étapes',
  ].join('\n')
}

export function PromptModal({ isOpen, onClose, recommendation, analysis }: PromptModalProps) {
  const [copied, setCopied] = useState(false)
  const [scaffoldOpen, setScaffoldOpen] = useState(false)

  if (!isOpen || !recommendation?.platform_data) return null

  const platform = recommendation.platform_data
  const prompt = buildStarterPrompt(analysis, platform.name)
  const contactHref = buildMailto(
    'Discutons de mon projet',
    [
      'Bonjour,',
      '',
      `Je souhaite être accompagné(e) sur ce projet : « ${analysis?.six_word_description ?? ''} ».`,
      `Plateforme envisagée : ${platform.name}.`,
      '',
      'Pouvez-vous me recontacter pour en discuter ?',
    ].join('\n'),
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Le presse-papiers peut être indisponible (contexte non sécurisé) — on ignore silencieusement.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="glass animate-fade-in max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Prompt de démarrage pour {platform.name}</h2>
            <p className="mt-1 text-sm text-gray-400">
              Collez ceci dans votre outil de code IA préféré pour générer le squelette du projet.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-gray-200">
          {prompt}
        </pre>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="btn-premium inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier le prompt'}
          </button>
          <button
            onClick={() => setScaffoldOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
          >
            <TerminalSquare className="h-4 w-4" />
            Commandes CLI de démarrage
          </button>
          <a
            href={platform.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" />
            Visiter {platform.name}
          </a>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-gray-400">Pas envie de le faire vous-même ?</p>
          <a
            href={contactHref}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-amber-300 hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            On le construit pour vous
          </a>
        </div>
      </div>

      <ScaffoldModal isOpen={scaffoldOpen} onClose={() => setScaffoldOpen(false)} platform={platform} />
    </div>
  )
}
