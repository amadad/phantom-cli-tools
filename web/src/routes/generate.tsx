import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  generateContent,
  publishContent,
  listBrands,
  refineCopy,
  refineImage,
  schedulePost,
  type GenerationResult,
  type BrandSummary
} from '../lib/api'
import { Nav } from '../components/Nav'

export const Route = createFileRoute('/generate')({
  component: Generate,
})

type Step = 'brand' | 'input' | 'generating' | 'preview' | 'publishing' | 'done'

type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads'

const PLATFORMS: { id: Platform; name: string; requiresImage: boolean }[] = [
  { id: 'twitter', name: 'Twitter', requiresImage: false },
  { id: 'linkedin', name: 'LinkedIn', requiresImage: false },
  { id: 'facebook', name: 'Facebook', requiresImage: false },
  { id: 'instagram', name: 'Instagram', requiresImage: true },
  { id: 'threads', name: 'Threads', requiresImage: false },
]

function Generate() {
  const [step, setStep] = useState<Step>('brand')
  const [brands, setBrands] = useState<BrandSummary[]>([])
  const [selectedBrand, setSelectedBrand] = useState<BrandSummary | null>(null)
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publishResults, setPublishResults] = useState<any>(null)
  const [loadingBrands, setLoadingBrands] = useState(true)

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['twitter', 'linkedin'])

  // Scheduling
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

  // Editable fields for refinement
  const [sourceContent, setSourceContent] = useState('')
  const [imageSubject, setImageSubject] = useState('')
  const [isRefiningCopy, setIsRefiningCopy] = useState(false)
  const [isRefiningImage, setIsRefiningImage] = useState(false)

  useEffect(() => {
    loadBrands()
  }, [])

  // When result comes in, set up editable fields
  useEffect(() => {
    if (result) {
      // Extract a reasonable source content from the result
      setSourceContent(result.content.linkedin.text || result.content.twitter.text)
      // Extract image subject from prompt (simplified)
      setImageSubject(result.topic)
    }
  }, [result?.id])

  const loadBrands = async () => {
    try {
      const data = await listBrands()
      setBrands(data)
      if (data.length === 1) {
        setSelectedBrand(data[0])
      }
    } catch (err) {
      console.error('Failed to load brands:', err)
    } finally {
      setLoadingBrands(false)
    }
  }

  const handleSelectBrand = (brand: BrandSummary) => {
    setSelectedBrand(brand)
    setStep('input')
  }

  const handleGenerate = async () => {
    if (!topic.trim() || !selectedBrand) return

    setError(null)
    setStep('generating')

    try {
      const data = await generateContent(topic, selectedBrand.id)
      setResult(data)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStep('input')
    }
  }

  const handleRefineCopy = async () => {
    if (!sourceContent.trim() || !selectedBrand || !result) return

    setIsRefiningCopy(true)
    try {
      const refined = await refineCopy(sourceContent, selectedBrand.id)
      setResult({
        ...result,
        content: {
          twitter: refined.twitter,
          linkedin: refined.linkedin
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    } finally {
      setIsRefiningCopy(false)
    }
  }

  const handleRefineImage = async () => {
    if (!imageSubject.trim() || !selectedBrand || !result) return

    setIsRefiningImage(true)
    try {
      const refined = await refineImage(imageSubject, selectedBrand.id)
      setResult({
        ...result,
        imageUrl: refined.imageUrl,
        imagePrompt: refined.imagePrompt,
        imageModel: refined.imageModel
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    } finally {
      setIsRefiningImage(false)
    }
  }

  const handlePublish = async () => {
    if (!result || !selectedBrand) return

    setStep('publishing')

    try {
      const data = await publishContent(result.id, selectedPlatforms, selectedBrand.id)
      setPublishResults(data)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed')
      setStep('preview')
    }
  }

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleSchedule = async () => {
    if (!result || !selectedBrand || !scheduleDate || !scheduleTime) return

    setIsScheduling(true)
    setError(null)

    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`)

      if (scheduledFor <= new Date()) {
        throw new Error('Scheduled time must be in the future')
      }

      const data = await schedulePost(result.id, selectedBrand.id, selectedPlatforms, scheduledFor)

      if (!data.success) {
        throw new Error(data.error || 'Scheduling failed')
      }

      setPublishResults({
        scheduled: true,
        scheduledFor: scheduledFor.toISOString(),
        scheduleId: data.scheduleId,
        results: selectedPlatforms.map(p => ({ platform: p, success: true, scheduled: true }))
      })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scheduling failed')
    } finally {
      setIsScheduling(false)
      setShowScheduler(false)
    }
  }

  const handleReset = () => {
    setStep('brand')
    setSelectedBrand(null)
    setTopic('')
    setResult(null)
    setError(null)
    setPublishResults(null)
    setSourceContent('')
    setImageSubject('')
  }

  const handleBackToBrand = () => {
    setStep('brand')
    setSelectedBrand(null)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <Nav />

      <main className="pt-14 min-h-screen">
        {/* Error display */}
        {error && (
          <div className="max-w-6xl mx-auto px-6 pt-6">
            <div className="p-4 border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Brand Selection */}
        {step === 'brand' && (
          <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-medium tracking-tight mb-3">
                Select a brand
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400">
                Choose which brand profile to use for content generation.
              </p>
            </div>

            {loadingBrands ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner" />
              </div>
            ) : brands.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-300 dark:border-neutral-700">
                <p className="text-neutral-500 mb-2">No brands found</p>
                <p className="text-sm text-neutral-400">Add a brand YAML file to /brands/</p>
              </div>
            ) : (
              <div className="space-y-3">
                {brands.map(brand => (
                  <button
                    key={brand.id}
                    onClick={() => handleSelectBrand(brand)}
                    className="w-full text-left p-6 border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: brand.primaryColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium mb-1">{brand.name}</h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                          {brand.tone}
                        </p>
                        {brand.topics.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {brand.topics.slice(0, 3).map(t => (
                              <span
                                key={t}
                                className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Topic Input */}
        {step === 'input' && selectedBrand && (
          <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
            <div>
              <button
                onClick={handleBackToBrand}
                className="text-sm text-neutral-500 hover:text-black dark:hover:text-white mb-4 flex items-center gap-1"
              >
                <span>←</span> Change brand
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: selectedBrand.primaryColor }}
                />
                <span className="text-sm text-neutral-500">{selectedBrand.name}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-medium tracking-tight mb-3">
                What do you want to share?
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400">
                Enter a topic and we'll generate branded content.
              </p>
            </div>

            {selectedBrand.topics.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Suggested topics</p>
                <div className="flex flex-wrap gap-2">
                  {selectedBrand.topics.map(t => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className="text-sm px-3 py-1 border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Tips for managing caregiver burnout during the holidays"
              className="input h-40 font-light"
              autoFocus
            />

            <button
              onClick={handleGenerate}
              disabled={!topic.trim()}
              className="btn w-full"
            >
              Generate Content
            </button>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === 'generating' && (
          <div className="max-w-2xl mx-auto px-6 py-16">
            <div className="flex flex-col items-center justify-center py-24">
              <div className="spinner mb-8" />
              <h2 className="text-2xl font-medium mb-2">Creating your content</h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-sm">
                Generating image and copy for {selectedBrand?.name}...
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Preview - Two Column Layout */}
        {step === 'preview' && result && selectedBrand && (
          <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: selectedBrand.primaryColor }}
                />
                <span className="text-sm text-neutral-500">{selectedBrand.name}</span>
              </div>
              <button onClick={handleReset} className="btn-ghost text-sm">
                Start over
              </button>
            </div>

            {/* Source Content - The "seed" that cascades */}
            <div className="mb-8 p-6 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Source Content
                </label>
                <button
                  onClick={handleRefineCopy}
                  disabled={isRefiningCopy}
                  className="text-xs text-neutral-500 hover:text-black dark:hover:text-white flex items-center gap-1"
                >
                  {isRefiningCopy ? (
                    <>
                      <span className="w-3 h-3 border border-neutral-400 border-t-black dark:border-t-white rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update platforms ↓'
                  )}
                </button>
              </div>
              <textarea
                value={sourceContent}
                onChange={(e) => setSourceContent(e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-sm leading-relaxed resize-none focus:outline-none focus:ring-0 min-h-[80px]"
                placeholder="Edit this source content to refine the platform versions..."
              />
              <p className="text-xs text-neutral-400 mt-2">
                Edit above and click "Update platforms" to regenerate Twitter & LinkedIn copy
              </p>
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Image */}
              <div className="space-y-4">
                <div className="border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  {isRefiningImage ? (
                    <div className="aspect-square flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
                      <div className="text-center">
                        <div className="spinner mb-4 mx-auto" />
                        <p className="text-sm text-neutral-500">Generating image...</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={result.imageUrl}
                      alt="Generated content"
                      className="w-full aspect-square object-cover"
                    />
                  )}
                </div>

                {/* Image Prompt */}
                <div className="p-4 border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Image Subject
                    </label>
                    <button
                      onClick={handleRefineImage}
                      disabled={isRefiningImage}
                      className="text-xs text-neutral-500 hover:text-black dark:hover:text-white"
                    >
                      {isRefiningImage ? 'Generating...' : 'Regenerate ↻'}
                    </button>
                  </div>
                  <textarea
                    value={imageSubject}
                    onChange={(e) => setImageSubject(e.target.value)}
                    className="w-full bg-transparent border-0 p-0 text-sm leading-relaxed resize-none focus:outline-none focus:ring-0 min-h-[60px]"
                    placeholder="Describe what the image should show..."
                  />
                </div>
              </div>

              {/* Right Column - Social Channels */}
              <div className="space-y-4">
                {/* Platform Selection */}
                <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                  <label className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3 block">
                    Publish to
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(platform => (
                      <button
                        key={platform.id}
                        onClick={() => togglePlatform(platform.id)}
                        className={`px-3 py-1.5 text-sm border transition-colors ${
                          selectedPlatforms.includes(platform.id)
                            ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black'
                            : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'
                        }`}
                      >
                        {platform.name}
                        {platform.requiresImage && !result.imageUrl && (
                          <span className="ml-1 text-xs opacity-50">(needs image)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Twitter */}
                {selectedPlatforms.includes('twitter') && (
                  <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Twitter
                      </span>
                      <span className="text-xs text-neutral-400">
                        {result.content.twitter.text.length}/280
                      </span>
                    </div>
                    <p className="mb-4 leading-relaxed">{result.content.twitter.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {result.content.twitter.hashtags.map((tag) => (
                        <span key={tag} className="text-sm text-neutral-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* LinkedIn */}
                {selectedPlatforms.includes('linkedin') && (
                  <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        LinkedIn
                      </span>
                    </div>
                    <p className="mb-4 leading-relaxed whitespace-pre-wrap">{result.content.linkedin.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {result.content.linkedin.hashtags.map((tag) => (
                        <span key={tag} className="text-sm text-neutral-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Facebook */}
                {selectedPlatforms.includes('facebook') && (
                  <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Facebook
                      </span>
                    </div>
                    <p className="mb-4 leading-relaxed whitespace-pre-wrap">
                      {result.content.facebook?.text || result.content.linkedin.text}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(result.content.facebook?.hashtags || result.content.linkedin.hashtags).map((tag) => (
                        <span key={tag} className="text-sm text-neutral-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instagram */}
                {selectedPlatforms.includes('instagram') && (
                  <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Instagram
                      </span>
                      {!result.imageUrl && (
                        <span className="text-xs text-amber-500">Requires image</span>
                      )}
                    </div>
                    <p className="mb-4 leading-relaxed whitespace-pre-wrap">
                      {result.content.instagram?.text || result.content.linkedin.text}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(result.content.instagram?.hashtags || result.content.linkedin.hashtags).map((tag) => (
                        <span key={tag} className="text-sm text-neutral-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Threads */}
                {selectedPlatforms.includes('threads') && (
                  <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Threads
                      </span>
                    </div>
                    <p className="mb-4 leading-relaxed">
                      {result.content.threads?.text || result.content.twitter.text}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(result.content.threads?.hashtags || result.content.twitter.hashtags).map((tag) => (
                        <span key={tag} className="text-sm text-neutral-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Publish Actions */}
                <div className="pt-4 space-y-3">
                  {showScheduler ? (
                    <div className="p-4 border border-neutral-200 dark:border-neutral-800 space-y-3">
                      <label className="text-xs font-medium uppercase tracking-wider text-neutral-500 block">
                        Schedule for later
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-sm"
                        />
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-32 px-3 py-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSchedule}
                          disabled={!scheduleDate || !scheduleTime || isScheduling}
                          className="btn flex-1"
                        >
                          {isScheduling ? 'Scheduling...' : 'Confirm Schedule'}
                        </button>
                        <button
                          onClick={() => setShowScheduler(false)}
                          className="btn-outline px-4"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handlePublish}
                        disabled={selectedPlatforms.length === 0}
                        className="btn w-full"
                      >
                        Publish Now
                      </button>
                      <button
                        onClick={() => setShowScheduler(true)}
                        disabled={selectedPlatforms.length === 0}
                        className="btn-outline w-full"
                      >
                        Schedule for Later
                      </button>
                    </>
                  )}
                  <p className="text-xs text-neutral-500 text-center">
                    {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''} selected · {selectedBrand?.name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Publishing */}
        {step === 'publishing' && (
          <div className="max-w-2xl mx-auto px-6 py-16">
            <div className="flex flex-col items-center justify-center py-24">
              <div className="spinner mb-8" />
              <h2 className="text-2xl font-medium mb-2">Publishing</h2>
              <p className="text-neutral-500 dark:text-neutral-400">
                Posting to your connected platforms...
              </p>
            </div>
          </div>
        )}

        {/* Step 6: Done */}
        {step === 'done' && publishResults && (
          <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
            <div className="text-center py-8">
              <div className="w-16 h-16 border-2 border-black dark:border-white rounded-full flex items-center justify-center mx-auto mb-6">
                {publishResults.scheduled ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : publishResults.dryRun ? (
                  <span className="text-2xl">~</span>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <h2 className="text-2xl font-medium mb-2">
                {publishResults.scheduled
                  ? 'Scheduled'
                  : publishResults.dryRun
                    ? 'Dry Run Complete'
                    : 'Published'}
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400">
                {publishResults.scheduled
                  ? `Scheduled for ${new Date(publishResults.scheduledFor).toLocaleString()}`
                  : publishResults.dryRun
                    ? 'Content was not actually posted (dry run mode)'
                    : 'Your content is now live'}
              </p>
            </div>

            <div className="border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
              {publishResults.results.map((r: any) => (
                <div key={r.platform} className="flex items-center justify-between p-4">
                  <span className="text-sm font-medium uppercase tracking-wider">{r.platform}</span>
                  <span className={`text-sm ${r.success ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'}`}>
                    {r.success ? 'Success' : 'Failed'}
                    {r.dryRun && ' (dry run)'}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={handleReset} className="btn w-full">
              Create Another
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
