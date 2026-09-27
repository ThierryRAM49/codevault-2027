import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Check, Mail, RotateCcw, Share2 } from 'lucide-react'
import type { AppAnalysis, Recommendation } from '@/types'
import { PlatformCard } from '@/components/PlatformCard'
import { ShareableCardModal } from '@/components/ShareableCardModal'
import { buildMailto } from '@/lib/contact'
import { findTierForComplexity, PRICING_TIERS } from '@/lib/pricing'

interface RecommendationsPageProps {
  recommendations: Recommendation[]
  analysis: AppAnalysis | null
  error: string | null
  handleCardClick: (platformSlug: string) => void
}

const SCORE_LABELS: { key: keyof AppAnalysis; label: string }[] = [
  { key: 'complexity_score', label: 'Complexité' },
  { key: 'scale_score', label: 'Échelle' },
  { key: 'sensitivity_score', label: 'Sensibilité' },
]

export function RecommendationsPage({ recommendations, analysis, error, handleCardClick }: RecommendationsPageProps) {
  const [shareOpen, setShareOpen] = useState(false)

  if (error) {
    return (
      <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <p className="text-sm text-gray-300">{error}</p>
        <Link to="/" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20">
          Recommencer
        </Link>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center text-sm text-gray-400">
        Pas encore de recommandations.{' '}
        <Link to="/" className="text-amber-300 hover:underline">
          Décrivez une idée d'application
        </Link>{' '}
        pour commencer.
      </div>
    )
  }

  const topRecommendation = recommendations[0]
  const topPlatformName = topRecommendation.platform_data?.name ?? 'la plateforme recommandée'

  const handleShare = async () => {
    const shareData = {
      title: 'Outil de sélection de plateforme IA',
      text: `Mon idée d'application (« ${analysis?.six_word_description} ») correspond à ${topPlatformName} à ${topRecommendation.match_score} %.`,
      url: 'https://riad-design.cloud/',
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // L'utilisateur a annulé le partage natif — on retombe sur la modale.
      }
    }
    setShareOpen(true)
  }

  const contactHref = buildMailto(
    'Discutons de mon projet',
    [
      'Bonjour,',
      '',
      `Je souhaite être accompagné(e) sur ce projet : « ${analysis?.six_word_description ?? ''} ».`,
      `La plateforme recommandée par l'outil est ${topPlatformName} (${topRecommendation.match_score} % de correspondance).`,
      '',
      'Pouvez-vous me recontacter pour en discuter ?',
    ].join('\n'),
  )

  const matchingTierKey = analysis ? findTierForComplexity(analysis.complexity_score).key : null

  const buildQuoteHref = (tierName: string) =>
    buildMailto(
      `Devis — forfait ${tierName}`,
      [
        'Bonjour,',
        '',
        `Je souhaite un devis pour le forfait ${tierName} sur ce projet : « ${analysis?.six_word_description ?? ''} ».`,
        `Score de complexité estimé par l'outil : ${analysis?.complexity_score ?? '?'}/10.`,
        `La plateforme recommandée est ${topPlatformName} (${topRecommendation.match_score} % de correspondance).`,
        '',
        'Pouvez-vous me recontacter pour en discuter ?',
      ].join('\n'),
    )

  return (
    <div className="animate-fade-in">
      {analysis && (
        <div className="glass mb-10 rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wide text-amber-300">Votre idée, en six mots</p>
          <p className="mt-1 text-lg font-semibold text-white">« {analysis.six_word_description} »</p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {SCORE_LABELS.map(({ key, label }) => (
              <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-white">{analysis[key] as number}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Plateformes recommandées</h2>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10"
          >
            <Share2 className="h-3.5 w-3.5" />
            Partager
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Recommencer
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {recommendations.map((recommendation) => (
          <PlatformCard
            key={recommendation.platform_data?.slug ?? recommendation.rank}
            recommendation={recommendation}
            onClick={() => {
              const slug = recommendation.platform_data?.slug
              if (slug) handleCardClick(slug)
            }}
          />
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-6 text-center">
          <h3 className="text-lg font-semibold text-white">Envie qu'on s'occupe de tout ?</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
            On livre votre projet de l'idée au produit sur {topPlatformName}. Le forfait adapté dépend de la
            complexité de votre idée
            {analysis && <> — la vôtre est estimée à {analysis.complexity_score}/10</>}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const isMatch = tier.key === matchingTierKey
            return (
              <div
                key={tier.key}
                className={`glass card-hover relative flex flex-col gap-4 rounded-2xl p-6 ${
                  isMatch ? 'ring-2 ring-amber-500/60' : ''
                }`}
              >
                <div>
                  {isMatch && (
                    <span className="gradient-text mb-2 inline-block text-[11px] font-semibold uppercase tracking-wide">
                      Recommandé pour vous
                    </span>
                  )}
                  <h4 className="text-base font-semibold text-white">{tier.name}</h4>
                  <p className="mt-1 text-xs text-gray-400">{tier.tagline}</p>
                </div>
                <ul className="flex flex-1 flex-col gap-2">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={buildQuoteHref(tier.name)}
                  className="btn-premium mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-xs font-medium text-white transition hover:opacity-90"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Demander un devis
                </a>
              </div>
            )
          })}
        </div>

        <div className="mt-4 text-center">
          <a href={contactHref} className="text-xs font-medium text-amber-300 hover:underline">
            Ou décrivez-nous votre projet directement →
          </a>
        </div>
      </div>

      <ShareableCardModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        analysis={analysis}
        topRecommendation={topRecommendation}
      />
    </div>
  )
}
