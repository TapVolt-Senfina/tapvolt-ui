import { makeAutoObservable, runInAction } from 'mobx';
import { Store } from './RootStore';

export default class AuthStore {
  private root: Store;
  authenticated = false;
  errors = { main: '', detail: '' };
  lnc: any = null;

  constructor(root: Store) {
    makeAutoObservable(this, {}, { autoBind: true });
    this.root = root;
  }

  /** Attach listeners to the LNC instance */
  attachListeners(inst: any) {
    if (!inst) return;
    // Example: inst.on('stateChanged', ...)
    // Extend as needed for your app
  }

  /** Auto-login/init: try to rehydrate from IndexedDB/session */
  async init() {
    try {
      const inst = new (window as any).LNC({});
      if (inst.isReady) {
        this.lnc = inst;
        this.attachListeners(inst);
        runInAction(() => { this.authenticated = true; });
        return;
      }
      // Hardcoded phrase for testing
      await this.login('buffalo very rotate mind hobby embrace supreme drive target recycle');
    } catch (err) {
      runInAction(() => { this.authenticated = false; });
    }
  }

  /** Login with a new pairing phrase (call connect ONCE, never store phrase) */
  async login(pairingPhrase: string) {
    if (!pairingPhrase) throw new Error('Pairing phrase required');
    try {
      const inst = new (window as any).LNC({ pairingPhrase });
      await inst.connect(pairingPhrase);
      this.lnc = inst;
      this.attachListeners(inst);
      runInAction(() => { this.authenticated = true; });
    } catch (err: any) {
      this.logout();
      throw new Error(this.translateErr(err.message));
    }
  }

  /** Logout: disconnect and clear session */
  async logout() {
    try {
      if (this.lnc) {
        this.lnc.disconnect();
      }
      // Wipe IndexedDB for lnc
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('lnc');
      }
    } catch {}
    runInAction(() => {
      this.lnc = null;
      this.authenticated = false;
    });
  }

  /** Friendly error translation */
  translateErr(msg: string) {
    if (msg.includes('wallet locked')) return 'Wallet is locked – unlock it first';
    if (msg.includes('expected 1 macaroon')) return 'Invalid password';
    if (msg.includes('stream not found')) return 'Invalid or expired pairing phrase';
    return 'Unable to reach node';
  }
}
