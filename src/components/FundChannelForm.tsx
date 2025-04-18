import React, { useState } from 'react';
import { useLncContext } from '../context/LncContext.tsx';

const FundChannelForm: React.FC = () => {
  const { fundChannel, assets } = useLncContext();
  const [assetId, setAssetId] = useState('');
  const [amount, setAmount] = useState('');
  const [feeRate, setFeeRate] = useState('');
  const [peerKey, setPeerKey] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    try {
      await fundChannel(assetId, amount, feeRate, peerKey);
      setSuccess(true);
      setAssetId('');
      setAmount('');
      setFeeRate('');
      setPeerKey('');
    } catch (err: any) {
      setError(err.message || 'Funding failed');
    }
  };

  return (
    <form className="p-6 bg-secondary rounded-xl shadow space-y-4" onSubmit={onSubmit}>
      <h3 className="text-xl font-bold mb-2">Fund Channel</h3>
      <select
        className="w-full p-3 rounded border border-border bg-transparent text-primary"
        value={assetId}
        onChange={e => setAssetId(e.target.value)}
        required
      >
        <option value="">Select Asset</option>
        {assets.map((asset: any, idx: number) => (
          <option key={idx} value={asset.id || asset.assetId}>
            {asset.name || asset.assetName || 'Unnamed'}
          </option>
        ))}
      </select>
      <input
        className="w-full p-3 rounded border border-border bg-transparent text-primary"
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        required
        min="1"
      />
      <input
        className="w-full p-3 rounded border border-border bg-transparent text-primary"
        type="number"
        placeholder="Fee Rate (sat/vB)"
        value={feeRate}
        onChange={e => setFeeRate(e.target.value)}
        required
        min="1"
      />
      <input
        className="w-full p-3 rounded border border-border bg-transparent text-primary"
        type="text"
        placeholder="Peer Public Key"
        value={peerKey}
        onChange={e => setPeerKey(e.target.value)}
        required
      />
      <button className="w-full py-3 rounded bg-primary text-white font-bold hover:opacity-90 transition" type="submit">
        Fund Channel
      </button>
      {success && <p className="text-green-600">Channel funding initiated!</p>}
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
};

export default FundChannelForm;
