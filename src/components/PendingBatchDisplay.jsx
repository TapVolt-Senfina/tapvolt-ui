import React from 'react';
import { getEnumName } from '../utils/helpers'; // Import specific helper

const PendingBatchDisplay = ({ batchAssets, isMinting, darkMode, onCancelBatch, onFinalizeBatch, taprpc }) => {
  if (!batchAssets || batchAssets.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl overflow-hidden transition-colors duration-300" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`, boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div className="p-4 border-b bg-indigo-500/5" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}>
        <h3 className="font-bold text-base text-indigo-500">Pending Mint Batch</h3>
      </div>
      <div className="p-5">
        <div className="max-h-60 overflow-y-auto pr-2 mb-4 space-y-2">
          {batchAssets.flatMap((batch, batchIndex) =>
            batch.map((asset, assetIndex) => (
              <div key={`${batchIndex}-${assetIndex}`} className="p-3 rounded-lg transition-colors duration-200" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`, boxShadow: darkMode ? '0 2px 5px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                <div className="flex justify-between items-center">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{asset.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{asset.amount} units</span>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Type: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetType, asset.assetType)}</span> |
                  Version: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetVersion, asset.assetVersion)}</span>
                </div>
                {asset.assetMeta && asset.assetMeta.startsWith('data:image') && (
                  <img src={asset.assetMeta} alt="Batch Asset Preview" className="mt-2 max-h-16 rounded border" style={{ borderColor: 'var(--border-color)' }} />
                )}
                {asset.assetMeta && !asset.assetMeta.startsWith('data:image') && <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }} title={asset.assetMeta}>Meta: {asset.assetMeta}</p>}
              </div>
            ))
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'white', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'var(--border-color)'}`, boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} onClick={onCancelBatch} disabled={isMinting}>Cancel Batch</button>
          <button className="flex-1 py-2 px-4 rounded-md font-medium text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: darkMode ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(16, 185, 129, 0.2)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} onClick={onFinalizeBatch} disabled={isMinting}>{isMinting ? 'Processing...' : 'Finalize Batch'}</button>
        </div>
      </div>
    </div>
  );
};

export default PendingBatchDisplay;