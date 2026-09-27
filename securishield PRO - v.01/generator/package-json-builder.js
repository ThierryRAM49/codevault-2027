export const generatePackageJson = (name, dependencies = []) => JSON.stringify({
  name: name.toLowerCase().replace(/\s/g, '-'),
  version: '1.0.0',
  main: 'index.js',
  scripts: {
    start: 'node index.js',
    test: 'jest'
  },
  dependencies: Object.fromEntries(dependencies.map(d => [d, "^1.0.0"])),
  engines: { node: ">=18.0.0" }
}, null, 2);
