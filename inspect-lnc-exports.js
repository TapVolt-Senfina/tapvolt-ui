// Inspect what @lightninglabs/lnc-web exports in Node.js
const lncWeb = require('@lightninglabs/lnc-web');
console.group('Full module export:');
console.dir(lncWeb, { depth: 2 });
console.groupEnd();
console.log('Keys on the export:', Object.keys(lncWeb));
if (lncWeb.default) {
  console.log('Keys on default export:', Object.keys(lncWeb.default));
}
