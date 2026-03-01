import React from 'react';
import { UsersIcon } from '@heroicons/react/24/outline'; // Or any other icon you prefer

const AppHeader = ({ nodeInfo, nodeChannelsCount, assetsCount, peersCount, onShowPeers }) => { // Added onShowPeers prop
  const headerStatItemStyle = "cursor-pointer hover:opacity-75 transition-opacity duration-150 flex items-center gap-1";

  return (
    <header className="p-6 border-b transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <img src="/favicon.png" alt="Logo" className="w-10 h-10" /> {/* Ensure favicon.png is in your public folder */}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Senfina TapVolt</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div>Alias: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeInfo?.alias || '...'}</span></div>
          <div>Height: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeInfo?.blockHeight || '...'}</span></div>
          <div>
            Synced: <span className="font-medium" style={{ color: nodeInfo?.syncedToChain ? 'var(--success-text)' : 'var(--error-text)' }}>
              {typeof nodeInfo?.syncedToChain === 'boolean' ? (nodeInfo.syncedToChain ? 'Yes' : 'No') : '...'}
            </span>
          </div>
          <div>Channels: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeChannelsCount ?? '...'}</span></div>
          <div>Assets: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{assetsCount ?? '...'}</span></div>

          {/* Clickable Peers Stat */}
          <div
            onClick={onShowPeers} // Call onShowPeers when this div is clicked
            className={headerStatItemStyle}
            role="button" // For accessibility
            tabIndex={0} // Make it focusable
          >
            <UsersIcon className="h-4 w-4 inline-block" style={{ color: 'var(--text-primary)'}} />
            Peers: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{peersCount ?? '...'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;