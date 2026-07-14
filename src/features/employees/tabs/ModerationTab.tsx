import React, { Suspense } from 'react'

const OfficerModeration = React.lazy(() => import('../../../pages/OfficerModeration'))

export default function ModerationTab() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-slate-400">Loading moderation tools...</div>}>
        <OfficerModeration />
      </Suspense>
    </div>
  )
}
