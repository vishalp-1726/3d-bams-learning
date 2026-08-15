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

In the Cloudflare dashboard, the project needs only:

| Field | Value |
| --- | --- |
| Branch | `main` |
| Deploy command | `npx wrangler deploy` |
| Build command | *(may be left blank)* |
| Build output directory | *(leave blank — `wrangler.jsonc` supplies it)* |

The build command can be blank because `wrangler.jsonc` declares
`build.command: "npm run build"`, so `wrangler deploy` builds first and then
uploads. That is deliberate: it keeps the deploy self-contained rather than
depending on a dashboard field being set correctly.

There are no environment variables and no secrets.

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
rm -rf out                       # prove the build step really runs
npx wrangler deploy --dry-run
```

Expect `[custom build]` output followed by:

```
✨ Read 194 files from the assets directory .../out
No bindings found.
```

**"No bindings found"** is the signal that this is a genuinely static deployment.
Any mention of a Worker script, `WORKER_SELF_REFERENCE`, or OpenNext means the
server path has crept back in.

## Failures seen so far, and what they meant

| Error | Cause |
| --- | --- |
| `Service binding 'WORKER_SELF_REFERENCE' … not found [10143]` | No wrangler config, so Cloudflare auto-ran the OpenNext migration and built a server Worker. Fixed by adding `wrangler.jsonc`. |
| `The directory specified by "assets.directory" … does not exist: /opt/buildhome/repo/out` | Nothing built the site. OpenNext had been running the build; once it was removed, no build step remained. Fixed by `build.command` in `wrangler.jsonc`. |

## Custom domain

Project → **Settings → Domains & Routes → Add**. If the domain is already on
Cloudflare the DNS record is created for you; otherwise point a CNAME at the
`.workers.dev` hostname. TLS is issued automatically and is free.
