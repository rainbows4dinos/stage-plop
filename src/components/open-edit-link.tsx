"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LEGACY_PLOT_KEY, PLOTS_KEY, openShared, parseLocal } from "@/lib/local-plots";
import { parsePlot } from "@/lib/plot";
import { isId, tokenFromHash } from "@/lib/share";

/**
 * An edit link (/edit/<id>#k=<token>). Checks the token, brings the plot into
 * this browser's plot list, then hands off to the editor at "/". The token
 * never leaves the fragment except as a request header.
 */
export function OpenEditLink({ id }: { id: string }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = tokenFromHash(window.location.hash);
      if (!isId(id) || !token) {
        setProblem("This edit link is missing a piece. Copy the whole link and try again.");
        return;
      }
      try {
        const res = await fetch(`/api/plots/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) return setProblem("There's no plot at this link. It may have been typed wrong.");
        if (!res.ok) return setProblem(body.error ?? "Couldn't open this plot. Try again in a moment.");
        if (body.canEdit === false)
          return setProblem("This edit link has been replaced with a new one. You can still view the plot.");
        const plot = parsePlot(body.plot);
        if (!plot) return setProblem("This plot couldn't be read.");
        let stored: unknown = null;
        let legacy: unknown = null;
        try {
          stored = JSON.parse(localStorage.getItem(PLOTS_KEY) ?? "null");
          legacy = JSON.parse(localStorage.getItem(LEGACY_PLOT_KEY) ?? "null");
        } catch {}
        const next = openShared(parseLocal(stored, legacy), { id, token }, plot, body.updatedAt);
        try {
          localStorage.setItem(PLOTS_KEY, JSON.stringify(next));
        } catch {
          return setProblem("This browser won't let Stage Plop save anything, so the plot can't open for editing.");
        }
        router.replace("/");
      } catch {
        if (!cancelled) setProblem("You're offline. Connect and reload this page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <main className="grid min-h-full place-items-center p-6">
      <div className="panel w-full max-w-md gap-3 p-6">
        <h1 className="wordmark text-[28px] leading-7">
          STAGE <span className="swipe">PLOP</span>
        </h1>
        {problem ? (
          <>
            <p className="m-0" role="alert">
              {problem}
            </p>
            <div className="flex flex-wrap gap-2">
              {isId(id) && (
                <Link className="btn" href={`/p/${id}`}>
                  View the Plot
                </Link>
              )}
              <Link className="btn btn-primary" href="/">
                Go to Stage Plop
              </Link>
            </div>
          </>
        ) : (
          <p className="m-0" role="status">
            Opening the plot…
          </p>
        )}
      </div>
    </main>
  );
}
