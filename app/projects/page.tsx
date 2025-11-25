"use client"

import Link from 'next/link'
import { useState } from 'react'

interface Project {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  thumbnail: string
  link: string
  accentColor: string
}

const projects: Project[] = [
  {
    id: 'project-1',
    title: 'Interactive 3D Viewer',
    description: 'Immersive project viewer with hotspot annotations, camera presets, and cinematic post-processing effects.',
    category: 'Visualization',
    tags: ['3D', 'WebGL', 'React Three Fiber', 'Interactive'],
    thumbnail: '/assets/project-viewer-thumb.jpg',
    link: '/projects/project-1',
    accentColor: '#79ffe1'
  },
  {
    id: 'project-2',
    title: 'Physics Connectors',
    description: 'Real-time physics simulation with dynamic materials, cursor interaction, and ambient occlusion rendering.',
    category: 'Interactive',
    tags: ['Physics', 'Rapier', '3D', 'WebGL'],
    thumbnail: '/assets/physics-thumb.jpg',
    link: '/projects/project-2',
    accentColor: '#4060ff'
  }
]

const categories = ['All', 'Visualization', 'Interactive', 'Experimental']

export default function ProjectsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  const filteredProjects = selectedCategory === 'All' 
    ? projects 
    : projects.filter(p => p.category === selectedCategory)

  return (
    <main className="w-full min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative w-full px-6 py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-blue-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
            <span className="text-sm text-gray-400">Our Work</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            Projects
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-3xl">
            Explore our collection of interactive experiences, 3D visualizations, and experimental web technologies.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="w-full px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  selectedCategory === cat
                    ? 'bg-white text-black shadow-lg shadow-white/20'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="w-full px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={project.link}
                onMouseEnter={() => setHoveredProject(project.id)}
                onMouseLeave={() => setHoveredProject(null)}
                className="group relative block"
              >
                <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-white/5 to-white/2 border border-white/10 transition-all duration-500 hover:border-white/30 hover:shadow-2xl hover:shadow-white/10">
                  {/* Thumbnail */}
                  <div className="relative aspect-16/10 overflow-hidden bg-linear-to-br from-gray-900 to-black">
                    {/* Fallback gradient background */}
                    <div 
                      className="absolute inset-0 opacity-30 transition-opacity duration-500 group-hover:opacity-50"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${project.accentColor}40, transparent 70%)`
                      }}
                    />
                    
                    {/* Decorative elements */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div 
                        className="w-32 h-32 rounded-full blur-3xl opacity-40 transition-all duration-500 group-hover:scale-150 group-hover:opacity-60"
                        style={{ background: project.accentColor }}
                      />
                    </div>

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-white font-medium">
                        <span>View Project</span>
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: `${project.accentColor}20`,
                          color: project.accentColor,
                          border: `1px solid ${project.accentColor}40`
                        }}
                      >
                        {project.category}
                      </span>
                    </div>

                    <h3 className="relative text-2xl font-semibold mb-3">
                      {/* two layered spans: white text (base) and gradient text (overlay) */}
                      <span
                        aria-hidden={hoveredProject === project.id}
                        className="block transition-opacity duration-300"
                        style={{
                          opacity: hoveredProject === project.id ? 0 : 1,
                          color: 'white'
                        }}
                      >
                        {project.title}
                      </span>

                      <span
                        className="absolute left-0 top-0 w-full block transition-opacity duration-300"
                        style={{
                          opacity: hoveredProject === project.id ? 1 : 0,
                          backgroundImage: `linear-gradient(135deg, ${project.accentColor}, ${project.accentColor}cc)`,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent'
                        }}
                      >
                        {project.title}
                      </span>
                    </h3>

                    <p className="text-gray-400 text-base mb-6 leading-relaxed">
                      {project.description}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-gray-400 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Accent line */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-500 group-hover:h-2"
                    style={{
                      background: `linear-gradient(90deg, ${project.accentColor}, ${project.accentColor}00)`
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>

          {/* Empty state */}
          {filteredProjects.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-semibold text-white mb-2">No projects found</h3>
              <p className="text-gray-400">Try selecting a different category</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full px-6 py-20 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Have a project in mind?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Let's collaborate and bring your ideas to life with cutting-edge web technologies.
          </p>
          <Link
            href="/network"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white text-black font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-white/20 hover:scale-105"
          >
            Get in Touch
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  )
}
