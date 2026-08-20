import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { GUIDES, guideBySlug } from "../content";

export const revalidate = 3600;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return { title: "Guide not found" };
  return { title: guide.title, description: guide.summary };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/guides" className="text-[12.5px] font-semibold text-brand-400 hover:underline">
        ← All guides
      </Link>
      <div className="mt-3">
        <PageHeader eyebrow={guide.category} title={guide.title} description={guide.summary} />
      </div>

      <article className="space-y-7">
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 text-[18px] font-bold tracking-tight text-white">
              {section.heading}
            </h2>
            {section.body.map((p, i) => (
              <p key={i} className="mb-3 text-[14.5px] leading-[1.7] text-slate-300">
                {p}
              </p>
            ))}
            {section.table && (
              <div className="panel mt-3 overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
                      {section.table.head.map((h, i) => (
                        <th key={h} className={i === 0 ? "px-4 py-2 text-left" : "px-4 py-2 text-right"}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row) => (
                      <tr key={row[0]} className="border-b border-pitch-800/60">
                        {row.map((cell, i) => (
                          <td
                            key={i}
                            className={
                              i === 0
                                ? "px-4 py-1.5 font-semibold text-white"
                                : "num px-4 py-1.5 text-right text-slate-300"
                            }
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </article>

      <div className="mt-10 border-t border-pitch-800 pt-6">
        <h2 className="mb-3 text-[14px] font-bold text-white">Keep reading</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {others.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="panel px-4 py-3 transition hover:border-brand-500/60"
            >
              <div className="text-[13px] font-bold text-white">{g.title}</div>
              <div className="mt-0.5 text-[11.5px] text-slate-500">{g.category}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
