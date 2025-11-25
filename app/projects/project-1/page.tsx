import React from 'react'
import Link from 'next/link'
import ProjectViewer from '@/components/ProjectViewer'

export const metadata = {
  title: 'Interactive 3D Viewer — Ennode Labs',
  description: 'Immersive project viewer with hotspot annotations and cinematic post-processing'
}

export default function SampleProjectPage() {
  return (
    <main className="w-full min-h-screen bg-black flex flex-col items-center justify-center py-12 px-4">
      {/* Back Button */}
      <div className="w-full max-w-6xl mb-6">
        <Link 
          href="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300 group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </Link>
      </div>
      {/* Project Container */}
      <div className="w-full max-w-6xl h-[72vh] rounded-xl overflow-hidden border border-white/6 shadow-xl">
        <ProjectViewer />
      </div>
    </main>
  )
}
