/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* A tiny lazy-module registry.
 *
 * The client has genuine import cycles: session needs ui, ui needs session,
 * peers needs ui, and so on. Under RequireJS these were expressed as deferred
 * `require("ui")` calls made long after load. Plain ESM cannot express that —
 * a static `import ui from "../ui/ui.js"` inside session.js would evaluate
 * ui.js *before* session.js's own body, so ui.js's top-level `session.on(...)`
 * would run against an uninitialized binding.
 *
 * So the modules on a cycle publish themselves here as they evaluate, and
 * their dependents look them up at call time. Same semantics as the old
 * `require("ui")`, minus the module loader.
 */

var modules = {};

/** Publish a module under a name. Called at the bottom of each cyclic module. */
export function provide(name, mod) {
  modules[name] = mod;
  return mod;
}

/** Look a module up. Throws if it has not been loaded yet — a programming
    error, since ../index.js imports the whole graph before anything runs. */
export function need(name) {
  var mod = modules[name];
  if (!mod) {
    throw new Error(
      "TogetherJS module '" + name + "' was used before it loaded (check src/index.js imports)",
    );
  }
  return mod;
}

/** Non-throwing variant, for genuinely optional modules. */
export function maybe(name) {
  return modules[name] || null;
}
