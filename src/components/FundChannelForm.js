import React from 'react';
import FeedbackMessage from './FeedbackMessage';

const FundChannelForm = ({
  assetAmount, setAssetAmount,
  assetId, setAssetId,
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
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="assetIdFund">Asset ID (Hex)</label>
          <input id="assetIdFund" className="w-full px-3 py-2 rounded-md transition-colors duration-200 font-mono text-xs" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="text" placeholder="Paste Asset ID hex..." value={assetId} onChange={(e) => setAssetId(e.target.value)} required disabled={isFunding} />
        </div>
        <div className="mt-4 mb-6">
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="peerPubkeyFund">Peer Public Key (Hex)</label>
          <input id="peerPubkeyFund" className="w-full px-3 py-2 rounded-md transition-colors duration-200 font-mono text-xs" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="text" placeholder="Paste Peer Pubkey hex..." value={peerPubkey} onChange={(e) => setPeerPubkey(e.target.value)} required disabled={isFunding} />
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