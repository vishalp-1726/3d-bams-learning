# Deploying to Cloudflare

The site is a **static export** — plain HTML, JS and 74 MB of GLB models — with no
server code of any kind. All 41 routes are prerendered at build time.

Cloudflare is used because it is the only free tier with **unlimited bandwidth**,
and bandwidth is this project's binding constraint: a student who opens several
regions downloads tens of megabytes.

| | Cloudflare | GitHub Pages | Vercel Hobby |
| --- | --- | --- | --- |
| Bandwidth / month | **Unlimited** | 100 GB (soft) | 100 GB |
| Commercial use | Allowed | Not allowed | Not allowed |
| Max file size | 25 MiB | — | — |

The largest model here is 6.6 MB, well inside the 25 MiB per-file cap, and the
exported site is 194 files against a 20,000 limit.

---

## Settings

In the Cloudflare dashboard, the project needs:

| Field | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build output directory | *(leave blank — `wrangler.jsonc` points at `out`)* |

Everything else is already in the repo. There are no environment variables and no
secrets.

---

## Why `wrangler.jsonc` exists — read before removing it

The first deploy **failed**, and the reason is worth recording.

With no wrangler config present, Cloudflare detected "Next.js" and automatically
ran `@opennextjs/cloudflare migrate`. That rewrites the project to deploy as a
**server-rendered Worker** built from `.next`, pulling in 278 extra packages. It
then failed at the last step:

```
Service binding 'WORKER_SELF_REFERENCE' references Worker 'bams-3d-learning'
which was not found.  [code: 10143]
```

The generated binding used the **package name** (`bams-3d-learning`) while the
Cloudflare project is called `3d-bams-learning`.

Two things were fixed:

1. **`wrangler.jsonc`** declares an assets-only deployment pointing at `./out`.
   Omitting `main` is what makes it static. Its presence also stops the OpenNext
   migration from running at all.
2. **`package.json` `name`** now matches the project name, so that class of
   mismatch cannot recur.

This site should never be deployed as a Worker. There is nothing to run on a
server, and static asset requests are unmetered on the free plan, which is the
entire reason for choosing Cloudflare.

---

## What else is already configured

- **`output: "export"`** in `next.config.mjs` — writes `./out`.
- **`public/_headers`** — copied into the export and read by Cloudflare. Caches
  models and the Draco decoder for a year as `immutable`; without it every visit
  re-downloads several megabytes. Note that `headers()` in `next.config.mjs`
  would **not** work: it is a server feature and static export drops it.
- **Models committed to the repo**, so a deploy never depends on the
  universities' server being reachable. CC BY-SA 4.0 permits this redistribution;
  attribution is on the `/attributions` page.

## Verifying a build locally first

`npm start` runs the Next server, which is *not* what Cloudflare does. To test the
real artefact:

```bash
npm run build          # writes ./out
npm run serve:static   # serves ./out as a plain static host on :4173
BASE_URL=http://localhost:4173 npm run check:visual -- --all
```

That last command drives a real browser over all 36 models against the exported
files — the only way to catch an export-only fault such as a route that resolves
through the Next router but not as a file, or a `.glb` served with the wrong MIME
type.

To check the Cloudflare config itself without deploying:

```bash
npx wrangler deploy --dry-run
```

It should report the file count from `out` and **"No bindings found"**. Any
mention of a Worker script or a service binding means the OpenNext path has crept
back in.

## Custom domain

Project → **Settings → Domains & Routes → Add**. If the domain is already on
Cloudflare the DNS record is created for you; otherwise point a CNAME at the
`.workers.dev` hostname. TLS is issued automatically and is free.
