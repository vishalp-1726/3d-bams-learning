# Anatomy 3D — for BAMS & MBBS students

**Live: <https://3d-bams-learning.vishalp4607.workers.dev>**


A free 3D anatomy learning site built on **anatomically segmented** models: every
structure is a separate, individually named object, not a single sculpted shape with
labels stuck on top.

Click a carpal bone and it tells you which one. Hide the muscles and the nerves
underneath are still there, still named.

## Why this exists

Most free "3D anatomy" sites use a single AI-generated mesh per organ with hotspots
placed on the surface. You can't click the left ventricle, because there is no left
ventricle — there's one undifferentiated shell.

The models here come from **Open3DModel**, built by the anatomy departments of Leiden
UMC, UMC Utrecht, Maastricht UMC and KU Leuven, labelled to Terminologia Anatomica.

**36 models · 4,300+ individually named structures · 74 MB total.** Whole skeleton,
skull (plain, colour-coded, exploded, and the cranial base), trunk wall, pelvic floor,
inguinal canal, the complete upper and lower limbs, and every major joint and named
nerve in between. The hand alone has 194 named structures in 3.1 MB.

## Getting started

Requires Node.js 20+.

```bash
npm install          # also copies the Draco decoder into public/draco/
npm run setup        # downloads the GLB models, then indexes their mesh names
npm run dev          # http://localhost:3000
```

Model files total ~74 MB and are **not** committed to git — `npm run setup`
fetches them. See `models/LICENSE.md` for provenance.

## How it fits together

The whole design rests on one idea: **the mesh name is the join key.**

```
public/models/hand.glb          223 meshes, each already named "Capitate", "Adductor pollicis", …
        │
        ├─ scripts/extract-mesh-names.mjs  →  data/mesh-index.json   (ground truth)
        │
        └─ data/structures.json            →  teaching content, joined by exact mesh name
                                               (TA2 Latin, plain English, clinical note,
                                                curriculum codes)
```

Layer grouping is **not** hand-authored — with 4,300 structures it could not be. The
GLBs organise meshes under top-level group nodes, and `lib/tissue-map.mjs` derives the
tissue layer from those. Across the 36 models there are **111 distinct group names in
six different conventions**:

| convention | example |
| --- | --- |
| plain tissue | `Bones`, `Muscles` |
| region – tissue | `Hand and wrist - bones` |
| tissue – qualifier | `Veins - Superficial` |
| tissue + region | `Muscles of back` |
| organ system | `Genital system` |
| mixed region | `Posterior trunk part` (ligaments + vessels + cartilage together) |

So the layer is resolved **per mesh**, not per group: an unambiguous group wins;
otherwise the mesh's own name is used (leftmost keyword, because anatomical names are
head-first — *"Articular **cartilage** of sacroiliac joint on hip bone"* is a
cartilage); otherwise the group's best guess; otherwise `unclassified`.

`unclassified` is deliberately distinct from `other`. Only positively-identified
fascia and overlays are hidden by default. Anything we merely failed to label stays
**visible** — hiding a structure because classification failed would make it
undiscoverable. (Muscle names are the usual culprit: "Adductor magnus" contains no
tissue keyword at all.)

Because names ship with the geometry, **there are no dead clicks** — every mesh
yields a correct anatomical name even before anyone writes content for it. Written
content is a progressive enhancement on top.

## The models are hemi-body — and the viewer can complete them

Every model contains the **right side only**, plus midline structures. Counted from
the files:

```
overview-skeleton:      107 right (.r)   0 left (.l)   37 midline
insertions-and-origins: 303 right (.r)   0 left (.l)   38 midline
```

There are no left-sided meshes at all — the consortium omits the mirror-image half
to halve the download.

"Mirror to a whole body" in the left rail reflects the **lateral** structures across
the midline to build the missing side. Midline structures (vertebrae, sacrum,
sternum, skull) are deliberately excluded from the reflection: they sit on the
mirror plane, so duplicating them would place two coincident surfaces in the same
position and z-fight. Mirrored meshes register under the same names as their
originals, so selecting a structure highlights both sides.

It is off by default — it doubles the geometry drawn, and the label says plainly
that the added half is a reflection rather than scanned data.

Three details the mirror needs to get right:

- **The seam is clipped, not fudged.** Each half carries a clipping plane at the
  midline — the original keeps `x <= plane`, the reflection keeps `x >= plane` — so
  the two share no volume at all and there is nothing for the depth buffer to fight
  over. A polygon offset was tried first and was not reliable.
- **Only LATERAL meshes are clipped.** Midline structures straddle the plane by
  design (36 of the skeleton's 37 unmarked meshes cross x=0). Clipping those too
  deletes their far half — which looked like a skull sliced in two and a spine full
  of gaps. Because materials are shared between lateral and midline meshes, each
  lateral mesh needs its own material instance before it can be clipped.


- **Seams.** Seven structures reach the midline exactly — the maxilla, nasal and
  palatine bones, trapezius, the rhomboids, splenius cervicis and serratus
  posterior inferior. Their reflections meet the originals at coincident surfaces,
  and the depth buffer then flickers between the two, showing up as speckle across
  the face and neck. Mirrored materials carry a polygon offset so the original wins
  consistently.
- **Re-centring.** Mirroring doubles the body's width and moves its centre onto the
  midline. Leaving the orbit target on the right half's centre — about a fifth of
  the model's width off to one side — makes every drag swing the body through an
  arc instead of turning it. The camera re-frames whenever the mirror is toggled.
  `npm run check:mirror` asserts the result is symmetric to within a pixel or two.

## Drag versus click

R3F fires `onClick` whenever pointerdown and pointerup land on the same object,
however far the pointer travelled between them. Since rotating means pressing on the
model and dragging, every attempt to turn the view also re-selected whatever was
under the cursor, and the info panel kept changing underfoot.

`lib/viewer-store.ts` records the press position at the canvas level — including
presses that start over empty background, so those count as rotations too — and
anything past five pixels is treated as a drag rather than a click.

## One entry, every model

The same structure is named differently from file to file, and all of these are
real:

```
Scaphoid          Scaphoid.r        Humerus.r.        Deltoid muscle.r2
" Rectus abdominal muscle.r"        Iliacus origin and insertion.r
```

`lib/canonical-name.mjs` reduces a name to what it is actually about — dropping
three.js's mangling, the side marker in any of its spellings, a trailing "muscle",
and the "origin and insertion" suffix used by the attachments model. Lookups try
the most specific form first, so an exact match always beats an alias.

The practical effect: teaching content is written once and appears in every model
containing that structure. It is also what makes the 341 attachment patches in the
muscle-attachments model resolve to their muscle's entry, instead of dead-ending
with a name and no explanation.

## The one rule you must not break

> **Never run `gltf-transform join`, `prune`, `dedup --meshes`, or `gltfpack` on
> these models.**

Those commands merge geometry and collapse the node tree, which deletes the mesh
names. The file still renders perfectly afterwards, so the damage is invisible until
a student clicks a structure and gets nothing.

```bash
npm run models:verify    # fails the build if any name was lost
```

This checks three things: that every name in `data/mesh-index.json` still exists in
the GLB; that no group resolves entirely into the hidden decoration layer (which would
silently make a whole region unreachable); and that every `meshNames` entry in
`data/structures.json` resolves to real geometry. Run it in CI.

## Adding models

The consortium publishes new sub-models over time, and a model's viewer slug is not
guessable from its title. `npm run models:discover` crawls the AnatomyTOOL index,
confirms each asset downloads, and reports anything not yet in `data/models.json` —
add a title, blurb and group there, then re-run `npm run setup`.

Draco and Meshopt compression are safe — they compress vertex data without touching
the scene graph.

## The other name trap: three.js rewrites node names

`models:verify` reads the raw GLB and is **blind** to what happens at load time.
three.js's GLTFLoader passes every node name through
`PropertyBinding.sanitizeNodeName`, so the scene you actually raycast against
contains mangled names:

```
"Anterior cruciate ligament.r"   ->  "Anterior_cruciate_ligamentr"
"Scaphoid"                       ->  "Scaphoid"            (unchanged)
```

Whitespace becomes `_` and `. [ ] : /` are stripped. Nearly every name in these
models has a space or a trailing `.r`, so matching raw names at runtime fails for
almost everything — while still working for single-word names like `Scaphoid`. It
looks fine in a spot check and is broken everywhere else.

The fix is `lib/canonical-name.mjs`: content is authored verbatim (so it stays
checkable against the file), but every lookup goes through `canonicalMeshName()`.
`public/mesh-labels/<region>.json` maps canonical names back to the originals for
display, so unlabelled structures don't read as `Anterior_cruciate_ligamentr`.

**Only `npm run check:visual` can catch a regression here** — it drives a real
browser, so it sees the loader's transformation. If a three.js upgrade changes
`sanitizeNodeName`, that check fails and the static ones won't.

## Visual checks

```bash
npm run dev                       # in one terminal
npm run check:visual              # in another
npm run check:visual -- zone-knee # single region
```

Launches its own headless Chromium, so it does not depend on any window being open
or focused. (A minimised tab reports `visibilityState: "hidden"`, and Chrome then
suspends `requestAnimationFrame` and `ResizeObserver` — R3F never measures its
container and renders nothing at all. Headless is always `visible`.)

Per region it asserts: the model loads, the canvas is measured, pixels are actually
painted, the render loop ticks, and searching for a structure selects it and shows
the right record in the info panel. Screenshots land in `.visual/`.

Coverage and zoom are measured from **screenshots**, decoded with sharp in
`scripts/pixels.mjs` — never by reading the WebGL canvas in-page. A context without
`preserveDrawingBuffer` is cleared once composited, so `ctx2d.drawImage(canvas)`
returns transparent pixels that compare as "not background" and report 100%
coverage for a blank canvas. That false positive is the whole reason the check
exists.

Screenshots go through `scripts/canvas-shot.mjs`, which hides anything layered over
the canvas first. Playwright's element screenshot captures the page clipped to the
element's box, *including overlapping elements* — so as soon as the view-control bar
was added, every measurement quietly started including it. The tell was a silhouette
exactly 349px wide in all six views, front and side alike, which is impossible for a
body and was in fact the width of the control bar.

The reported fps is SwiftShader software rendering — it proves the loop runs, it is
**not** a performance measurement. Real load cost splits as roughly 0.3–0.8 s of
network and the rest CPU; on a machine with a GPU the CPU portion is far smaller
than these figures suggest.

## Layout

The explorer is canvas-first: the model fills the viewport and every control
floats over it. The earlier version gave two fixed side columns a permanent third
of the screen even when nothing was selected, and on a phone it squeezed the model
into a strip with controls stacked below, so the page scrolled.

| viewport | canvas before | canvas after |
| --- | --- | --- |
| laptop 1366×768 | 758×721 | 1366×721 |
| desktop 1440×900 | 832×853 | 1440×853 |
| phone 390×844 | 390×439 | 390×797 |

`npm run check:layout` (`scripts/diagnose-layout.mjs`) asserts the page does not
scroll at any of those sizes. That matters for more than tidiness: if the document
can scroll, a drag beginning on the viewer can scroll the page instead of rotating
the model, which is indistinguishable from broken rotation.

`body` uses `h-dvh` rather than `min-h-screen` — the dynamic viewport unit accounts
for mobile browser chrome appearing and disappearing.

On phones the detail panel is a bottom sheet over the model rather than a column
beside it, and the view controls sit just above the action bar within thumb reach.

## Hydration warnings

If your browser console shows *"A tree hydrated but some attributes of the server
rendered HTML didn't match"*, check whether it is actually ours:

```bash
npm run check:hydration
```

Extensions inject attributes into `<html>` and `<body>` before React hydrates —
Grammarly adds `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed`, Scribe
adds `data-scribe-recorder-ready`, and password managers and dark-mode tools do the
same. React cannot tell those apart from a real bug.

`app/layout.tsx` therefore sets `suppressHydrationWarning` on `<html>` and `<body>`
**only**. That flag is shallow — it covers each element's own attributes and text,
not its descendants — so genuine mismatches anywhere inside the app still surface.
This is verified, not assumed: temporarily rendering `typeof window === "undefined"`
in a client component makes `check:hydration` fail with exit code 1.

In an extension-free Chromium this app renders `<html lang>` and `<body class>` and
nothing else, with zero console errors on every page.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run setup` | Fetch models + rebuild the mesh-name index |
| `npm run models:discover` | Crawl AnatomyTOOL for newly published models → `data/model-sources.json` |
| `npm run models:fetch` | Download GLBs into `public/models/` (`--force` to re-download) |
| `npm run models:names` | Rebuild `data/mesh-index.json` from the GLBs |
| `npm run models:verify` | **Asset integrity guard** — run in CI |
| `npm run audit` | **Content accuracy audit** — misfiled, duplicated or mismatched entries |
| `npm run coverage` | The real content gap, ordered by impact (`-- --all` for everything) |
| `npm run check:content` | **No dead ends** — every structure in every model resolves |
| `npm run generate` | Rebuild content for the formulaic structure families |
| `npm run check:visual` | End-to-end render + click-through check in headless Chromium |
| `npm run check:hydration` | Detect real hydration mismatches, free of extension noise |
| `npm run check:zoom` | Verify zoom-to-cursor and that the dev badge is hidden |
| `npm run check:rotate` | Verify drag actually rotates, through 360° and in tilt |
| `npm run check:mirror` | Verify the whole-body mirror, and rotation after zooming |
| `npm run check:views` | Verify all six standard views give distinct camera angles |
| `npm run shots` | Screenshot the non-3D pages at desktop and phone widths |
| `npm run typecheck` | `tsc --noEmit` |

## Adding teaching content

Content lives one file per region in `data/structures/`. Add a JSON file there, then
import it in `lib/structures.ts`.

The only field that must be exactly right is `meshNames` — copy it **verbatim** from
`data/mesh-index.json`. The source models contain spelling mistakes and stray
punctuation, and every one of them must be preserved:

```
"Medial collatertal ligament.r"      not "collateral"
"Musculocutaneus nerve.r"            not "Musculocutaneous"
"Lateral meniscus.r."                note the trailing dot
"Distal phalanx of 2d finger"        not "2nd"
```

Never "tidy" a mesh name — that silently breaks the join and the structure becomes
unclickable. `lib/mesh-name.ts` turns them into readable labels at display time, and
`npm run models:verify` fails on any name that does not resolve.

### No dead ends

Clicking any structure must produce something useful. Resolution runs in three
tiers, and the panel says plainly which one it used:

| tier | what it means |
| --- | --- |
| **specific** | the structure has its own written entry |
| **parent** | it is a named PART of one that does — `Sternocostal head of pectoralis major muscle.r` resolves to pectoralis major, which is genuinely what the reader wants |
| **general** | nothing more specific exists, so describe what this tissue *is*, from its layer |

The parent tier exists because whole-name matching alone left named heads,
branches and parts of already-written structures showing nothing. The general tier
exists because "a written explanation hasn't been added yet" is a dead end; a short
accurate statement of what an artery or a bursa is, attached to a correctly-named
structure, is more use — provided the interface is honest that it is general, which
it is.

`npm run check:content` walks all 4,453 teachable instances across all 36 models and
fails if any would render nothing:

```
  specific entry :  2920  65.6%
  via parent     :   330   7.4%
  general tissue :  1203  27.0%
No dead ends: every structure resolves to an explanation.
```

### Measuring the gap honestly

`npm run coverage` reports two numbers, and the second is the one that matters:

```
Distinct structures      : 1525
  with an explanation    : 635  (41.6%)
Clicks that land on content: 2683/4453 (60.3%)
```

4,453 is the count of mesh *instances*; the same femur appears in a dozen models.
1,525 is the number of distinct structures. Instance-weighted coverage is what a
student actually experiences when clicking around, so writing a structure that
appears in twelve models is worth twelve times one that appears in a single model —
and the report is ordered by exactly that.

### Generated content for formulaic families

Several hundred structures belong to families where the name fully determines the
anatomy: articular cartilages, phalanges, metacarpals and metatarsals, interossei,
lumbricals, numbered vertebrae, the costovertebral joints. Writing 46 phalanges by
hand would be 46 near-identical paragraphs, so `npm run generate` produces them from
handlers that understand the pattern.

This is not filler — each handler states the real anatomy of that structure, because
a placeholder would be worse than the honest "not written yet" notice it replaces.
Hand-written entries always win: the generator skips any mesh already covered, so a
specific entry (the 1st metacarpal and Bennett's fracture) is never shadowed by a
generic one. Anything the handlers do not recognise is left alone and shows up in
the coverage report to be written by hand.

### Checking the content, not just the names

`models:verify` proves a mesh name RESOLVES. `npm run audit` asks whether the content
attached to it is the RIGHT content:

- **Declared layer vs derived layer.** Every entry declares a `layer`, and the
  model's own grouping independently implies one. They are derived from completely
  separate sources, so a disagreement means the entry is filed against the wrong
  tissue — the strongest available signal that content has been mixed up. This is
  what caught the meniscal horns being filed as cartilage when the source
  (correctly) treats them as ligamentous attachments.
- **Name plausibility.** The English name must share vocabulary with the mesh it
  claims, allowing for English/Latin stems like *scalene*/*scalenus*. Near-zero
  overlap is how interchanged content shows up.
- **Duplicate claims and side-alias collisions**, so two structures can never fight
  over the same mesh.
- **Coverage**, per field.

A handful of disagreements are structural rather than mistakes — the source models
have no separate Tendons group, so tendons live under `Muscles`. Those are listed as
*expected differences* with the reason, never silently suppressed.

## Hosting

Static export (`output: "export"`), deployed to **Cloudflare Pages**. See
[DEPLOY.md](DEPLOY.md) for the setup steps and why Cloudflare rather than GitHub
Pages or Vercel — in short, this site is 74 MB of 3D models, so bandwidth is the
binding constraint and Cloudflare's free tier is the only one without a cap.

```bash
npm run build          # writes ./out
npm run serve:static   # serve ./out exactly as a static host would
BASE_URL=http://localhost:4173 npm run check:visual -- --all
```

Testing against `npm start` would not prove the export works: that runs the Next
server, not a static host. Models can still be moved off to Cloudflare R2 by
setting `NEXT_PUBLIC_MODEL_BASE_URL`; nothing else changes.

## Licence

Site code: see `LICENSE`. Model assets: **CC BY-SA 4.0**, see `models/LICENSE.md` and
the `/attributions` page. If you modify a model, you must publish the modified file
under CC BY-SA 4.0 and record it in `models/LICENSE.md`.
