"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

interface Props { pages?: number }

export default function AnimatedContent({ pages = 2.5 }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLDivElement>(".gsap-item");
      gsap.from(items, {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!innerRef.current) return;
      const viewport = window.innerHeight || 1;
      const maxScrollable = Math.max((pages - 1) * viewport, 1);
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const normalized = Math.min(1, Math.max(0, scrollY / maxScrollable));
      const totalHeight = pages * viewport;
      const maxTranslate = Math.max(0, totalHeight - viewport);
      const translate = normalized * maxTranslate;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (innerRef.current) innerRef.current.style.transform = `translateY(-${translate}px)`;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pages]);

  // slides list is imported from a shared module so page-level code can read length
  // and compute `pages` consistently with content height.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // import at top would be ideal but keep require to avoid potential SSR issues in some setups
  const { slides } = require('./contentSlides') as { slides: Array<{ title: string; body: string }> };

  return (
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', touchAction: 'pan-y', zIndex: 70, overflow: 'hidden' }}>
      <div ref={innerRef} style={{ width: '100%', willChange: 'transform', pointerEvents: 'auto' }}>
        {slides.map((s, i) => (
          <section
            key={i}
            className={`slide gsap-item`}
            style={{
              height: `calc(100vh)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6vw",
              boxSizing: "border-box",
            }}
          >
            <div style={{ maxWidth: 1000, textAlign: "left" }}>
              <h2 style={{ fontSize: 48, margin: 0, color: "#fff" }}>{s.title}</h2>
              <p style={{ marginTop: 16, fontSize: 18, color: "#fff", lineHeight: 1.6 }}>{s.body}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
