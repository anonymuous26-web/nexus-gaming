
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Radio, RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/api";

const REFRESH_INTERVAL = 60_000;
const REQUEST_TIMEOUT = 10_000;

export default function MarqueeBanner() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);

  const mountedRef = useRef(false);
  const controllerRef = useRef(null);

  const loadMarquee = useCallback(async () => {
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    const timeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(apiUrl("/api/marquee"), {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Marquee request failed: ${response.status}`);
      }

      const data = await response.json();

      if (
        !mountedRef.current ||
        typeof data.marqueeText !== "string"
      ) {
        return;
      }

      const cleanMessage = data.marqueeText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

      setMessage(cleanMessage);
      setError(false);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Nexus marquee error:", err);

        if (mountedRef.current) {
          setError(true);
        }
      }
    } finally {
      clearTimeout(timeoutId);

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    loadMarquee();

    const interval = setInterval(
      loadMarquee,
      REFRESH_INTERVAL
    );

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      controllerRef.current?.abort();
    };
  }, [loadMarquee]);

  if (!message) {
    return null;
  }

  return (
    <section
      role="region"
      aria-label="Nexus store announcements"
      className="relative isolate w-full overflow-hidden border-y border-cyan-400/20 bg-[#070d19] text-cyan-50 shadow-[0_4px_20px_rgba(0,240,255,0.05)]"
    >
      {/* Background lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/[0.06] via-transparent to-blue-500/[0.06]"
      />

      <div className="relative flex min-h-12 items-center">
        {/* Fixed announcement label */}
        <div className="relative z-20 flex h-12 shrink-0 items-center gap-2 border-r border-cyan-400/20 bg-[#070d19] px-3 sm:px-5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>

          <Megaphone
            aria-hidden="true"
            className="h-4 w-4 text-cyan-300"
          />

          <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 sm:text-xs">
            Nexus News
          </span>
        </div>

        {/* Scrolling announcement */}
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div
            className="nexus-marquee-track flex w-max items-center"
            style={{
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            {/* First copy */}
            <div className="flex shrink-0 items-center">
              <span className="flex shrink-0 items-center gap-2 whitespace-nowrap px-6 text-xs font-semibold tracking-wide sm:text-sm">
                <Radio className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                {message}
              </span>
            </div>

            {/* Second copy for seamless looping */}
            <div
              aria-hidden="true"
              className="flex shrink-0 items-center"
            >
              <span className="flex shrink-0 items-center gap-2 whitespace-nowrap px-6 text-xs font-semibold tracking-wide sm:text-sm">
                <Radio className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                {message}
              </span>
            </div>
          </div>
        </div>

        {/* Right-side live indicator */}
        <div className="relative z-20 hidden h-12 shrink-0 items-center gap-2 border-l border-cyan-400/20 bg-[#070d19] px-4 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Live Updates
          </span>
        </div>
      </div>

      {/* Animation and accessibility styles */}
      <style jsx>{`
        .nexus-marquee-track {
          width: max-content;
          animation: nexus-marquee-scroll 28s linear infinite;
          will-change: transform;
        }

        @keyframes nexus-marquee-scroll {
          from {
            transform: translate3d(0, 0, 0);
          }

          to {
            transform: translate3d(-50%, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .nexus-marquee-track {
            animation: none !important;
            width: 100%;
            transform: none;
          }

          .nexus-marquee-track > div:nth-child(2) {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
