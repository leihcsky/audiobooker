import Link from "next/link";
import { AudiobookTool } from "@/components/seo-tools/audiobook-tool";
import { seoToolJsonLd, serializeJsonLd } from "@/lib/tools/seo-page";
import { seoToolName, type SeoSection, type SeoToolConfig } from "@/lib/tools/tool-config";

type SeoToolPageProps = {
  config: SeoToolConfig;
  signedIn: boolean;
};

export function SeoToolPage({ config, signedIn }: SeoToolPageProps) {
  const jsonLd = seoToolJsonLd(config);

  return (
    <article className="mx-auto w-full max-w-5xl px-6 py-12">
      {jsonLd.map((item, index) => (
        <script
          key={`${config.slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
        />
      ))}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{seoToolName(config)}</li>
        </ol>
      </nav>
      <p className="mt-8 text-sm uppercase tracking-[0.2em] text-muted-foreground">
        {config.eyebrow ?? config.primaryKeyword}
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">{config.h1}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{config.intro}</p>

      <div className="mt-10">
        <AudiobookTool config={config} signedIn={signedIn} />
      </div>

      <section className="mt-16">
        <h2 className="font-serif text-2xl">{config.howToTitle}</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted-foreground">
          {config.howToSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {config.sections?.map((section) => (
        <ContentSection key={section.heading} section={section} />
      ))}

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Frequently asked questions</h2>
        <dl className="mt-4 space-y-6">
          {config.faq.map((item) => (
            <div key={item.question}>
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Related tools</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {config.related.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="font-medium hover:underline">
                {item.label}
              </Link>
              {item.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function ContentSection({ section }: { section: SeoSection }) {
  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl">{section.heading}</h2>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mt-4 max-w-3xl leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {section.table ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                {section.table.columns.map((column) => (
                  <th key={column} scope="col" className="py-2 pr-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row[0]} className="border-b border-border align-top">
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={index} scope="row" className="py-2 pr-4 font-medium">
                        {cell}
                      </th>
                    ) : (
                      <td key={index} className="py-2 pr-4 text-muted-foreground">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.points?.length ? (
        <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {section.points.map((point) => (
            <div key={point.term}>
              <dt className="font-medium">{point.term}</dt>
              <dd className="mt-1 text-muted-foreground">{point.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {section.note ? (
        <p className="mt-5 max-w-3xl leading-7 text-muted-foreground">{section.note}</p>
      ) : null}
    </section>
  );
}
