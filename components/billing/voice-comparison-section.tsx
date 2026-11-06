"use client";

import { useRef } from "react";
import {
  VOICE_COMPARISON_ROWS,
  VOICE_COMPARISON_SAMPLE,
  voiceComparisonBlurb,
} from "@/lib/billing/voice-comparison";

/**
 * Marketing comparison: table always; players only when both real clips exist.
 * At most one sample plays at a time.
 */
export function VoiceComparisonSection() {
  const blurb = voiceComparisonBlurb();
  const standardRef = useRef<HTMLAudioElement>(null);
  const premiumRef = useRef<HTMLAudioElement>(null);
  const sample = VOICE_COMPARISON_SAMPLE;

  function pauseOther(which: "standard" | "premium") {
    const other = which === "standard" ? premiumRef.current : standardRef.current;
    if (other && !other.paused) {
      other.pause();
    }
  }

  return (
    <section className="mt-16" aria-labelledby="voice-comparison-heading">
      <div className="text-center">
        <h2 id="voice-comparison-heading" className="font-serif text-3xl tracking-tight">
          {blurb.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{blurb.subtitle}</p>
      </div>

      <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
        <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-serif text-xl">Standard Voice</h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Everyday audiobook creation</p>
          <p className="mt-3 text-sm text-muted-foreground">{blurb.standard}</p>
          {sample ? (
            <div className="mt-auto flex w-full flex-col items-stretch gap-1 pt-4">
              <p className="text-left text-xs leading-snug text-muted-foreground">{sample.standard.voiceLabel}</p>
              <audio
                ref={standardRef}
                className="w-full"
                controls
                controlsList="nodownload"
                preload="none"
                src={sample.standard.src}
                onPlay={() => pauseOther("standard")}
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : null}
        </div>
        <div className="flex h-full flex-col rounded-xl border border-amber-700/30 bg-amber-50/40 p-5 shadow-sm">
          <h3 className="font-serif text-xl">Premium Voice</h3>
          <p className="mt-1 text-sm font-medium text-amber-950/80">High-quality audiobook narration</p>
          <p className="mt-3 text-sm text-muted-foreground">{blurb.premium}</p>
          {sample ? (
            <div className="mt-auto flex w-full flex-col items-stretch gap-1 pt-4">
              <p className="text-left text-xs leading-snug text-muted-foreground">{sample.premium.voiceLabel}</p>
              <audio
                ref={premiumRef}
                className="w-full"
                controls
                controlsList="nodownload"
                preload="none"
                src={sample.premium.src}
                onPlay={() => pauseOther("premium")}
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : null}
        </div>
      </div>

      {sample ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Both clips use the same script ({sample.scriptLabel}) so you can hear the difference.
        </p>
      ) : (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Side-by-side sample clips will appear here once matching Standard and Premium recordings are ready.
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-4 py-3 font-medium">
                Compare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Standard Voice
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Premium Voice
              </th>
            </tr>
          </thead>
          <tbody>
            {VOICE_COMPARISON_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 align-top font-medium text-muted-foreground">
                  {row.label}
                </th>
                <td className="px-4 py-3 align-top">{row.standard}</td>
                <td className="px-4 py-3 align-top">{row.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
