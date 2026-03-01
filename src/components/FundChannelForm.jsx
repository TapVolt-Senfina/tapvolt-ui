import React from 'react';
import FeedbackMessage from './FeedbackMessage';

const FundChannelForm = ({
  assetAmount, setAssetAmount,
  assetId, setAssetId,
  assets,
  peers,onShowPeers,
  peerPubkey, setPeerPubkey,
  feeRateSatPerVbyte, setFeeRateSatPerVbyte,
  isFunding,
  fundChannelError,
  fundChannelSuccess,
  darkMode,
  onSubmit
}) => {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Fund Asset Channel</h2>
      <form onSubmit={onSubmit} className="rounded-xl p-6 transition-colors duration-300" style={{ backgroundColor: 'var(--form-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="mb-4 sm:mb-0">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="assetAmountFund">Asset Amount</label>
            <input id="assetAmountFund" className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="number" placeholder="e.g., 100" value={assetAmount} onChange={(e) => setAssetAmount(e.target.value)} required disabled={isFunding} />
          </div>
          <div className="mb-4 sm:mb-0">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="feeRateSatPerVbyteFund">Fee Rate (sat/vB)</label>
            <input id="feeRateSatPerVbyteFund" className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="number" placeholder="e.g., 10" value={feeRateSatPerVbyte} onChange={(e) => setFeeRateSatPerVbyte(e.target.value)} required disabled={isFunding} min="1" />
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="assetIdFund">Asset</label>
          <select
            id="assetIdFund"
            className="w-full px-3 py-2 rounded-md transition-colors duration-200"
            style={{ 
              backgroundColor: 'var(--input-bg)', 
              color: 'var(--text-primary)', 
              border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              // Ensures the dropdown arrow is visible in dark mode
              backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="${darkMode ? 'white' : 'black'}" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1.5em 1.5em',
              appearance: 'none',
              paddingRight: '2.5rem',
            }}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            required
            disabled={isFunding || !assets || assets.length === 0}
          >
            <option value="" disabled>Select an owned asset...</option>
            {assets && assets.map((asset) => (
              <option 
                key={asset.assetGenesis.assetIdStr || asset.assetGenesis.assetId} 
                value={asset.assetGenesis.assetIdStr}
              >
                {`${asset.assetGenesis.name} (Amount: ${asset.amount})`}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mt-4 mb-6">
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="peerPubkeyFund">Peer</label>
          {peers && peers.length > 0 ? (
            <select
              id="peerPubkeyFund"
              className="w-full px-3 py-2 rounded-md transition-colors duration-200 font-mono text-xs"
              style={{
                backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)',
                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="${darkMode ? 'white' : 'black'}" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5em 1.5em',
                appearance: 'none', paddingRight: '2.5rem',
              }}
              value={peerPubkey} onChange={(e) => setPeerPubkey(e.target.value)} required disabled={isFunding}
            >
              <option value="" disabled>Select a connected peer...</option>
              {peers.map(peer => (
                <option key={peer.pubKey} value={peer.pubKey}>
                  {`${peer.pubKey.substring(0, 20)}... (${peer.address})`}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-center p-4 rounded-md" style={{ backgroundColor: 'var(--input-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>You don't have any connected peers.</p>
              <button
                type="button"
                onClick={onShowPeers}
                className="py-2 px-4 rounded-md font-medium text-white transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #3730a3)', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}
              >
                Add Peer
              </button>
            </div>
          )}
        </div>

        <button className="w-full py-2 px-4 rounded-md font-medium text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: darkMode ? '0 4px 12px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(59, 130, 246, 0.2)', opacity: isFunding ? '0.7' : '1', cursor: isFunding ? 'not-allowed' : 'pointer' }} type="submit" disabled={isFunding}>
          {isFunding ? 'Initiating Funding...' : 'Fund Channel'}
        </button>
        <FeedbackMessage type="error" message={fundChannelError} darkMode={darkMode} />
        <FeedbackMessage type="success" message={fundChannelSuccess} darkMode={darkMode} />
      </form>
    </section>
  );
};

export default FundChannelForm;