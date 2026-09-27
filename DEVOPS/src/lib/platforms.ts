export interface Platform {
  slug: string
  name: string
  tagline: string
  description: string
  website: string
  icon: string
  pros: string[]
  bestFor: string[]
  complexity: [number, number]
  scale: [number, number]
  sensitivity: [number, number]
}

export const PLATFORMS: Platform[] = [
  {
    slug: 'vercel',
    name: 'Vercel',
    tagline: 'Déployez vos frontends et apps Next.js en quelques minutes',
    description:
      "Une plateforme sans configuration conçue pour Next.js, avec des prévisualisations instantanées et un réseau edge mondial. Idéale quand l'app est surtout du frontend avec une logique serveur légère.",
    website: 'https://vercel.com',
    icon: 'triangle',
    pros: ['Déploiement en un git push', 'URLs de prévisualisation instantanées', 'Excellent support Next.js', 'Plan gratuit généreux'],
    bestFor: ['saas', 'content', 'ecommerce', 'other'],
    complexity: [1, 6],
    scale: [1, 6],
    sensitivity: [1, 5],
  },
  {
    slug: 'netlify',
    name: 'Netlify',
    tagline: 'Sites statiques et JAMstack, en toute simplicité',
    description:
      'Parfait pour les sites vitrines, la documentation et les apps statiques/JAMstack avec quelques fonctions serverless légères. CI simple depuis un dépôt git, aucun serveur à gérer.',
    website: 'https://netlify.com',
    icon: 'globe',
    pros: ['CI/CD très simple', 'Formulaires et fonctions intégrés', 'Excellente expérience dev pour le statique'],
    bestFor: ['content', 'other'],
    complexity: [1, 5],
    scale: [1, 5],
    sensitivity: [1, 4],
  },
  {
    slug: 'supabase',
    name: 'Supabase',
    tagline: 'Postgres, authentification et stockage en tant que backend',
    description:
      "Une alternative open-source à Firebase : base Postgres managée, authentification, stockage et abonnements temps réel. Idéal quand l'idée a besoin d'une vraie base de données et de comptes utilisateurs rapidement.",
    website: 'https://supabase.com',
    icon: 'database',
    pros: ['Vraie base de données Postgres', 'Auth intégrée et sécurité au niveau des lignes', 'Temps réel et stockage inclus'],
    bestFor: ['saas', 'productivity', 'social', 'marketplace'],
    complexity: [2, 7],
    scale: [2, 6],
    sensitivity: [2, 6],
  },
  {
    slug: 'firebase',
    name: 'Firebase',
    tagline: 'Synchronisation temps réel, auth et hébergement pour vos apps',
    description:
      'Un BaaS mature soutenu par Google avec base temps réel/Firestore, authentification, hébergement et notifications push. Un bon choix pour un produit mobile-first ou fortement temps réel.',
    website: 'https://firebase.google.com',
    icon: 'flame',
    pros: ['SDKs mobiles matures', 'Synchronisation de données en temps réel', 'Plan gratuit généreux', 'Notifications push faciles'],
    bestFor: ['social', 'productivity', 'gaming', 'other'],
    complexity: [2, 7],
    scale: [2, 7],
    sensitivity: [2, 6],
  },
  {
    slug: 'railway',
    name: 'Railway',
    tagline: 'Des apps full-stack déployées en quelques clics',
    description:
      "Un hébergeur pensé pour les développeurs : apps full-stack, workers en arrière-plan et bases de données. Plus rapide à mettre en route qu'une infra cloud brute, sans trop sacrifier le contrôle.",
    website: 'https://railway.app',
    icon: 'zap',
    pros: ['Postgres/Redis en un clic', 'Tarification simple', 'Idéal pour les petites équipes'],
    bestFor: ['saas', 'productivity', 'other'],
    complexity: [2, 6],
    scale: [1, 5],
    sensitivity: [1, 5],
  },
  {
    slug: 'render',
    name: 'Render',
    tagline: 'Services web, APIs, tâches cron et Docker',
    description:
      'Un hébergement prévisible et autoscalable pour APIs, jobs en arrière-plan, sites statiques et services Dockerisés, avec bases Postgres et Redis managées à côté.',
    website: 'https://render.com',
    icon: 'server',
    pros: ['Autoscaling natif', 'Support Docker natif', 'Bases de données et cron managés'],
    bestFor: ['saas', 'ecommerce', 'other'],
    complexity: [3, 7],
    scale: [2, 6],
    sensitivity: [2, 6],
  },
  {
    slug: 'fly-io',
    name: 'Fly.io',
    tagline: 'Faites tourner votre app près de vos utilisateurs, partout dans le monde',
    description:
      'Déploie des conteneurs dans des régions edge partout dans le monde pour des apps à faible latence. Un bon choix dès que la latence, le multi-région ou le edge computing deviennent importants.',
    website: 'https://fly.io',
    icon: 'globe-2',
    pros: ['Déploiements mondiaux à faible latence', 'Contrôle total des conteneurs', 'Clustering Postgres intégré'],
    bestFor: ['gaming', 'social', 'saas', 'other'],
    complexity: [3, 8],
    scale: [3, 8],
    sensitivity: [3, 7],
  },
  {
    slug: 'digitalocean',
    name: 'DigitalOcean App Platform',
    tagline: 'Un cloud simple avec une tarification prévisible',
    description:
      'Un juste milieu entre VMs brutes et PaaS entièrement managé : tarification prévisible, bases de données managées, et assez de contrôle pour les apps de petites et moyennes entreprises.',
    website: 'https://www.digitalocean.com/products/app-platform',
    icon: 'cloud',
    pros: ['Tarification fixe et prévisible', 'Bases de données managées', 'Exploitation simple pour petites équipes'],
    bestFor: ['ecommerce', 'saas', 'internal', 'other'],
    complexity: [3, 7],
    scale: [3, 7],
    sensitivity: [3, 6],
  },
  {
    slug: 'aws',
    name: 'AWS',
    tagline: 'Contrôle maximal pour les systèmes complexes et réglementés',
    description:
      "La boîte à outils la plus complète qui existe : n'importe quelle architecture, n'importe quelle exigence de conformité, n'importe quelle échelle — au prix d'une mise en place et d'une exploitation plus lourdes.",
    website: 'https://aws.amazon.com',
    icon: 'boxes',
    pros: ["Gère n'importe quelle échelle", 'Outillage de conformité poussé (HIPAA, SOC2…)', 'Tous les blocs imaginables'],
    bestFor: ['fintech', 'healthtech', 'internal', 'other'],
    complexity: [5, 10],
    scale: [5, 10],
    sensitivity: [5, 10],
  },
]

interface CategoryDef {
  key: string
  label: string
  keywords: string[]
}

const CATEGORIES: CategoryDef[] = [
  { key: 'ecommerce', label: 'e-commerce', keywords: ['boutique', 'e-commerce', 'panier', 'vente en ligne', 'commande', 'shop', 'store', 'checkout'] },
  { key: 'fintech', label: 'fintech', keywords: ['paiement', 'banque', 'finance', 'facture', 'portefeuille', 'trading', 'comptabilité', 'facturation'] },
  { key: 'healthtech', label: 'santé', keywords: ['santé', 'médical', 'patient', 'clinique', 'thérapie', 'médecin', 'suivi de forme'] },
  { key: 'edtech', label: 'éducation', keywords: ['apprendre', 'cours', 'étudiant', 'professeur', 'classe', 'quiz', 'tutorat', 'formation'] },
  { key: 'social', label: 'social', keywords: ['social', 'chat', 'communauté', 'amis', 'fil d\'actualité', 'suivre', 'messagerie', 'rencontre'] },
  { key: 'gaming', label: 'jeu', keywords: ['jeu', 'jeu vidéo', 'multijoueur', 'classement', 'joueur'] },
  { key: 'productivity', label: 'productivité', keywords: ['tâche', 'productivité', 'note', 'calendrier', 'workflow', 'gestion de projet', 'à faire'] },
  { key: 'marketplace', label: 'marketplace', keywords: ['marketplace', 'acheteurs et vendeurs', 'annonces', 'réservation', 'location'] },
  { key: 'content', label: 'média', keywords: ['blog', 'newsletter', 'vidéo', 'podcast', 'contenu', 'publication', 'streaming', 'portfolio'] },
  { key: 'internal', label: 'interne', keywords: ['outil interne', 'panneau admin', 'tableau de bord équipe', 'outil ops', 'back office'] },
  { key: 'saas', label: 'SaaS', keywords: ['saas', 'abonnement', 'outil b2b', 'plateforme pour entreprises', 'outil analytique'] },
]

const COMPLEXITY_KEYWORDS: Record<string, number> = {
  'temps réel': 2, realtime: 2, 'temps-réel': 2, 'intelligence artificielle': 2, ia: 1, ai: 1, 'multi-tenant': 2,
  microservice: 2, microservices: 2, intégration: 1, workflow: 1, vidéo: 2, streaming: 2,
  multijoueur: 2, blockchain: 3, 'chaîne de blocs': 3, chiffrement: 1, 'hors ligne': 1, multilingue: 1, notification: 1,
  simple: -2, basique: -2, mvp: -1, prototype: -2, landing: -2, statique: -2, 'page unique': -1,
}

const SCALE_KEYWORDS: Record<string, number> = {
  "millions d'utilisateurs": 4, entreprise: 3, mondial: 2, international: 2, échelle: 1, milliers: 1,
  startup: -1, prototype: -2, 'petite entreprise': -1, personnel: -2, 'juste pour moi': -2,
  niche: -1, local: -1,
}

const SENSITIVITY_KEYWORDS: Record<string, number> = {
  santé: 3, médical: 3, paiement: 3, banque: 3, financier: 3, 'carte bancaire': 3, 'carte de crédit': 3,
  rgpd: 2, 'données personnelles': 2, gouvernement: 3, juridique: 2, enfants: 2, biométrique: 3,
  public: -1, ouvert: -1, démo: -2,
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function scoreFromKeywords(text: string, weights: Record<string, number>, base: number) {
  let score = base
  for (const [keyword, weight] of Object.entries(weights)) {
    if (text.includes(keyword)) score += weight
  }
  return clamp(Math.round(score), 1, 10)
}

function detectCategory(text: string): CategoryDef {
  let best: CategoryDef | null = null
  let bestHits = 0
  for (const category of CATEGORIES) {
    const hits = category.keywords.filter((k) => text.includes(k)).length
    if (hits > bestHits) {
      bestHits = hits
      best = category
    }
  }
  return best ?? { key: 'other', label: 'généraliste', keywords: [] }
}

const FILLER_WORDS = ['idée', 'concept', 'produit', 'projet', 'créateurs', 'utilisateurs', 'personnes', 'équipes']

function buildSixWordDescription(idea: string, category: CategoryDef): string {
  const stopwords = new Set([
    'un', 'une', 'le', 'la', 'les', 'des', 'de', 'du', 'pour', 'et', 'ou', 'que', 'avec', 'est', 'sont',
    'je', 'veux', 'créer', 'construire', 'application', 'app', 'appli', 'mon', 'ma', 'mes', 'comme', 'voudrais',
    'besoin', 'il', 'elle', 'en', 'sur', 'ce', 'cette', 'être', 'qui', 'dans', 'au', 'aux', 'entre',
  ])
  const categoryWords = new Set([category.label.toLowerCase(), ...category.keywords])

  const words = idea
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w) && !categoryWords.has(w))

  const keywords: string[] = []
  for (const w of words) {
    if (!keywords.includes(w)) keywords.push(w)
    if (keywords.length >= 3) break
  }

  const parts = ['Une', 'appli', category.label, 'pour', ...keywords]
  let fillerIndex = 0
  while (parts.length < 6) {
    parts.push(FILLER_WORDS[fillerIndex % FILLER_WORDS.length])
    fillerIndex++
  }
  return parts.slice(0, 6).join(' ')
}

export interface LocalAnalysis {
  ideaText: string
  complexity_score: number
  scale_score: number
  sensitivity_score: number
  purpose_category: string
  purpose_key: string
  six_word_description: string
}

export function analyzeIdeaLocally(idea: string): LocalAnalysis {
  const text = idea.toLowerCase()
  const category = detectCategory(text)

  return {
    ideaText: idea,
    complexity_score: scoreFromKeywords(text, COMPLEXITY_KEYWORDS, 4),
    scale_score: scoreFromKeywords(text, SCALE_KEYWORDS, 4),
    sensitivity_score: scoreFromKeywords(text, SENSITIVITY_KEYWORDS, 2),
    purpose_category: category.label,
    purpose_key: category.key,
    six_word_description: buildSixWordDescription(idea, category),
  }
}

export interface ScoredPlatform {
  platform: Platform
  matchScore: number
}

function rangeFit(value: number, [min, max]: [number, number]): number {
  if (value >= min && value <= max) return 1
  const distance = value < min ? min - value : value - max
  return clamp(1 - distance / 6, 0, 1)
}

export function rankPlatforms(analysis: LocalAnalysis): ScoredPlatform[] {
  const scored = PLATFORMS.map((platform) => {
    const complexityFit = rangeFit(analysis.complexity_score, platform.complexity)
    const scaleFit = rangeFit(analysis.scale_score, platform.scale)
    const sensitivityFit = rangeFit(analysis.sensitivity_score, platform.sensitivity)
    const categoryBonus = platform.bestFor.includes(analysis.purpose_key) ? 0.15 : 0

    const rawScore = complexityFit * 0.4 + scaleFit * 0.3 + sensitivityFit * 0.15 + categoryBonus
    const matchScore = Math.round(clamp(rawScore, 0, 1) * 100)
    return { platform, matchScore }
  })

  return scored.sort((a, b) => b.matchScore - a.matchScore)
}
