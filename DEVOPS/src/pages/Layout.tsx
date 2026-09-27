import { Link, Outlet } from 'react-router-dom'
import { Mail, Sparkles } from 'lucide-react'
import { CONTACT_EMAIL } from '@/lib/contact'
import { HologramLogo } from '@/components/HologramLogo'

export function Layout() {
  return (
    <div className="bg-dots min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span className="flex flex-col leading-tight">
              <HologramLogo text="DEVOPS" />
              <span className="text-[10px] font-normal text-gray-500">Outil de sélection de plateforme IA</span>
            </span>
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/10"
          >
            <Mail className="h-3.5 w-3.5" />
            Nous contacter
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-gray-600">
        <p>Les recommandations sont générées localement à partir de votre description — aucune donnée ne quitte votre navigateur.</p>
        <p className="mt-2">
          Une question, un projet à concrétiser ?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-300 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </footer>
    </div>
  )
}
