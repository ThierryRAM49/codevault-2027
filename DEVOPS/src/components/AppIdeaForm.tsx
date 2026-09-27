import { useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

interface AppIdeaFormProps {
  onSubmit: (idea: string) => void
  loading: boolean
}

const EXAMPLES = [
  "Un traqueur d'habitudes avec séries et rappels",
  'Une marketplace où les voisins se louent des outils entre eux',
  'Un tableau de bord interne pour suivre les tickets support',
  'Un jeu de trivia multijoueur en temps réel',
]

export function AppIdeaForm({ onSubmit, loading }: AppIdeaFormProps) {
  const [idea, setIdea] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!idea.trim() || loading) return
    onSubmit(idea.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="glass animate-fade-in rounded-2xl p-2">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Décrivez votre idée d'application en une ou deux phrases…"
          rows={4}
          disabled={loading}
          className="w-full resize-none rounded-xl bg-transparent p-4 text-white placeholder:text-gray-500 focus:outline-none focus-ring disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <span className="text-xs text-gray-500">{idea.length}/500</span>
          <button
            type="submit"
            disabled={loading || idea.trim().length < 10}
            className="btn-premium inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Analyse en cours…' : 'Trouver ma plateforme'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={loading}
            onClick={() => setIdea(example)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  )
}
