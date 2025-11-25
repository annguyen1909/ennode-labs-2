"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
// @ts-ignore
import Lenis from "@studio-freight/lenis";
import SpineGlobeScene from "@/components/SpineGlobeScene";
import AnimatedContent from "@/components/AnimatedContent";
import slides from "@/components/contentSlides";

export default function Home() {
  // progress 0..1 controlling how much the Spine overlay has moved up
  const [progress, setProgress] = useState(0);
  const progressRef = useRef({ value: 0 });
  const [spineProgress, setSpineProgress] = useState(0);
  const spineProgressRef = useRef({ value: 0 });

  // helper: simple HSL linear interpolation
  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  function lerpHsl(h1: number, s1: number, l1: number, h2: number, s2: number, l2: number, t: number) {
    // interpolate hue shortest way
    let dh = h2 - h1
    if (Math.abs(dh) > 180) {
      if (dh > 0) dh -= 360
      else dh += 360
    }
    const h = (h1 + dh * t + 360) % 360
    const s = lerp(s1, s2, t)
    const l = lerp(l1, l2, t)
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
  }

  useEffect(() => {
    const heroHeight = window.innerHeight || 1;
    // amount of scroll AFTER the hero that will drive the Spine animation (2 viewports now for slower motion)
    const spineScrollRange = (window.innerHeight || 1) * 2;

    // make scroll slower and smoother: higher duration and lower wheel multiplier
    const lenis = new Lenis({
      duration: 2.2,
      wheelMultiplier: 0.65,
      easing: (t: number) => Math.min(1, 1 - Math.pow(1 - t, 3)),
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // lenis scroll handler
    lenis.on("scroll", (e: any) => {
      const totalScroll = e.scroll || 0;
      // overlay progress is tied to the first viewport (0..1)
      const raw = Math.max(0, Math.min(1, totalScroll / heroHeight));

      // spine progress should map the scroll AFTER the hero into 0..1 across spineScrollRange

      // Smooth the spine progress separately so the camera motion feels natural
    });

    // initialize to current scroll
    const initialRaw = Math.max(0, Math.min(1, (window.scrollY || 0) / heroHeight));
    const initialSpineRaw = Math.max(0, Math.min(1, ((window.scrollY || 0) - heroHeight) / spineScrollRange));
    progressRef.current.value = initialRaw;
    setProgress(initialRaw);
    spineProgressRef.current.value = initialSpineRaw;
    setSpineProgress(initialSpineRaw);

    return () => {
      try { lenis.destroy(); } catch (e) { }
    };
  }, []);

  // heroHidden when overlay fully covers hero (progress >= 1)
  const heroHidden = progress >= 0.999;

  // number of viewports the spine overlay should occupy (shared with SpineGlobeScene)
  const [pages, setPages] = useState(Math.max(4, (slides && slides.length) || 4));

  useEffect(() => {
    // Ensure the document background is black while this page is active so
    // any gaps or anchors match the intended design.
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#000';
    return () => {
      document.body.style.backgroundColor = prev || '';
    };
  }, []);

  return (
    <main className="relative w-full min-h-screen" style={{ backgroundColor: '#000' }}>
      <SpineGlobeScene pages={pages} setPages={setPages} />
      <AnimatedContent pages={pages} />
    </main>
  );
}
