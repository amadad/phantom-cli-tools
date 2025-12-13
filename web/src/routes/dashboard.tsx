import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getQueueStatsFn,
  getQueueItemsFn,
  approveQueueItemFn,
  rejectQueueItemFn
} from '../lib/server/queue'
import { Nav } from '../components/Nav'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard
})

interface QueueItem {
  id: string
  stage: string
  topic: string
  twitterText?: string
  linkedinText?: string
  imageUrl?: string
  createdAt: string
  updatedAt: string
  requiresApproval: boolean
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
}

interface Stats {
  total: number
  pendingApproval: number
  stages: Record<string, number>
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const loadData = async () => {
    try {
      const [statsData, itemsData] = await Promise.all([
        getQueueStatsFn(),
        getQueueItemsFn()
      ])
      setStats(statsData)
      setItems(itemsData)
    } catch (error) {
      console.error('Failed to load queue data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleApprove = async (id: string) => {
    try {
      await approveQueueItemFn({ data: { id } })
      loadData()
      setSelectedItem(null)
    } catch (error) {
      console.error('Failed to approve:', error)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await rejectQueueItemFn({ data: { id, reason: 'Rejected via dashboard' } })
      loadData()
      setSelectedItem(null)
    } catch (error) {
      console.error('Failed to reject:', error)
    }
  }

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true
    if (filter === 'pending') return item.stage === 'review' && !item.approvedAt && !item.rejectedAt
    return item.stage === filter
  })

  const stageColors: Record<string, string> = {
    research: 'bg-blue-500',
    write: 'bg-purple-500',
    image: 'bg-pink-500',
    review: 'bg-yellow-500',
    post: 'bg-orange-500',
    done: 'bg-green-500',
    failed: 'bg-red-500'
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <Nav />

      <main className="pt-14">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-medium tracking-tight mb-8">Dashboard</h1>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="spinner w-8 h-8" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-3xl font-light mb-1">{stats?.total || 0}</div>
                  <div className="text-sm text-neutral-500">Total Items</div>
                </div>
                <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-3xl font-light mb-1">{stats?.pendingApproval || 0}</div>
                  <div className="text-sm text-neutral-500">Pending Approval</div>
                </div>
                <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-3xl font-light mb-1">{stats?.stages?.done || 0}</div>
                  <div className="text-sm text-neutral-500">Published</div>
                </div>
                <div className="p-6 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-3xl font-light mb-1">{stats?.stages?.failed || 0}</div>
                  <div className="text-sm text-neutral-500">Failed</div>
                </div>
              </div>

              {/* Pipeline visualization */}
              <div className="mb-12">
                <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
                  Pipeline Status
                </h2>
                <div className="flex items-center gap-2 overflow-x-auto pb-4">
                  {['research', 'write', 'image', 'review', 'post', 'done'].map((stage, i) => (
                    <div key={stage} className="flex items-center">
                      <button
                        onClick={() => setFilter(stage)}
                        className={`px-4 py-2 border text-sm transition-colors ${
                          filter === stage
                            ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black'
                            : 'border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white'
                        }`}
                      >
                        {stage}
                        {stats?.stages?.[stage] ? (
                          <span className="ml-2 text-xs opacity-60">{stats.stages[stage]}</span>
                        ) : null}
                      </button>
                      {i < 5 && (
                        <div className="w-4 h-px bg-neutral-300 dark:bg-neutral-700" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setFilter('all')}
                  className={`text-sm ${filter === 'all' ? 'text-black dark:text-white' : 'text-neutral-500'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`text-sm ${filter === 'pending' ? 'text-black dark:text-white' : 'text-neutral-500'}`}
                >
                  Pending Approval
                </button>
              </div>

              {/* Queue items */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-neutral-200 dark:border-neutral-800">
                  <p className="text-neutral-500 mb-4">No items in queue</p>
                  <Link to="/generate" className="btn">
                    Create Content
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.map(item => (
                    <div
                      key={item.id}
                      className="border border-neutral-200 dark:border-neutral-800 p-6 hover:border-black dark:hover:border-white transition-colors cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`w-2 h-2 rounded-full ${stageColors[item.stage] || 'bg-neutral-500'}`}
                            />
                            <span className="text-xs uppercase tracking-wider text-neutral-500">
                              {item.stage}
                            </span>
                            {item.approvedAt && (
                              <span className="text-xs text-green-500">Approved</span>
                            )}
                            {item.rejectedAt && (
                              <span className="text-xs text-red-500">Rejected</span>
                            )}
                          </div>
                          <h3 className="font-medium mb-1 truncate">{item.topic}</h3>
                          {item.twitterText && (
                            <p className="text-sm text-neutral-500 truncate">
                              {item.twitterText}
                            </p>
                          )}
                        </div>
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-16 h-16 object-cover flex-shrink-0"
                          />
                        )}
                      </div>
                      <div className="mt-4 text-xs text-neutral-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Item detail modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${stageColors[selectedItem.stage] || 'bg-neutral-500'}`}
                  />
                  <span className="text-xs uppercase tracking-wider text-neutral-500">
                    {selectedItem.stage}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-neutral-500 hover:text-black dark:hover:text-white"
                >
                  Close
                </button>
              </div>
              <h2 className="text-xl font-medium mt-4">{selectedItem.topic}</h2>
            </div>

            <div className="p-6 space-y-6">
              {selectedItem.imageUrl && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Image</h3>
                  <img
                    src={selectedItem.imageUrl}
                    alt=""
                    className="w-full max-w-md"
                  />
                </div>
              )}

              {selectedItem.twitterText && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Twitter</h3>
                  <p className="text-sm">{selectedItem.twitterText}</p>
                </div>
              )}

              {selectedItem.linkedinText && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">LinkedIn</h3>
                  <p className="text-sm">{selectedItem.linkedinText}</p>
                </div>
              )}

              <div className="text-xs text-neutral-400">
                <p>ID: {selectedItem.id}</p>
                <p>Created: {new Date(selectedItem.createdAt).toLocaleString()}</p>
                <p>Updated: {new Date(selectedItem.updatedAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Actions for pending items */}
            {selectedItem.stage === 'review' &&
              !selectedItem.approvedAt &&
              !selectedItem.rejectedAt && (
                <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-4">
                  <button
                    onClick={() => handleApprove(selectedItem.id)}
                    className="btn flex-1"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(selectedItem.id)}
                    className="btn-outline flex-1"
                  >
                    Reject
                  </button>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
