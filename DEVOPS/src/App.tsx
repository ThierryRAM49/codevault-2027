import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout } from './pages/Layout'
import { HomePage } from './pages/HomePage'
import { AnalysisPage } from './pages/AnalysisPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { PromptModal } from './components/PromptModal'
import { useAppAnalysis } from './hooks/useAppAnalysis'
import type { AppAnalysis, Recommendation } from './types'
// Main application component
function App() {
  const [appIdea, setAppIdea] = useState<string | null>(null)
  const [processingStep, setProcessingStep] = useState<'analyzing' | 'getting-recommendations' | null>(null)
  const [analysis, setAnalysis] = useState<AppAnalysis | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  // Modal state
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null)
  const { loading, error, analyzeAppIdea, getRecommendations, clearError } = useAppAnalysis()
  const navigate = useNavigate()
  const location = useLocation()
// Effect to handle app idea analysis and recommendations fetching
  useEffect(() => {
    const performAnalysis = async () => {
      if (location.pathname === '/analysis' && appIdea && !analysis && !loading) {
        clearError()
        setProcessingStep('analyzing')

        try {
          const analysisResult = await analyzeAppIdea(appIdea)
          if (analysisResult) {
            setAnalysis(analysisResult)
            setProcessingStep('getting-recommendations')
            const recommendationsResult = await getRecommendations(
              analysisResult.analysis_id || analysisResult.id,
            )
            if (recommendationsResult && recommendationsResult.length > 0) {
              setRecommendations(recommendationsResult)
              navigate('/recommendations')
            } else {
              throw new Error('No recommendations found for your app idea')
            }
          } else {
            throw new Error('Analysis failed - please try again')
          }
        } catch (err: any) {
          // error is already set by the hook
        } finally {
          setProcessingStep(null)
        }
      }
    }
    performAnalysis()
  }, [location.pathname, appIdea, analysis, loading, analyzeAppIdea, getRecommendations, navigate, clearError])

  const handleCardClick = (platformSlug: string) => {
    const recommendation = recommendations.find(r => r.platform_data?.slug === platformSlug)
    if (recommendation && analysis) {
      setSelectedRecommendation(recommendation)
      setPromptModalOpen(true)
    }
  }
// Reset the app state
  const resetApp = () => {
    setAppIdea(null)
    setAnalysis(null)
    setRecommendations([])
    setSelectedRecommendation(null)
    clearError()
    navigate('/')
  }
  
  const handleAppIdeaSubmit = async (appIdea: string) => {
    setAppIdea(appIdea)
    navigate('/analysis')
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={<HomePage handleAppIdeaSubmit={handleAppIdeaSubmit} loading={loading} />}
          />
          <Route
            path="analysis"
            element={
              <AnalysisPage
                processingStep={processingStep}
                error={error}
                analysis={analysis}
                clearError={clearError}
                resetApp={resetApp}
              />
            }
          />
          <Route
            path="recommendations"
            element={
              <RecommendationsPage
                recommendations={recommendations}
                analysis={analysis}
                error={error}
                handleCardClick={handleCardClick}
              />
            }
          />
        </Route>
      </Routes>

      <PromptModal
        isOpen={promptModalOpen}
        onClose={() => {
          setPromptModalOpen(false)
          setSelectedRecommendation(null)
        }}
        recommendation={selectedRecommendation}
        analysis={analysis}
      />
    </>
  )
}

export default App