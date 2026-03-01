import React from 'react';
import { getEnumName } from '../utils/helpers'; // Import specific helper

const OwnedAssetsList = ({ assets, darkMode, taprpc }) => {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Owned Assets</h2>
      {assets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2">
          {assets.map((item, index) => {
            const typeNum = item.assetGenesis.assetType; // This is numeric or string from API? Assuming numeric for getEnumName
            const typeName = getEnumName(taprpc?.AssetType, typeNum);
            const ver = getEnumName(taprpc?.AssetVersion, item.assetGenesis?.version ?? item.version);
            const id = item.assetGenesis?.assetIdStr || item.assetGenesis?.assetId || 'N/A';
            return (
              <div key={index} className="rounded-lg p-4 transition-all duration-300 transform hover:scale-[1.01]" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`, boxShadow: darkMode ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                <p className="font-semibold mb-2 truncate" style={{ color: 'var(--text-primary)' }} title={item.assetGenesis?.name}>{item.assetGenesis?.name || 'Unnamed Asset'}</p>
                <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>Amount: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.amount?.toString() || 'N/A'}</span></p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>Type: {typeName}</span>
                    <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>Version: {ver}</span>
                  </div>
                  <p className="text-xs break-all pt-1" title={id}>ID: <span style={{ fontFamily: 'monospace' }}>{id}</span></p>
                  <p className="text-xs break-all">Genesis Pt: {item.assetGenesis?.genesisPoint || 'N/A'}</p>
                  <p className="text-xs">Anchor Height: <span style={{ fontFamily: 'monospace' }}>{item.chainAnchor?.blockHeight || 'Unconfirmed'}</span></p>
                </div>
                {/* This logic for COLLECTIBLE is based on the typeName string from getEnumName */}
                {typeName === 'COLLECTIBLE' && item.decodedMeta && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Decoded Metadata</p>
                    {item.decodedMeta.startsWith('data:image') ?
                      <img src={item.decodedMeta} alt="Asset Preview" className="max-w-full h-auto rounded border" style={{ borderColor: 'var(--border-color)' }} onError={(e) => { e.target.style.display='none'; const nextEl = e.target.nextElementSibling; if (nextEl && nextEl.tagName === 'PRE') nextEl.style.display='block'; }}/>
                      : null
                    }
                    <pre className="text-xs p-2 rounded overflow-auto max-h-28 border" style={{ display: (item.decodedMeta.startsWith('data:image')) ? 'none' : 'block', backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                      {item.decodedMeta.length > 200 ? item.decodedMeta.substring(0,200) + "..." : item.decodedMeta}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>No assets found or still loading...</p>
      )}
    </section>
  );
};

export default OwnedAssetsList;