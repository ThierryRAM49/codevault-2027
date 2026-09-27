export interface AppAnalysis {
  complexity_score: number;
  scale_score: number;
  sensitivity_score: number;
  purpose_category: string;
  six_word_description: string;
  analysis_id?: string | number;
  id: string | number;
}

export interface Recommendation {
  rank: number;
  match_score: number;
  reasoning: string;
  platform_data?: {
    slug: string;
    name: string;
    tagline: string;
    description: string;
    website: string;
    icon: string;
    pros: string[];
  };
}
