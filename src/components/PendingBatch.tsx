import React from 'react';
import { useLncContext } from '../context/LncContext.tsx';

const PendingBatch: React.FC = () => {
  const { batchAssets, finalizeBatch, cancelBatch } = useLncContext();

  if (batchAssets.length === 0) return null;

  return (
    <div className="rounded-xl p-6 bg-batch">
      <h3 className="text-xl font-bold mb-4">Pending Batch</h3>
      <ul className="mb-4 space-y-2">
        {batchAssets.map((asset: any, idx: number) => (
          <li key={idx} className="flex justify-between items-center bg-white/80 dark:bg-secondary p-2 rounded">
            <span>{asset.name} ({asset.amount})</span>
            {asset.meta && <span className="text-xs text-secondary ml-2">{asset.meta}</span>}
          </li>
        ))}
      </ul>
      <div className="flex space-x-4">
        <button
          className="px-4 py-2 rounded bg-green-500 text-white font-bold hover:bg-green-600"
          onClick={finalizeBatch}
        >Finalize</button>
        <button
          className="px-4 py-2 rounded bg-red-500 text-white font-bold hover:bg-red-600"
          onClick={cancelBatch}
        >Cancel</button>
      </div>
    </div>
  );
};

export default PendingBatch;
