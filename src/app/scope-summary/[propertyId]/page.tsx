"use client";

/**
 * The scope as a page for the customer - opened from the Scope tab's
 * "Customer summary", printed or saved as PDF from the browser. No app
 * chrome, no prices, no internal notes, no second preferences: room by
 * room, what is planned, the finishes chosen, the pictures they liked, the
 * decisions written down. The document a seller sends the evening after
 * the showroom visit, so the customer sees that the conversation was heard.
 *
 * Reads /api/properties/[id]/scope/summary; stores nothing.
 */

import React, { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrinterIcon } from "@heroicons/react/24/outline";

interface Picture { url: string | null; title: string; starred: boolean }
interface Choice { category: string; name: string; tier: string | null; quantity: number | null; picture: string | null }
interface Component { name: string; type: string | null; size: string | null; done_by: string | null; provided: string | null; choices: Choice[]; pictures: Picture[]; decisions: string[] }
interface Space { name: string; size: string | null; done_by: string | null; pictures: Picture[]; decisions: string[]; components: Component[] }
interface Summary { company: string; logo_url: string | null; client: string; reference: string | null; address: string; configuration: string | null; date: string; spaces: Space[] }

const CONFIG: Record<string, string> = { studio: "Studio", "1bhk": "1 BHK", "2bhk": "2 BHK", "3bhk": "3 BHK", "4bhk": "4 BHK", "5bhk_plus": "5 BHK+", other: "" };

export default function ScopeSummaryPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = use(params);
  // useSearchParams wants a Suspense boundary above it at build time.
  return (
    <Suspense fallback={<main className="max-w-3xl mx-auto p-8 text-sm text-slate-500">Preparing the summary…</main>}>
      <ScopeSummary propertyId={propertyId} />
    </Suspense>
  );
}

function ScopeSummary({ propertyId }: { propertyId: string }) {
  const search = useSearchParams();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (search.get("lead")) qs.set("lead", search.get("lead")!);
    if (search.get("project")) qs.set("project", search.get("project")!);
    let live = true;
    fetch(`/api/properties/${propertyId}/scope/summary?${qs}`)
      .then(async (r) => ({ ok: r.ok, json: await r.json().catch(() => ({})) }))
      .then(({ ok, json }) => {
        if (!live) return;
        if (ok) setData(json.data);
        else setError(json.error || "Could not load the summary");
      })
      .catch(() => live && setError("Could not load the summary"));
    return () => { live = false; };
  }, [propertyId, search]);

  if (error) return <main className="max-w-3xl mx-auto p-8 text-sm text-red-700">{error}</main>;
  if (!data) return <main className="max-w-3xl mx-auto p-8 text-sm text-slate-500">Preparing the summary…</main>;

  const date = new Date(data.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const ours = data.spaces.filter((s) => s.components.some((c) => !c.done_by) || !s.done_by);

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white text-slate-900">
      <div className="print:hidden sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-2.5 flex items-center gap-3 text-sm">
          <span className="text-slate-600">Customer summary · no prices, no internal notes.</span>
          <span className="flex-1" />
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
            <PrinterIcon className="w-4 h-4" /> Print or save as PDF
          </button>
        </div>
      </div>

      <article className="max-w-3xl mx-auto bg-white my-6 print:my-0 px-10 py-10 print:px-0 print:py-0 shadow-sm print:shadow-none rounded-lg print:rounded-none">
        <header className="flex items-start justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            {data.logo_url ? <img src={data.logo_url} alt="" className="h-10 mb-3 object-contain" /> : null}
            <h1 className="text-2xl font-semibold tracking-tight">Your home, as we discussed</h1>
            <p className="text-sm text-slate-600 mt-1">
              {data.client ? <>For <span className="font-medium text-slate-800">{data.client}</span></> : null}
              {data.address ? <> · {data.address}</> : null}
              {data.configuration && CONFIG[data.configuration] ? <> · {CONFIG[data.configuration]}</> : null}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 shrink-0">
            <p className="font-medium text-slate-700">{data.company}</p>
            <p>{date}</p>
            {data.reference && <p>Ref. {data.reference}</p>}
          </div>
        </header>

        {ours.length === 0 ? (
          <p className="py-10 text-sm text-slate-500">Nothing has been listed yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {data.spaces.map((s, i) => (
              <section key={i} className="py-6 break-inside-avoid">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-semibold">{s.name}</h2>
                  <span className="text-xs text-slate-500">{s.size ?? ""}{s.done_by ? ` · ${s.done_by}` : ""}</span>
                </div>
                {s.pictures.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {s.pictures.map((p, k) => (
                      <figure key={k} className="aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
                        <img src={p.url!} alt={p.title} className="w-full h-full object-cover" />
                      </figure>
                    ))}
                  </div>
                )}
                {s.decisions.length > 0 && (
                  <ul className="mt-3 text-sm text-slate-700 space-y-1">
                    {s.decisions.map((d, k) => <li key={k} className="pl-3 border-l-2 border-emerald-300">{d}</li>)}
                  </ul>
                )}
                {s.components.length > 0 && (
                  <ul className="mt-4 space-y-4">
                    {s.components.map((c, k) => (
                      <li key={k} className="break-inside-avoid">
                        <div className="flex items-baseline justify-between gap-4">
                          <h3 className="text-sm font-semibold">{c.name}{c.type && c.type !== c.name ? <span className="font-normal text-slate-500"> · {c.type}</span> : null}</h3>
                          <span className="text-xs text-slate-500">{c.size ?? ""}{c.done_by ? ` · ${c.done_by}` : ""}</span>
                        </div>
                        {c.provided && <p className="mt-1 text-sm text-slate-700">{c.done_by ?? "You provide"}: {c.provided}</p>}
                        {c.choices.length > 0 && (
                          <dl className="mt-1.5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 text-sm">
                            {c.choices.map((ch, j) => (
                              <React.Fragment key={j}>
                                <dt className="text-slate-500">{ch.category}</dt>
                                <dd className="text-slate-800 flex items-center gap-2">
                                  {ch.picture && <img src={ch.picture} alt="" className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0" />}
                                  <span>
                                    {ch.name}
                                    {ch.tier ? <span className="text-slate-500"> · {ch.tier}</span> : null}
                                    {ch.quantity ? <span className="text-slate-500"> × {ch.quantity}</span> : null}
                                  </span>
                                </dd>
                              </React.Fragment>
                            ))}
                          </dl>
                        )}
                        {c.pictures.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            {c.pictures.map((p, j) => (
                              <figure key={j} className="w-24 aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
                                <img src={p.url!} alt={p.title} className="w-full h-full object-cover" />
                              </figure>
                            ))}
                          </div>
                        )}
                        {c.decisions.length > 0 && (
                          <ul className="mt-2 text-sm text-slate-700 space-y-1">
                            {c.decisions.map((d, j) => <li key={j} className="pl-3 border-l-2 border-emerald-300">{d}</li>)}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

        <footer className="pt-6 mt-2 border-t border-slate-200 text-xs text-slate-500">
          A summary of what we discussed, prepared by {data.company || "us"} on {date}. Sizes marked approx. will be confirmed at the site measurement. This is not a quotation.
        </footer>
      </article>
    </main>
  );
}
