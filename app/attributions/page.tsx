import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sources & licences",
  description:
    "Every 3D model, text source and tool used to build this site, with its licence.",
};

interface Source {
  name: string;
  url: string;
  licence: string;
  licenceUrl: string;
  what: string;
}

const MODELS: Source[] = [
  {
    name: "Open3DModel",
    url: "https://anatomytool.org/open3dmodel",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    what: "The 3D models used on this site. Created by the anatomy departments of Leiden UMC, UMC Utrecht, Maastricht UMC and KU Leuven (KULAK), with anatomists from other Dutch universities.",
  },
  {
    name: "Z-Anatomy",
    url: "https://github.com/Z-Anatomy/Models-of-human-anatomy",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    what: "Predecessor model and the Terminologia Anatomica (TA2) term list used to check our Latin names. By Gauthier Kervyn and Marcin Zielinski.",
  },
  {
    name: "BodyParts3D / Anatomography",
    url: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
    licence: "CC BY-SA 2.1 JP",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/2.1/jp/",
    what: "The original segmented anatomy dataset that the models above derive from, and the source of our Foundational Model of Anatomy (FMA) identifiers. By the Database Center for Life Science (DBCLS), Japan.",
  },
];

const TEXT: Source[] = [
  {
    name: "OpenStax — Anatomy & Physiology 2e",
    url: "https://openstax.org/details/books/anatomy-and-physiology-2e",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    what: "Reference for the plain-English explanations. Rice University / OpenStax.",
  },
];

export default function AttributionsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
        Sources &amp; licences
      </h1>
      <p className="prose-anat mt-3 text-[var(--ink-soft)]">
        This site is built entirely from openly licensed work. Nothing here is scraped
        from a commercial atlas or a textbook. The people and institutions below did
        the hard part.
      </p>

      <Group title="3D models">{MODELS.map(renderSource)}</Group>
      <Group title="Explanatory text">{TEXT.map(renderSource)}</Group>

      <section className="mt-10 rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
          What ShareAlike means here
        </h2>
        <p className="prose-anat mt-2 text-sm text-[var(--ink-soft)]">
          The 3D models are licensed CC BY-SA 4.0. That means anyone may reuse them,
          including commercially, provided they credit the original authors and release
          any <em>modified model</em> under the same licence.
        </p>
        <p className="prose-anat mt-2 text-sm text-[var(--ink-soft)]">
          Where we modify a model, the modified file is published under CC BY-SA 4.0
          too. Our own website code, written explanations and curriculum mappings are
          separate works and are not covered by that obligation.
        </p>
      </section>

      <p className="prose-anat mt-8 text-sm text-[var(--ink-soft)]">
        This site is a study aid. It is not a substitute for dissection, a verified
        atlas, or your prescribed textbook, and it is not medical advice. If you spot
        an error, that is worth reporting — accuracy matters more than coverage.
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        {title}
      </h2>
      <ul className="mt-3 space-y-3">{children}</ul>
    </section>
  );
}

function renderSource(source: Source) {
  return (
    <li key={source.name} className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--accent)] hover:underline"
        >
          {source.name}
        </a>
        <a
          href={source.licenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
        >
          {source.licence}
        </a>
      </div>
      <p className="prose-anat mt-2 text-sm text-[var(--ink-soft)]">{source.what}</p>
    </li>
  );
}
