import { createFileRoute, Link } from '@tanstack/react-router'
import { Nav } from '../components/Nav'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <Nav />

      {/* Hero */}
      <main className="pt-14">
        <section className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-center px-6">
          <div className="max-w-6xl mx-auto w-full">
            <div className="max-w-2xl">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-medium tracking-tight leading-[1.1] mb-6">
                Brand-driven
                <br />
                content generation
              </h1>
              <p className="text-lg sm:text-xl text-neutral-500 dark:text-neutral-400 mb-10 max-w-lg">
                Transform topics into on-brand images and copy for social media. One workflow, multiple platforms.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/generate" className="btn">
                  Start Creating
                </Link>
                <a href="#how" className="btn-outline">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-neutral-200 dark:border-neutral-800 py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-12">
              How it works
            </h2>

            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              <div className="group">
                <div className="text-6xl font-light text-neutral-200 dark:text-neutral-800 mb-4 group-hover:text-black dark:group-hover:text-white transition-colors">
                  01
                </div>
                <h3 className="text-xl font-medium mb-3">Define your topic</h3>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Describe what you want to share. The system understands your brand voice and visual style.
                </p>
              </div>

              <div className="group">
                <div className="text-6xl font-light text-neutral-200 dark:text-neutral-800 mb-4 group-hover:text-black dark:group-hover:text-white transition-colors">
                  02
                </div>
                <h3 className="text-xl font-medium mb-3">Generate content</h3>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  AI creates a matching image and platform-specific copy tailored to your brand guidelines.
                </p>
              </div>

              <div className="group">
                <div className="text-6xl font-light text-neutral-200 dark:text-neutral-800 mb-4 group-hover:text-black dark:group-hover:text-white transition-colors">
                  03
                </div>
                <h3 className="text-xl font-medium mb-3">Review and publish</h3>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Preview your content, make adjustments, and post directly to Twitter and LinkedIn.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-neutral-200 dark:border-neutral-800 py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16">
              <div>
                <h2 className="text-3xl sm:text-4xl font-medium tracking-tight mb-6">
                  Consistent brand presence across every post
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed mb-8">
                  Define your brand once in a simple configuration file. Every piece of content automatically follows your voice, tone, and visual guidelines.
                </p>
                <Link to="/generate" className="btn-outline">
                  Try it now
                </Link>
              </div>
              <div className="space-y-6">
                <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-medium mb-2">Multi-platform optimization</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Content automatically formatted for each platform's requirements and best practices.
                  </p>
                </div>
                <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-medium mb-2">AI-powered imagery</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Generate unique visuals that match your brand's color palette and aesthetic style.
                  </p>
                </div>
                <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-medium mb-2">Voice consistency</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Copy that sounds like your brand, following your defined tone and writing rules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-neutral-200 dark:border-neutral-800 py-24 px-6">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight mb-6">
              Ready to create?
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
              Start generating brand-consistent content in seconds.
            </p>
            <Link to="/generate" className="btn">
              Get Started
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-neutral-200 dark:border-neutral-800 py-8 px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-sm text-neutral-400">Phantom Loom</span>
            <span className="text-sm text-neutral-400">Topic → Image + Copy → Post</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
