# Vana — cinematic forest website

A premium studio website set inside a painted Indian forest. A single peacock
feather is tied to scroll position. It descends from the sky, through the
canopy and understorey, and comes to rest in the grass beside Krishna beneath
the ancient tree.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the build
```

## How it fits together

| File | Role |
| --- | --- |
| `index.html` | All content and sections (hero, forest, about, services, work, journey, results, testimonial, destination). |
| `src/style.css` | Design tokens, editorial layout, glass surfaces, responsive rules. |
| `src/content/projects.js` | **Every project on the site.** Edit this file to add, remove or reorder work. |
| `src/content/render-work.js` | Turns `projects.js` into the Work showcase HTML on the home page. |
| `src/content/render-pages.js` | Turns `projects.js` into the `/work` index and one page per project. |
| `src/content/write-pages.js` | Writes those pages into `work/`. The `work-content` plugin in `vite.config.js` runs it in a fresh Node process on dev start, on every content or template save, and at build, so edits are always picked up. |
| `work/` | **Generated. Don't edit.** The plugin rewrites it from `projects.js` on every dev start, save and build. |
| `src/pages.js` | Script for the work pages: the living backdrop (parallax, rays, motes, dusk), the drifting feather, reveals, counters, the `/work` filters and cursor preview, the lightbox and music. It doesn't load the 3D world. |
| `src/ui.js` | Pieces shared by the home page and the work pages (headline word split, count-up, magnetic buttons). |
| `assets/backdrop-*.webp` | Stills of the forest in morning, noon and golden light, captured from the 3D scene (without the feather or butterflies), used behind the work pages. |
| `assets/layers/` | Foreground branches and the flowering grass for the work pages, painted by `paint.js`. |
| `src/showcase.js` | The Work tabs and sliders: the sliding tab highlight, prev/next, counter, progress line, mouse drag and keyboard navigation. |
| `src/work.js` | Draws each growth line as a project comes into view, and opens a project's screenshots in a lightbox (arrows, swipe, thumbnails). |
| `assets/work/` | Client dashboard screenshots (Google Analytics, Search Console, AI features), cropped and compressed to WebP. |
| `src/main.js` | Scroll smoothing, the feather's anchor path, reveals, counters, nav, cursor, tilt and magnetic buttons. |
| `src/world/world.js` | The Three.js "multiplane" diorama: layers, shaders, camera rig and feather physics. Lazy-loaded. |
| `src/world/paint.js` | Procedural painter. Every tree, leaf, grass tuft and light ray is painted with Canvas 2D at load. |
| `src/world/feather.js` | The 3D feather. At load it stands `assets/feather.webp` upright (it finds the quill and the eye automatically), maps it onto a cupped, twisted vane, and adds a real rachis tube. Shaded with anisotropic sheen and translucency. |
| `src/world/krishna.js` | The 2D flute-playing rig for Krishna (fingers, hands, flute, head, breath, curls, silk, tassel), in source-pixel coordinates. |
| `assets/krishna.webp` | Krishna, cut out with a transparent background (about 90 KB). |
| `tools/cutout.js` | Dev tool that regenerates `assets/krishna.webp` from `tools/krishna-source.webp` by keying out the baked-in checkerboard. |
| `assets/feather.webp` | The peacock feather artwork. Any transparent PNG or WebP with a visible blue eye works as a replacement. |

### Krishna

He sits against the forest's ancient tree, lit by the same upper-right sun as everything else (the whole forest is painted with that light). Grading pulls him into the forest palette and haze, and contact shadows ground him on the grass and against the bark. Grass overlaps his hem, and pollen and leaves drift both in front of and behind him. The rig in `krishna.js` warps small regions of the artwork. If the art changes, regenerate the cut-out and update `CROP`, `SEAT_X`, `SEAT_Y` and the rig points.

### Work

The Work section is one tab per discipline (SEO, Websites, Apps, Custom), with a slider of projects in each. However many projects are added, the section never grows taller, so the feather's journey and the day-to-night change keep their pacing.

To add a project:

1. Put its screenshots in `assets/work/` as WebP files (about 1500 px wide is plenty).
2. Add an entry to `PROJECTS` in `src/content/projects.js`. The field list is at the top of that file. `category` picks the tab, and order in the file is order in the slider.
3. Save. The dev server reloads, and `npm run build` bakes the project into `index.html` as real HTML, which search engines can read.

A tab with no projects shows its "coming soon" card (the `empty` text on each category). Set a category's `empty` to `null` to hide the tab until it has work.

Each slide leads with the project's one number (`badge`). The story sits on soft shade over the forest, and the screenshots lie beside it as prints: matted, taped and warm-toned until you hover. A gold growth line, different for every project, draws in as its slide arrives. The first three `shots` make the fan of prints, and every shot opens in the lightbox, in order.

Every project also gets its own page at `/work/<id>/`. `/work` itself is an editorial index: large names in a list, with a print of the project following the cursor on desktop and inline prints on phones. It filters by discipline (for example `/work/?c=seo`).

A project page opens with the story headline (`headline`; wrap words in `*asterisks*` for gold italic), the summary and the prints. Below that come the big number and the headline stats, then chapters that appear only when there's something to say:

- **The challenge** (`challenge`) and **What we did** (`approach`, a paragraph or a list of points): hidden until you write them.
- **The result**: groups of figures from `highlights`. A figure with a % change gets a before/after bar; the "before" is calculated as now ÷ (1 + change), and the page says so. Other figures are set on gold hairlines.
- **The evidence**: every screenshot as a print on a contact sheet.

The page ends with the next project and the grass where the feather lands. Each page has its own title, description, social-preview tags and structured data.

**The work pages' forest.** They don't load the 3D world. Instead:

- **Backdrop:** a still captured from it, in the morning, noon or golden light. Pick it per project with `light`; `/work` uses the morning still.
- **Movement:** near branches (painted by `paint.js`) move in parallax, light rays breathe, and fireflies and pollen drift. The page drifts toward dusk as you scroll down, as the home page does.
- **The feather:** the same one as the home page drifts down the page along `data-feather` anchors and comes to rest in the grass at the foot (`data-feather-land`).

**Moving between pages.** In browsers that support cross-page view transitions (Chrome, Edge), the old page fades and the project's name and front print travel into their places on the next page.

Set `SITE.url` in `projects.js` to the live domain once it's known. Pages then also get canonical links, absolute share images and breadcrumb data. Screenshots are published at stable addresses (`assets/work/<file>.webp`), so those links keep working across builds.

The music carries on across pages: the position in the song is remembered for the rest of the visit.

### Time of day

Scroll also moves the sun. The page opens in morning light, warms to golden hour midway, and reaches moonlit night at the end. `src/world/grade.js` holds the single time-of-day grade shared by every shader. The fog, moon, stars, fireflies and butterflies follow the same curve, set near the top of `update()` in `world.js`.

### Film, light and sound

- `src/world/post.js` is the film pass: bloom (sun, moon, fireflies), god rays that scatter from the sun's or moon's real screen position through canopy gaps, a per-time-of-day grade, a vignette and fine grain.
- Krishna gets moving dappled leaf light by day. At night, a few fireflies are mirrored on the CPU so their light falls on him and on the grass.
- The only audio is the flute song (`src/music.js`), which swells a little as Krishna appears.

### Choreography and small delights

- The feather follows a scroll-driven glide cycle: it swings like a pendulum, banks into each glide, stalls at the ends of a swing, and tumbles every third swing.
- The camera holds for a beat as the canopy opens. Section headlines appear as the feather drifts past them. After the visitor rests at the bottom, the camera slowly pushes in over eight seconds.
- Fireflies drift toward the cursor, butterflies scatter from a quick sweep of the mouse, and clicking a shaft of light makes it bloom.

### Loading and performance

A drawn feather introduces the site while the hero textures paint. Everything needed only further down the page (Krishna, the ancient tree, grass, butterflies, moon) streams in afterwards. A frame-time monitor lowers the render resolution, then drops the god-ray pass, to hold about 60 fps, and restores quality when there's headroom.

### Occlusion

Once the layout is measured, `world.planPath()` walks the feather's route. It places leafy branches along that route (entering from beyond the frame edge), so the feather drifts behind them and emerges again.

### Steering the feather

The feather follows elements marked `data-feather` in the page, in scroll order:

- It reaches each anchor when that anchor sits at `data-fy`, a fraction of viewport height (default `0.5`).
- `data-fd` sets its distance from the camera. Larger values make it smaller and deeper in the forest.
- The anchor marked `data-land` is where it settles in the grass at the very end.

Anchor positions are plain CSS (`.fa-*` classes), so each breakpoint can route the feather differently.

### Camera

The camera path lives in `LAYOUTS` in `src/world/world.js`, as keyframes over overall scroll progress
(`p` from 0 to 1). There are two layouts: `wide` for desktop and tablet, and `tall` for phones.

## Quality tiers

Device width and hardware select `high`, `medium` or `low`. The lower tiers scale the tree, particle
and light-ray counts down. Every Android device gets `low`, whatever its screen size, because Android
GPUs vary widely and some take the browser down under load. `low` also:

- paints every texture at half size, then empties each painted canvas once it's on the GPU;
- renders at no more than 1.25× the screen's pixel density;
- uses ordinary 8-bit render targets instead of half-float ones, and no multisampling;
- turns off frosted-glass (`backdrop-filter`) blurs through the `lite` class.

If WebGL is unavailable, the page sits over a still of the forest (`assets/backdrop-morning.webp`) with
the static artwork. With reduced motion, scroll smoothing, pointer parallax and idle motion are all toned down.

**Crash guard.** Before the 3D forest starts, the page leaves a mark in `localStorage` (`vana:forest`).
The mark is cleared when the forest has run for 8 seconds, or when the page is left or put in the
background. A crash does neither, so on the next visit the mark is still there. That device then gets the
still forest for 14 days. If the GPU drops the WebGL context mid-visit, the page switches to the still
forest immediately. Add `?forest=on` to the address to try the 3D forest again sooner.
