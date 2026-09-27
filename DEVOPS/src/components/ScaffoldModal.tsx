import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { Recommendation } from '@/types'

type PlatformData = NonNullable<Recommendation['platform_data']>

interface ScaffoldModalProps {
  isOpen: boolean
  onClose: () => void
  platform: PlatformData
}

const SCAFFOLD_COMMANDS: Record<string, string[]> = {
  vercel: ['npx create-next-app@latest my-app', 'cd my-app', 'npm i -g vercel', 'vercel'],
  netlify: ['npm create vite@latest my-app -- --template react-ts', 'cd my-app && npm install', 'npx netlify-cli deploy'],
  supabase: ['npx supabase init', 'npx supabase start', 'npm create vite@latest my-app -- --template react-ts'],
  firebase: ['npm i -g firebase-tools', 'firebase init', 'firebase deploy'],
  railway: ['npm i -g @railway/cli', 'railway init', 'railway up'],
  render: ['git init', 'git add . && git commit -m "init"', '# connecter le dépôt sur dashboard.render.com/new'],
  'fly-io': ['brew install flyctl', 'fly launch', 'fly deploy'],
  digitalocean: ['doctl apps create --spec app.yaml'],
  aws: ['npm i -g aws-cdk', 'cdk init app --language typescript', 'cdk deploy'],
}

export function ScaffoldModal({ isOpen, onClose, platform }: ScaffoldModalProps) {
  const [copied, setCopied] = useState(false)
  if (!isOpen) return null

  const commands = SCAFFOLD_COMMANDS[platform.slug] ?? [`# Voir ${platform.website} pour les instructions d'installation du CLI`]
  const commandText = commands.join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commandText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Le presse-papiers peut être indisponible — on ignore silencieusement.
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="glass animate-fade-in w-full max-w-md rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Commandes de démarrage {platform.name}</h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-gray-200">
          {commands.map((cmd) => `$ ${cmd}`).join('\n')}
        </pre>

        <button
          onClick={handleCopy}
          className="btn-premium mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copié' : 'Copier les commandes'}
        </button>
      </div>
    </div>
  )
}
