import React from 'react';

const ChannelAssetsList = ({ channelAssets, darkMode }) => {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
        Assets In Channels
      </h2>
      {Array.isArray(channelAssets) && channelAssets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 max-h-[420px] overflow-y-auto pr-2">
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
        <p style={{ color: 'var(--text-secondary)' }}>
          No Taproot assets currently detected in channels.
        </p>
      )}
    </section>
  );
};

export default ChannelAssetsList;
