import React from 'react'
import ColleagueNetwork from '@/components/ColleagueNetwork.jsx'

export const metadata = {
  title: 'Colleague Network',
  description: 'Interactive 3D network of colleagues',
}

export default function NetworkPage() {
  return (
    // Add top padding so content doesn't sit under a fixed nav
    <main className="relative min-h-[80vh] w-full flex items-stretch justify-center py-8 pt-24">
      <div className="w-full max-w-6xl h-[70vh] rounded-xl overflow-hidden border border-white/10 shadow-xl">
        <ColleagueNetwork />
      </div>
    </main>
  )
}
