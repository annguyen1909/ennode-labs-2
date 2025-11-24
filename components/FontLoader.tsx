"use client";

import { useEffect } from "react";

type FontLoaderProps = {
  url?: string;
  name?: string;
};

export default function FontLoader({ url, name = "SiteCustomFont" }: FontLoaderProps) {
  useEffect(() => {
    if (!url) return;

    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-fontloader", name);
    styleEl.textContent = `@font-face { font-family: '${name}'; src: url('${url}') format('woff2'); font-display: swap; }`;
    document.head.appendChild(styleEl);

    // set the CSS variable so globals.css picks it up
    const prev = document.documentElement.style.getPropertyValue("--font-sans");
    document.documentElement.style.setProperty("--font-sans", `'${name}', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`);

    return () => {
      try { styleEl.remove(); } catch (e) {}
      if (prev) document.documentElement.style.setProperty("--font-sans", prev);
      else document.documentElement.style.removeProperty("--font-sans");
    };
  }, [url, name]);

  return null;
}
