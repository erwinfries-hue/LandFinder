"use client";

import { useEffect, useRef } from "react";

/**
 * Generative "Kataster"-Kulisse: ruhige, verzerrte Höhenlinien statt Foto/Stock-Bild.
 * Wird einmal gezeichnet und bei Resize / Theme-Wechsel neu berechnet.
 */
export function ContourBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function isDark() {
      const t = document.documentElement.getAttribute("data-theme");
      if (t) return t === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);
      ctx.clearRect(0, 0, w, h);
      const dark = isDark();
      ctx.strokeStyle = dark ? "rgba(79,194,180,0.16)" : "rgba(14,110,104,0.14)";
      ctx.lineWidth = 1;
      const cx = w * 0.82;
      const cy = h * 0.28;
      for (let r = 40; r < Math.max(w, h) * 1.1; r += 46) {
        ctx.beginPath();
        const steps = 90;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const wob = Math.sin(a * 3 + r * 0.04) * (r * 0.09) + Math.cos(a * 5 - r * 0.02) * (r * 0.05);
          const rr = r + wob;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr * 0.72;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = dark ? "rgba(79,194,180,0.10)" : "rgba(14,110,104,0.10)";
      const step = 64;
      for (let gx = 0; gx < w; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gx, h);
        ctx.lineTo(gx, h - 8);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(8, gy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w, gy);
        ctx.lineTo(w - 8, gy);
        ctx.stroke();
      }
    }

    draw();
    window.addEventListener("resize", draw);
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", draw);

    return () => {
      window.removeEventListener("resize", draw);
      observer.disconnect();
      media.removeEventListener("change", draw);
    };
  }, []);

  return <canvas ref={canvasRef} className="contours" aria-hidden="true" />;
}
