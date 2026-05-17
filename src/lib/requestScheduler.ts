/**
 * Request Scheduler - Prevents database lock conflicts by limiting concurrent requests
 * Ensures only a limited number of requests execute simultaneously
 */

type RequestFn = () => Promise<any>

interface QueuedRequest {
  id: string
  fn: RequestFn
  resolve: (value: any) => void
  reject: (error: any) => void
  priority: number // Higher = execute first
}

class RequestScheduler {
  private queue: QueuedRequest[] = []
  private activeRequests: number = 0
  private maxConcurrent: number = 3 // Max simultaneous requests to DB
  private lastRequestTime: number = 0
  private minRequestInterval: number = 100 // Min ms between request starts

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent
  }

  /**
   * Add a request to the queue
   * Returns a promise that resolves when the request completes
   */
  async schedule<T>(
    fn: RequestFn,
    priority: number = 0,
    id: string = Math.random().toString(36)
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        fn,
        resolve,
        reject,
        priority,
      })

      // Sort by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority)

      this.processQueue()
    })
  }

  /**
   * Process queued requests, respecting concurrency limits
   */
  private async processQueue() {
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      // Respect minimum interval between request starts
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        )
      }

      const request = this.queue.shift()
      if (!request) break

      this.activeRequests++
      this.lastRequestTime = Date.now()

      try {
        const result = await request.fn()
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      } finally {
        this.activeRequests--
        this.processQueue()
      }
    }
  }

  /**
   * Get current queue stats (useful for debugging)
   */
  getStats() {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
    }
  }
}

// Global instance
export const globalRequestScheduler = new RequestScheduler(3)

/**
 * Hook-friendly wrapper for scheduling requests
 */
export function useRequestScheduler(maxConcurrent: number = 3) {
  const scheduler = new RequestScheduler(maxConcurrent)

  return {
    schedule: <T,>(
      fn: RequestFn,
      priority?: number,
      id?: string
    ) => scheduler.schedule<T>(fn, priority, id),
    getStats: () => scheduler.getStats(),
  }
}
