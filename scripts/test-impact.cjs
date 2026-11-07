// Run with node scripts/test-impact.cjs after npm ci.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const { computeImpactAnalysis } = load(path.resolve(__dirname, '../src/lib/impactAnalysis.ts'));
const nodes = ['a', 'b', 'c', 'd', 'other'].map(id => ({ id, name: id, path: id + '.java' }));
const edges = [['a','b'], ['b','c'], ['c','d'], ['b','a']].map(([source,target], i) => ({id: 'e'+i, source, target, type:'calls', weight:1}));
const result = computeImpactAnalysis(nodes[3], {nodes, edges}, false);
assert.equal(result.totalAffected, 3);
assert.deepEqual(result.directDependents.map(d=>d.node.id), ['c']);
assert.deepEqual(result.indirectDependents.map(d=>d.node.id), ['b','a']);
assert.deepEqual(result.indirectDependents[1].pathIds, ['a','b','c','d']);
assert.equal(result.indirectDependents[1].edge.id, 'e0');
console.log('Impact regression passed: arbitrary depth, real edges, cycles, isolated nodes.');
