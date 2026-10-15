// Jest 30 always adds the `node` export condition when resolving `require()`, even under jsdom.
// Packages that list `node` before `browser` in their exports (e.g. @firebase/auth) then load their
// Node build, which expects Node globals like `fetch` that jsdom doesn't expose. Drop `node` when the
// environment asks for `browser` so resolution matches Jest 29.
export default function resolver(path, options) {
  const conditions = options.conditions?.includes('browser')
    ? options.conditions.filter(condition => condition !== 'node')
    : options.conditions;

  return options.defaultResolver(path, { ...options, conditions });
}
