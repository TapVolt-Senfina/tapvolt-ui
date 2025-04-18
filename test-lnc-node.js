// Minimal Node CLI test harness for LNC.connect()
const LNCFactory = require('@lightninglabs/lnc-web').default;

(async () => {
  const client = LNCFactory(); // no `new`
  console.group('Client instance from factory');
  console.dir(client);
  console.log('supports connect?', typeof client.connect);
  if (client.connect) {
    try {
      const inst = await client.connect(process.env.LNC_PAIRING_PHRASE || 'REPLACE_WITH_VALID_PAIRING_PHRASE');
      console.group('LNC instance');
      console.dir(inst);
      console.log('has on():', typeof inst.on);
      console.log('has subscribe():', typeof inst.subscribe);
      console.log('proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(inst)));
      console.groupEnd();
    } catch (err) {
      console.error('client.connect() failed:', err);
    }
  }
  console.groupEnd();
})();
