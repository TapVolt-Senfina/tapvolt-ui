import AuthStore from './AuthStore';
// Import your API wrappers here, e.g. LndApi
// import LndApi from '../api/LndApi';

export class RootStore {
  // Example API wrappers
  api: any;
  auth: AuthStore;
  // lnc: LncStore; // Uncomment and implement if you have a LncStore

  constructor() {
    // Replace with your actual API initialization
    this.api = { lnd: { getInfo: async () => {}, setCredentials: (c: string) => {} } };
    this.auth = new AuthStore(this);
    // this.lnc = new LncStore(this); // Uncomment if you have a LncStore
  }
}

export const root = new RootStore();
