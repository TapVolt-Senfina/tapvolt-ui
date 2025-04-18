// inspect-lnc-proto.js
const LNC = require('@lightninglabs/lnc-web').default;

console.group('Default export (LNC) type and prototype');
console.log('typeof default export:', typeof LNC);
if (typeof LNC === 'function') {
  console.log('Is it a class constructor?', /^\s*class\s+/.test(LNC.toString()));
  console.log('Prototype methods:', Object.getOwnPropertyNames(LNC.prototype));
}
console.groupEnd();
