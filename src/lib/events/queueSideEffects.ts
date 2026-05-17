const isDev = () => Boolean((import.meta as any)?.env?.DEV)

export function queueSideEffect(name: string, task: () => Promise<unknown> | unknown) {
  const run = async () => {
    try {
      await task()
    } catch (error) {
      if (isDev()) {
        console.warn(`[side-effect:${name}] failed`, error)
      }
    }
  }

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(() => void run(), { timeout: 3000 })
  } else {
    setTimeout(() => void run(), 0)
  }
}

export function queueSideEffects(tasks: Array<{ name: string; task: () => Promise<unknown> | unknown }>) {
  tasks.forEach(({ name, task }) => queueSideEffect(name, task))
}
