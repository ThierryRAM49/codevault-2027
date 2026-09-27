export interface PricingTier {
  key: string
  name: string
  complexityRange: [number, number]
  tagline: string
  includes: string[]
}

export const PRICING_TIERS: PricingTier[] = [
  {
    key: 'essentiel',
    name: 'Essentiel',
    complexityRange: [1, 3],
    tagline: 'Landing page, MVP ou prototype simple',
    includes: [
      'Une idée claire, mise en ligne rapidement',
      'Design sur-mesure',
      'Déploiement sur la plateforme recommandée',
    ],
  },
  {
    key: 'standard',
    name: 'Standard',
    complexityRange: [4, 6],
    tagline: 'Application complète avec comptes et base de données',
    includes: [
      'Authentification et gestion des utilisateurs',
      'Base de données et logique métier',
      'Intégrations tierces courantes (paiement, email...)',
    ],
  },
  {
    key: 'sur-mesure',
    name: 'Sur-mesure',
    complexityRange: [7, 10],
    tagline: 'Architecture avancée, forte échelle ou données sensibles',
    includes: [
      'Architecture scalable et sécurisée',
      'Gestion de données sensibles et conformité',
      'Accompagnement complet, de la conception au déploiement',
    ],
  },
]

export function findTierForComplexity(score: number): PricingTier {
  return (
    PRICING_TIERS.find((tier) => score >= tier.complexityRange[0] && score <= tier.complexityRange[1]) ??
    PRICING_TIERS[PRICING_TIERS.length - 1]
  )
}
