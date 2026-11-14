// The whole TogetherJS build. Replaces Gruntfile.js's copylib / maybeless /
// substitute / config-requirejs chain.
//
//   node build/build.mjs              one-shot build into dist/
//   node build/build.mjs --watch      rebuild on change
//   node build/build.mjs --serve      also serve dist/ and examples/ on :8080

import esbuild from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates } from "./templates.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const serve = args.includes("--serve");

// Substituted into the bundle at build time. `hubUrl` is the only one a
// deployer normally needs to override.
const define = {
  __HUB_URL__: JSON.stringify(process.env.HUB_URL || "https://hub.togetherjs.com"),
  __GIT_COMMIT__: JSON.stringify(process.env.GIT_COMMIT || ""),
  __BASE_URL__: JSON.stringify(process.env.BASE_URL || ""),
};

/** Stylesheets are plain CSS now — just copy them across. */
async function buildCss() {
  for (const name of ["togetherjs.css", "recorder.css"]) {
    await fs.copyFile(path.join(SRC, "styles", name), path.join(DIST, name));
  }
}

/** Copy images verbatim; they are referenced by URL, not bundled. */
async function copyAssets() {
  await fs.cp(path.join(SRC, "images"), path.join(DIST, "images"), {
    recursive: true,
  });
}

const shared = {
  bundle: true,
  target: ["es2022"],
  format: "iife",
  define,
  logLevel: "info",
  alias: {
    // walkabout.js does `require("esprima")` / `require("falafel")` guarded by
    // `typeof require != "undefined"`. Point them at the vendored copies.
    esprima: path.join(SRC, "vendor/walkabout/lib/esprima.js"),
    falafel: path.join(SRC, "vendor/walkabout/lib/falafel.js"),
  },
};

/** Entry points that are not the main library. */
const extraEntries = [
  // Loaded standalone by recorder.html, never part of the main bundle —
  // matching the old Gruntfile's explicit exclusion of recorder.js.
  { in: path.join(SRC, "recorder.js"), out: "recorder" },
  // Fetched on demand by the /test chat command; keeps its vendored esprima
  // out of every page load.
  { in: path.join(SRC, "vendor/walkabout/entry.js"), out: "walkabout" },
];

async function buildAll() {
  await fs.mkdir(DIST, { recursive: true });
  const { locales, untranslated } = await buildTemplates();
  console.log(`templates: ${locales.join(", ")}`);
  for (const { lang, missing } of untranslated) {
    console.warn(`  ${lang}: ${missing} untranslated string(s)`);
  }

  const contexts = [];

  // The drop-in <script src="togetherjs.js"> build.
  contexts.push(
    await esbuild.context({
      ...shared,
      entryPoints: [path.join(SRC, "index.js")],
      outfile: path.join(DIST, "togetherjs.js"),
      sourcemap: true,
    }),
  );

  // Same thing, minified. Unlike the old togetherjs-min.js, this one really is.
  contexts.push(
    await esbuild.context({
      ...shared,
      entryPoints: [path.join(SRC, "index.js")],
      outfile: path.join(DIST, "togetherjs.min.js"),
      minify: true,
      sourcemap: true,
    }),
  );

  // Named ESM entry for npm consumers.
  contexts.push(
    await esbuild.context({
      ...shared,
      format: "esm",
      entryPoints: [path.join(SRC, "index.js")],
      outfile: path.join(DIST, "togetherjs.esm.js"),
      sourcemap: true,
    }),
  );

  for (const entry of extraEntries) {
    contexts.push(
      await esbuild.context({
        ...shared,
        entryPoints: [entry.in],
        outfile: path.join(DIST, `${entry.out}.js`),
        sourcemap: true,
      }),
    );
  }

  await buildCss();
  await copyAssets();

  if (watch || serve) {
    await Promise.all(contexts.map((c) => c.watch()));
    if (serve) {
      const { hosts, port } = await contexts[0].serve({
        servedir: ROOT,
        port: 8080,
      });
      console.log(`serving ${ROOT} at http://${hosts[0]}:${port}/`);
    }
    // Stylesheets and images are outside esbuild's graph; poll them.
    watchAssets();
  } else {
    await Promise.all(contexts.map((c) => c.rebuild()));
    await Promise.all(contexts.map((c) => c.dispose()));
  }
}

function watchAssets() {
  const watchDirs = [path.join(SRC, "styles"), path.join(SRC, "templates")];
  for (const dir of watchDirs) {
    fs.watch(dir, { recursive: true })
      .then(async (watcher) => {
        for await (const _event of watcher) {
          try {
            await buildTemplates();
            await buildCss();
            console.log("assets rebuilt");
          } catch (e) {
            console.error("asset rebuild failed:", e.message);
          }
        }
      })
      .catch(() => {});
  }
}

buildAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
