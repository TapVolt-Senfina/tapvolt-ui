import React from 'react';
import { taprpc } from '@lightninglabs/lnc-web';

interface Props { assets: taprpc.Asset[] }
const AssetList: React.FC<Props> = ({ assets }) => {
  if (!assets.length) return (
    <article className="p-6 bg-secondary rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-5">Owned Assets</h2>
      <p className="text-secondary">No assets found.</p>
    </article>
  );

  return (
    <article className="p-6 bg-secondary rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-5">Owned Assets</h2>
      <div className="grid gap-4">
        {assets.map((asset, idx) => (
          <div key={idx} className="p-4 border border-border rounded bg-white/80 dark:bg-secondary">
            <div className="font-bold text-primary">{asset.name || asset.assetName || 'Unnamed Asset'}</div>
            <div className="text-secondary">Amount: {asset.amount || asset.assetAmount || 'N/A'}</div>
            {/* Add more asset fields as needed */}
          </div>
        ))}
      </div>
    </article>
  );
};

export default AssetList;
