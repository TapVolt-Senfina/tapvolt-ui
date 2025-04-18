import { useCallback, useEffect, useState } from 'react';
import LNC, { taprpc } from '@lightninglabs/lnc-web';
import { Buffer }      from 'buffer';

export interface LncState {
  lnc:          LNC | null;
  isConnected:  boolean;
  isConnecting: boolean;
  isInitializing: boolean;
  assets:      taprpc.Asset[];
  batchAssets: any[];
  lncState:    any; // for context provider
  connect:     (pairingPhrase: string) => Promise<void>;
  mintAsset:   (name: string, amount: string, meta: string) => Promise<void>;
  finalizeBatch: () => Promise<void>;
  cancelBatch: () => Promise<void>;
  fundChannel: (assetId: string, amount: string, feeRate: string, peerKey: string) => Promise<void>;
}

const useLnc = (): LncState => {
  // State
  const [lnc, setLnc] = useState<LNC | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [assets, setAssets] = useState<taprpc.Asset[]>([]);
  const [batchAssets, setBatchAssets] = useState<any[]>([]);

  // Helpers (mocked for now)
  const connect = useCallback(async (pairingPhrase: string) => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
      setIsInitializing(false);
    }, 1000);
  }, []);

  const mintAsset = useCallback(async (name: string, amount: string, meta: string) => {
    setBatchAssets((prev) => [...prev, { name, amount, meta }]);
  }, []);

  const finalizeBatch = useCallback(async () => {
    setAssets((prev) => [...prev, ...batchAssets]);
    setBatchAssets([]);
  }, [batchAssets]);

  const cancelBatch = useCallback(async () => {
    setBatchAssets([]);
  }, []);

  const fundChannel = useCallback(async (assetId: string, amount: string, feeRate: string, peerKey: string) => {
    // Mock: just log
    console.log('Funding channel:', { assetId, amount, feeRate, peerKey });
  }, []);

  return {
    lnc,
    isConnected,
    isConnecting,
    isInitializing,
    assets,
    batchAssets,
    lncState: {
      lnc,
      isConnected,
      isConnecting,
      isInitializing,
      assets,
      batchAssets,
      connect,
      mintAsset,
      finalizeBatch,
      cancelBatch,
      fundChannel,
    },
    connect,
    mintAsset,
    finalizeBatch,
    cancelBatch,
    fundChannel,
  };
};

export default useLnc;
