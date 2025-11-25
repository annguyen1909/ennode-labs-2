"use client"

import Link from "next/link";
// use a plain img tag for reliable debug/display of the local asset
import React from "react";
import gsap from 'gsap';

export default function NavBar() {
  return (
    <nav className="fixed top-4 left-1/2 transform -translate-x-1/2 w-[92%] max-w-5xl" style={{ zIndex: 9999 }}>
      <div className="backdrop-blur-md bg-black/10 border border-white/6 rounded-xl px-4 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center" aria-label="Ennode Labs"> 
            <img src="/assets/favicon-dark.png" alt="Ennode Labs" width={28} height={28} className="bg-transparent rounded-none p-1 w-10 h-10 object-contain" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/network" className="text-sm text-white/90 hover:text-white transition" onMouseEnter={(e) => gsap.to(e.currentTarget as HTMLElement, { scale: 1.06, duration: 0.14 })} onMouseLeave={(e) => gsap.to(e.currentTarget as HTMLElement, { scale: 1, duration: 0.14 })}>NETWORK</Link>
          <Link href="/projects" className="text-sm text-white/90 hover:text-white transition" onMouseEnter={(e) => gsap.to(e.currentTarget as HTMLElement, { scale: 1.06, duration: 0.14 })} onMouseLeave={(e) => gsap.to(e.currentTarget as HTMLElement, { scale: 1, duration: 0.14 })}>WORK</Link>
          <Link href="/contact" className="text-sm text-white/90 hover:text-white transition" onMouseEnter={(e) => gsap.to(e.currentTarget as HTMLElement, { scale: 1.06, duration: 0.14 })} onMouseLeave={(e) => gsap.to(e.currentTarget as HTMLElement, { scale: 1, duration: 0.14 })}>CONTACT</Link>
        </div>
      </div>
    </nav>
  );
}
