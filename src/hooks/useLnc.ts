// ────────────────────────────────────────────────
// File: src/hooks/useLnc.ts
// ────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import LNC, { taprpc } from '@lightninglabs/lnc-web';
import { Buffer } from 'buffer';
import { useListAssets, useListBatches } from './listHelpers.ts';

/*──────────────  Public interface  ─────────────*/
export interface LncState {
  /* status */
  lnc: LNC | null;
  isConnected: boolean;
  isConnecting: boolean;
  isInitializing: boolean;

  /* data */
  assets: taprpc.Asset[];
  batchAssets: taprpc.MintAsset[]; // any[] is fine too

  /* helpers */
  connect(pairingPhrase: string): Promise<void>;
  mintAsset(name: string, amount: string, meta: string): Promise<void>;
  finalizeBatch(): Promise<void>;
  cancelBatch(): Promise<void>;
  fundChannel(
    assetId: string,
    amount: string,
    feeRate: string,
    peerKey: string,
  ): Promise<void>;
}

/*──────────────  The hook  ─────────────*/
const useLnc = (): LncState => {
  /* ───── local state ───── */
  const [lnc, setLnc] = useState<LNC | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const [assets, setAssets] = useState<taprpc.Asset[]>([]);
  const [batchAssets, setBatchAssets] = useState<any[]>([]);

  /* keep a stable ref so callbacks always see latest lnc */
  const lncRef = useRef<LNC | null>(null);
  lncRef.current = lnc;

  /* ════════════════════════════════════════════
     1.  Data‑fetch helpers
     ════════════════════════════════════════════ */

  // Defensive event binding utility
  const addListener = (inst: any, evt: string, fn: any) => {
    if (typeof inst.on === 'function')      return inst.on(evt, fn);
    if (typeof inst.subscribe === 'function') return inst.subscribe(evt, fn);
    console.warn('No known event API on LNC instance');
    return undefined;
  };



  /* ════════════════════════════════════════════
     2.  Attach / detach listeners for one LNC instance
     ════════════════════════════════════════════ */
  const listAssets = useListAssets(setAssets, lncRef);
  const listBatches = useListBatches(setBatchAssets, lncRef);

  const attachListeners = useCallback((inst: LNC) => {
    console.group('[LNC] attachListeners');
    console.debug('[LNC] Prototype:', Object.getPrototypeOf(inst));
    console.debug('[LNC] Own properties:', Object.getOwnPropertyNames(inst));

    // Defensive: support both old (.on) and new (.subscribe) APIs
    const onConnected = () => {
      console.info('[LNC] ▶ connected');
      setIsConnected(true);
      listAssets(inst);
      listBatches(inst);
    };
    const onDisconnected = () => {
      console.warn('[LNC] ◀ disconnected');
      setIsConnected(false);
    };
    const onError = (err: unknown) => {
      console.error('[LNC] ✖ runtime error', err);
    };

    // Remove listeners/subscriptions cleanup reference
    let unsubscribe: (() => void) | undefined;

    if (typeof (inst as any).on === 'function') {
      // Legacy EventEmitter API
      inst.on('connected', onConnected);
      inst.on('disconnected', onDisconnected);
      inst.on('error', onError);
      unsubscribe = () => {
        if (typeof (inst as any).off === 'function') {
          inst.off('connected', onConnected);
          inst.off('disconnected', onDisconnected);
          inst.off('error', onError);
        }
      };
      console.debug('[LNC] Using .on/.off event API');
    } else if (typeof (inst as any).subscribe === 'function') {
      // WASM API: subscribe to status changes
      const statusHandler = (status: string) => {
        console.debug('[LNC] status update:', status);
        if (status === 'connected') onConnected();
        if (status === 'disconnected') onDisconnected();
      };
      (inst as any).subscribe('status', {}, statusHandler, onError);
      unsubscribe = () => {
        // No unsubscribe API in docs, but if available, call it here
        // (inst as any).unsubscribe?.('status', statusHandler);
      };
      console.debug('[LNC] Using .subscribe event API');
    } else {
      console.error('[LNC] No supported event API found on LNC instance');
    }
    console.groupEnd();
    return unsubscribe;
  }, [listAssets, listBatches]);

  /* ════════════════════════════════════════════
     2.  One‑time init – try to restore session
     ════════════════════════════════════════════ */
  useEffect(() => {
    let mounted = true;
    (async () => {
      console.debug('[LNC] init(): checking IndexedDB for existing session');
      try {
        const inst = new LNC({});
        if (inst.isReady) {
          console.info('[LNC] session found → establishing tunnel');
          attachListeners(inst);
          if (mounted) {
            setLnc(inst);
            setIsConnected(true);
            setIsInitializing(false);
          }
          return; // nothing else to do
        }
        if (mounted) setIsInitializing(false); // show the “paste phrase” form
      } catch (e) {
        console.error('[LNC] init() failed:', e);
        if (mounted) setIsInitializing(false);
      }
    })();
    return () => { mounted = false; };
  }, [attachListeners]);

  /* ════════════════════════════════════════════
     3.  Explicit connect with fresh pairing phrase
     ════════════════════════════════════════════ */
  const connect = useCallback(
    async (pairingPhrase: string) => {
      if (!pairingPhrase.trim()) throw new Error('Pairing phrase required');
      if (lncRef.current?.isReady) return; // already paired
      setIsConnecting(true);
      let mounted = true;
      try {
        const inst = new LNC({ pairingPhrase });
        await inst.connect();
        const unsubscribe = attachListeners(inst);
        if (mounted) {
          setLnc(inst);
          setIsConnected(true);
        }
        // Clear phrase from state (handled in UI)
        return () => { mounted = false; unsubscribe?.(); };
      } catch (err) {
        if (mounted) {
          setIsConnected(false);
          setLnc(null);
        }
        throw err;
      } finally {
        if (mounted) setIsConnecting(false);
      }
    },
    [attachListeners],
  );

  /* ════════════════════════════════════════════
     4.  Data‑fetch helpers
     ════════════════════════════════════════════ */




  /* ════════════════════════════════════════════
     5.  Wallet actions
     ════════════════════════════════════════════ */
  const mintAsset = useCallback(
    async (name: string, amount: string, meta: string) => {
      const inst = lncRef.current;
      if (!inst?.tapd?.mint) throw new Error('Mint service unavailable');

      console.debug('[LNC] mintAsset()', { name, amount, meta });
      const cleanName = name.trim().replace(/[\r\n]+/g, '');
      const amt = parseInt(amount, 10);
      if (!cleanName || !amt) throw new Error('Name & positive amount required');

      const metaB64 = meta ? Buffer.from(meta.trim(), 'utf8').toString('base64') : '';

      await inst.tapd.mint.mintAsset({
        short_response: false,
        asset: {
          asset_version: 0,
          asset_type: 0,
          name: cleanName,
          amount: amt.toString(),
          asset_meta: { data: metaB64, type: 0 },
        },
      });

      /* refresh */
      await listBatches(inst);
    },
    [listBatches],
  );

  const finalizeBatch = useCallback(async () => {
    const inst = lncRef.current;
    if (!inst?.tapd?.mint) throw new Error('Mint service unavailable');
    console.debug('[LNC] finalizeBatch()');
    await inst.tapd.mint.finalizeBatch({ fee_rate: 10 });
    await listAssets(inst);
    await listBatches(inst);
  }, [listAssets, listBatches]);

  const cancelBatch = useCallback(async () => {
    const inst = lncRef.current;
    if (!inst?.tapd?.mint) throw new Error('Mint service unavailable');
    console.debug('[LNC] cancelBatch()');
    await inst.tapd.mint.cancelBatch({});
    await listBatches(inst);
  }, [listBatches]);

  const fundChannel = useCallback(
    async (assetId: string, amount: string, feeRate: string, peerKey: string) => {
      const inst = lncRef.current;
      if (!inst?.tapd?.tapChannels) throw new Error('Channel service unavailable');

      console.debug('[LNC] fundChannel()', { assetId, amount, feeRate, peerKey });

      const req = {
        asset_amount: amount,
        fee_rate_sat_per_vbyte: parseInt(feeRate, 10),
        asset_id: Buffer.from(assetId.trim(), 'hex'),
        peer_pubkey: Buffer.from(peerKey.trim(), 'hex'),
      };
      await inst.tapd.tapChannels.fundChannel(req);
    },
    [],
  );

  // Add a logout function for session wipe
  const logout = useCallback(() => {
    // Always attempt disconnect, even if not connected
    if (lncRef.current) {
      console.log('[LNC] Calling disconnect() on logout, regardless of connection state');
      lncRef.current.disconnect();
    } else {
      // Try to create a dummy instance and call disconnect for debugging
      try {
        const dummy = new (window as any).LNC ? new (window as any).LNC({}) : null;
        if (dummy) {
          console.log('[LNC] Calling disconnect() on dummy instance for debugging');
          dummy.disconnect();
        }
      } catch (e) {
        console.warn('[LNC] Could not create dummy instance for disconnect:', e);
      }
    }
    if ('indexedDB' in window) {
      indexedDB.deleteDatabase('lnc');
    }
    setIsConnected(false);
    setLnc(null);
  }, []);

  /* ───── return everything the UI needs ───── */
  return {
    lnc,
    isConnected,
    isConnecting,
    isInitializing,
    assets,
    batchAssets,
    connect,
    logout,
    mintAsset,
    finalizeBatch,
    cancelBatch,
    fundChannel,
  };
};

export default useLnc;
