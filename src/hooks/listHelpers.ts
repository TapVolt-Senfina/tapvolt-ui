import { useCallback } from 'react';
import { taprpc } from '@lightninglabs/lnc-web';

export function useListAssets(setAssets: (assets: taprpc.Asset[]) => void, lncRef: React.MutableRefObject<any>) {
  return useCallback(
    async (inst: any = lncRef.current) => {
      if (!inst?.tapd?.taprootAssets) return;
      console.debug('[LNC] listAssets()');
      try {
        const res = await inst.tapd.taprootAssets.listAssets({
          includeUnconfirmedMints: true,
        });
        setAssets(res.assets ?? []);
      } catch (e) {
        console.error('[LNC] listAssets():', e);
        setAssets([]);
      }
    },
    [setAssets, lncRef],
  );
}

export function useListBatches(setBatchAssets: (assets: any[]) => void, lncRef: React.MutableRefObject<any>) {
  return useCallback(
    async (inst: any = lncRef.current) => {
      if (!inst?.tapd?.mint) return;
      console.debug('[LNC] listBatches()');
      try {
        const res = await inst.tapd.mint.listBatches();
        const pending: any[] = [];
        res.batches?.forEach((b: any) => {
          if (
            ['BATCH_STATE_PENDING', 'BATCH_STATE_FROZEN', 'BATCH_STATE_COMMITTED'].includes(
              b.batch?.state ?? '',
            )
          ) {
            pending.push(...(b.batch?.assets ?? []));
          }
        });
        setBatchAssets(pending);
      } catch (e) {
        console.error('[LNC] listBatches():', e);
        setBatchAssets([]);
      }
    },
    [setBatchAssets, lncRef],
  );
}
