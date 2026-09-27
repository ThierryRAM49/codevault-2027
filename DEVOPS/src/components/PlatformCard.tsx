import { Boxes, Cloud, Database, Flame, Globe, Globe2, Server, Triangle, Zap, type LucideIcon } from 'lucide-react'
import type { Recommendation } from '@/types'

const ICONS: Record<string, LucideIcon> = {
  triangle: Triangle,
  globe: Globe,
  database: Database,
  flame: Flame,
  zap: Zap,
  server: Server,
  'globe-2': Globe2,
  cloud: Cloud,
  boxes: Boxes,
}

interface PlatformCardProps {
  recommendation: Recommendation
  onClick: () => void
}

export function PlatformCard({ recommendation, onClick }: PlatformCardProps) {
  const platform = recommendation.platform_data
  if (!platform) return null

  const Icon = ICONS[platform.icon] ?? Boxes

  return (
    <button
      onClick={onClick}
      className="card-hover glass animate-fade-in group flex w-full flex-col gap-4 rounded-2xl p-6 text-left"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <Icon className="h-5 w-5 text-white" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-white">{platform.name}</h3>
            <p className="text-xs text-gray-400">{platform.tagline}</p>
          </div>
        </div>
        <span className="gradient-text shrink-0 text-lg font-bold">{recommendation.match_score}%</span>
      </div>

      <p className="line-clamp-2 text-sm text-gray-400">{platform.description}</p>

      <ul className="flex flex-wrap gap-1.5">
        {platform.pros.slice(0, 3).map((pro) => (
          <li
            key={pro}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300"
          >
            {pro}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between pt-2 text-xs">
        <span className="text-gray-500">Rang n°{recommendation.rank}</span>
        <span className="font-medium text-amber-300 opacity-0 transition group-hover:opacity-100">
          Voir le prompt de démarrage →
        </span>
      </div>
    </button>
  )
}
