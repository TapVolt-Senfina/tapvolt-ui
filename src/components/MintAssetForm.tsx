import React, { useState } from 'react';
import { Buffer } from 'buffer';
import { useLncContext } from '../context/LncContext.tsx';

const MintAssetForm: React.FC = () => {
  const { mintAsset } = useLncContext();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [meta, setMeta] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    try {
      await mintAsset(name, amount, meta);
      setSuccess(true);
      setName('');
      setAmount('');
      setMeta('');
    } catch (err: any) {
      setError(err.message || 'Minting failed');
    }
  };

  return (
    <form className="p-6 bg-secondary rounded-xl shadow space-y-4" onSubmit={onSubmit}>
      <h3 className="text-xl font-bold mb-2">Mint New Asset</h3>
      <input
        className="w-full p-3 rounded border border-border bg-transparent text-primary"
        type="text"
        placeholder="Asset Name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
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
        type="text"
        placeholder="Metadata (optional)"
        value={meta}
        onChange={e => setMeta(e.target.value)}
      />
      <button className="w-full py-3 rounded bg-primary text-white font-bold hover:opacity-90 transition" type="submit">
        Mint Asset
      </button>
      {success && <p className="text-green-600">Asset added to batch!</p>}
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
};

export default MintAssetForm;
