const fs = require('fs'), vm = require('vm');
const el = () => new Proxy(function () {}, { get: (t, p) => p === 'style' ? {} : p === 'classList' ? { add() {}, remove() {}, toggle() {} } : p === 'value' ? '' : p === 'length' ? 0 : el(), set: () => true, apply: () => el() });
const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), documentElement: {}, body: {} };
const ctx = { document: doc, window: { addEventListener() {}, scrollTo() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, console, setTimeout, navigator: {}, alert() {}, requestAnimationFrame() {} };
ctx.window.document = doc; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('CotizadorVG/app.js', 'utf8') + `
;this.T = { estado: () => estado, asig: asignarPlanAAsegurado, mez: obtenerPlanesConMezclaPrincipalFamiliares };`, ctx);
const T = ctx.T, e = T.estado();
const cob = [{ codigo: 'VIDA', nombre: 'Vida' }, { codigo: 'IPP', nombre: 'IPP' }];
e.coberturasCatalogo = cob;
e.subgrupos = [{ id: 'sg', nombre: 'G1', coberturas: ['VIDA', 'IPP'], asegurados: [] }];
const base = { id: 'A', subgrupoId: 'sg', nombre: 'Plan A', valoresCobertura: { VIDA: 1, IPP: 1 }, deduciblesCobertura: {}, factoresEnfermedadesGraves: {}, cancerInSituPorCobertura: {}, asegurados: [] };
const mk = (id, tipo) => ({ id, tipoAsegurado: tipo, edad: 30, numeroDocumento: id, coberturas: [] });
e.asegurados = [mk('p1', 'Afiliado principal'), mk('c1', 'Conyugue'), mk('h1', 'Hijos'), mk('p2', 'Afiliado principal')];
const o = { renderizar: false, guardar: false, notificar: false };
for (const m of ['Voluntaria (Contributiva)', 'Mixta (Contributiva)', 'Patronal (No Contributiva)']) {
  e.poliza.modalidadPlan = m;
  e.planes = [{ ...base, asegurados: [] }];
  e.asegurados.forEach(a => T.asig(a.id, 'A', o));
  console.log(m, e.planes.map(p => `${p.nombre}[${p.asegurados.join(',')}] fam=${!!p.soloFamiliares}`), 'mezclados:', T.mez().length);
}
e.poliza.modalidadPlan = 'Mixta (Contributiva)';
e.planes = [{ ...base, asegurados: [] }];
e.asegurados.forEach(a => T.asig(a.id, 'A', o));
const planFam = e.planes.find(p => p.soloFamiliares);
console.log('principal a plan familiar ->', T.asig('p1', planFam.id, o), e.asegurados[0].planId);
console.log('familiar a plan familiar ->', T.asig('c1', planFam.id, o), e.asegurados[1].planId === planFam.id);
console.log(e.planes.map(p => `${p.nombre}[${p.asegurados.join(',')}]`), 'mezclados:', T.mez().length);
