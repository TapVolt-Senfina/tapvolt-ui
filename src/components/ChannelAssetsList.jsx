import React from 'react';

const ChannelAssetsList = ({ channelAssets, darkMode }) => {
  return (
    <div className="rounded-xl overflow-hidden transition-colors duration-300 flex flex-col h-[500px]" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`, boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div className="p-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}>
        <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Assets In Channels</h3>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-500">{Array.isArray(channelAssets) ? channelAssets.length : 0} Assets</span>
      </div>
      <div className="p-5 overflow-y-auto flex-1">
        {Array.isArray(channelAssets) && channelAssets.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {channelAssets.map((item) => (
              <div
                key={item.assetIdHex}
                className="rounded-lg p-4 transition-all duration-300"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`,
                  boxShadow: darkMode ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <p className="font-semibold mb-2 truncate" style={{ color: 'var(--text-primary)' }} title={item.name}>
                  {item.name || 'Unknown Asset'}
                </p>
                <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>Local Balance: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.localBalance}</span></p>
                  <p>Remote Balance: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.remoteBalance}</span></p>
                  <p>Total In Channels: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.totalInChannels}</span></p>
                  <p>Channels: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.channelsCount}</span></p>
                  <p className="text-xs break-all pt-1" title={item.assetIdHex}>
                    ID: <span style={{ fontFamily: 'monospace' }}>{item.assetIdHex}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            <p>No Taproot assets currently detected in channels.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelAssetsList;
