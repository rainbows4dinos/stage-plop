import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlotViewer } from "@/components/plot-viewer";
import { parsePlot, type Plot } from "@/lib/plot";
import { isId } from "@/lib/share";
import { getPlotStore } from "@/lib/server/plot-store";

// Always the latest version: bands keep editing after they send the link.
export const dynamic = "force-dynamic";

type Loaded = { unavailable: true } | { plot: Plot; updatedAt: string } | null;

async function load(id: string): Promise<Loaded> {
  const store = getPlotStore();
  if (!store) return { unavailable: true };
  if (!isId(id)) return null;
  const rec = await store.get(id);
  const plot = rec ? parsePlot(rec.plot) : null;
  return rec && plot ? { plot, updatedAt: rec.updatedAt } : null;
}

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = await load(id);
  const band = found && !("unavailable" in found) ? found.plot.band : "";
  return {
    title: band ? `${band} Stage Plot · Stage Plop` : "Stage Plot · Stage Plop",
    description: band ? `Stage plot and input list for ${band}.` : "A stage plot and input list.",
    // view links are for the people they're sent to, not search engines
    robots: { index: false, follow: false },
  };
}

export default async function ViewPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const found = await load(id);
  if (found && "unavailable" in found) {
    return (
      <main className="grid min-h-full place-items-center p-6">
        <div className="panel max-w-md gap-3 p-6">
          <h1 className="h2">Sharing Isn&apos;t Set Up Here</h1>
          <p className="m-0">This copy of Stage Plop can&apos;t show shared plots yet.</p>
          <Link className="btn btn-primary w-fit" href="/">
            Go to Stage Plop
          </Link>
        </div>
      </main>
    );
  }
  if (!found) notFound();
  return <PlotViewer plot={found.plot} updatedAt={found.updatedAt} />;
}
