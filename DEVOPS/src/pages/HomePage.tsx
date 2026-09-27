import { Rocket } from 'lucide-react'
import { AppIdeaForm } from '@/components/AppIdeaForm'

interface HomePageProps {
  handleAppIdeaSubmit: (idea: string) => void
  loading: boolean
}

export function HomePage({ handleAppIdeaSubmit, loading }: HomePageProps) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-amber-300">
        <Rocket className="h-3.5 w-3.5" />
        Aucun compte nécessaire — décrivez votre idée et c'est parti
      </span>

      <h1 className="animate-fade-in max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
        Trouvez la bonne <span className="gradient-text">plateforme</span> pour votre idée d'application
      </h1>
      <p className="mt-4 max-w-xl text-gray-400">
        Décrivez ce que vous voulez créer. Nous estimerons sa complexité, son échelle et sa sensibilité, puis
        la comparerons à un ensemble de plateformes d'hébergement et de backend — entièrement dans votre navigateur.
      </p>

      <div className="mt-10 flex w-full justify-center">
        <AppIdeaForm onSubmit={handleAppIdeaSubmit} loading={loading} />
      </div>
    </div>
  )
}
