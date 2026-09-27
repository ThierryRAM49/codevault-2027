import { useCallback, useRef, useState } from 'react'
import type { AppAnalysis, Recommendation } from '@/types'
import { analyzeIdeaLocally, rankPlatforms, type LocalAnalysis } from '@/lib/platforms'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildReasoning(analysis: LocalAnalysis, matchScore: number): string {
  if (matchScore >= 80) return 'Excellente correspondance avec la complexité, l\'échelle et la sensibilité de cette idée.'
  if (matchScore >= 55) return 'Bon compromis, avec quelques points à examiner.'
  return 'Envisageable, mais probablement plus (ou moins) de plateforme que nécessaire pour cette idée.'
}

export function useAppAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analysesRef = useRef(new Map<string, LocalAnalysis>())

  const clearError = useCallback(() => setError(null), [])

  const analyzeAppIdea = useCallback(async (idea: string): Promise<AppAnalysis | null> => {
    const trimmed = idea.trim()
    if (trimmed.length < 10) {
      setError("Décrivez un peu plus votre idée d'application (au moins une ou deux phrases).")
      return null
    }

    setLoading(true)
    setError(null)
    try {
      await wait(900)
      const localAnalysis = analyzeIdeaLocally(trimmed)
      const id = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      analysesRef.current.set(id, localAnalysis)

      const result: AppAnalysis = {
        id,
        analysis_id: id,
        complexity_score: localAnalysis.complexity_score,
        scale_score: localAnalysis.scale_score,
        sensitivity_score: localAnalysis.sensitivity_score,
        purpose_category: localAnalysis.purpose_category,
        six_word_description: localAnalysis.six_word_description,
      }
      return result
    } catch {
      setError("Une erreur est survenue lors de l'analyse de votre idée. Veuillez réessayer.")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const getRecommendations = useCallback(async (analysisId: string | number): Promise<Recommendation[]> => {
    const key = String(analysisId)
    const localAnalysis = analysesRef.current.get(key)
    if (!localAnalysis) {
      setError('Cette analyse a été perdue — veuillez renvoyer votre idée.')
      return []
    }

    setLoading(true)
    setError(null)
    try {
      await wait(700)
      const ranked = rankPlatforms(localAnalysis)
      const recommendations: Recommendation[] = ranked.slice(0, 6).map(({ platform, matchScore }, index) => ({
        rank: index + 1,
        match_score: matchScore,
        reasoning: buildReasoning(localAnalysis, matchScore),
        platform_data: {
          slug: platform.slug,
          name: platform.name,
          tagline: platform.tagline,
          description: platform.description,
          website: platform.website,
          icon: platform.icon,
          pros: platform.pros,
        },
      }))
      return recommendations
    } catch {
      setError('Une erreur est survenue lors de la recherche de recommandations. Veuillez réessayer.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, analyzeAppIdea, getRecommendations, clearError }
}
