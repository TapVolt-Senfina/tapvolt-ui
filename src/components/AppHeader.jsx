import React, { useState } from 'react';
import { UsersIcon, ArrowPathIcon } from '@heroicons/react/24/outline'; // Added ArrowPathIcon

const AppHeader = ({ nodeInfo, nodeChannelsCount, assetsCount, peersCount, onShowPeers, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const headerStatItemStyle = "cursor-pointer hover:opacity-75 transition-opacity duration-150 flex items-center gap-1";

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await Promise.race([
        onRefresh(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timeout')), 10000))
      ]);
    } catch (e) {
      console.warn("Header refresh error/timeout:", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Small delay for visual feedback
    }
  };

  return (
    <header className="p-6 border-b transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <img src="/favicon.png" alt="Logo" className="w-10 h-10" />
          <div className="flex flex-col">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Senfina TapVolt</h1>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                  isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500/10'
                }`}
                style={{ color: 'var(--accent-light)', border: `1px solid var(--accent-light)` }}
              >
                <ArrowPathIcon className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Node Data'}
              </button>
            </div>
          </div>
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