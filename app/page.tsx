import models from "@/data/models.json";
import { MODEL_GROUPS, type ModelEntry, type ModelGroup } from "@/lib/types";
import { EXPLAINED_BY_REGION } from "@/lib/structures";
import ModelCard from "@/components/ModelCard";

export default function HomePage() {
  const catalogue = models as ModelEntry[];

  const byGroup = new Map<ModelGroup, ModelEntry[]>();
  for (const model of catalogue) {
    const list = byGroup.get(model.group) ?? [];
    list.push(model);
    byGroup.set(model.group, list);
  }

  const totalStructures = catalogue.reduce((sum, m) => sum + m.meshCount, 0);
  const totalExplained = Object.values(EXPLAINED_BY_REGION).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
          Anatomy you can take apart
        </h1>
        <p className="prose-anat mt-4 text-[15px] text-[var(--ink-soft)]">
          Every structure in these models is a separate, individually named object —
          not one sculpted shape with labels stuck on top. Click a carpal bone and it
          tells you which one. Hide the muscles and the nerves underneath are still
          there, still named.
        </p>
        <p className="prose-anat mt-3 text-sm text-[var(--ink-faint)]">
          Built and checked by university anatomy departments, labelled to
          Terminologia Anatomica. Free, and always will be.
        </p>
      </header>

      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-[var(--border)] py-5">
        <Stat value={catalogue.length} label="models" />
        <Stat value={totalStructures.toLocaleString("en-IN")} label="named structures" />
        <Stat value={totalExplained} label="with written explanations" accent />
      </dl>

      {MODEL_GROUPS.filter((group) => byGroup.has(group)).map((group) => (
        <section key={group} className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
            {group}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byGroup.get(group)!.map((model) => (
              <li key={model.id}>
                <ModelCard model={model} explained={EXPLAINED_BY_REGION[model.id]} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-12 max-w-3xl rounded-lg border border-[var(--border)] bg-white p-4 text-sm leading-relaxed text-[var(--ink-soft)]">
        <strong className="font-medium text-[var(--ink)]">A note on sides.</strong> These
        models show the right side of the body plus the midline structures. The left
        side is a mirror image and is left out, which halves the download and keeps
        the view uncluttered — so a &ldquo;half&rdquo; skeleton is expected, not a
        loading error.
      </p>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd
        className={`text-2xl font-semibold tabular-nums ${
          accent ? "text-[var(--accent)]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </dd>
      <p className="mt-0.5 text-xs text-[var(--ink-faint)]">{label}</p>
    </div>
  );
}
