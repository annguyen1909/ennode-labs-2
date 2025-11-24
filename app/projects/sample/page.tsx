import React from 'react'
import ProjectViewer from '@/components/ProjectViewer'

export const metadata = {
  title: 'Sample Project — Viewer',
  description: 'Interactive Project Viewer demo'
}

export default function SampleProjectPage() {
  return (
    <main className="w-full min-h-screen bg-black flex items-center justify-center py-12">
      <div className="w-full max-w-6xl h-[72vh] rounded-xl overflow-hidden border border-white/6 shadow-xl">
        <ProjectViewer />
      </div>
    </main>
  )
}
