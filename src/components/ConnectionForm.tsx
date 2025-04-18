import React, { useState } from 'react';
import { useDarkMode } from '../context/DarkModeContext.tsx';
import { useLncContext } from '../context/LncContext.tsx';

const ConnectionForm: React.FC = () => {
  const { dark, toggle } = useDarkMode();
  const { isConnecting, connect } = useLncContext();
  const [pairingPhrase, setPairingPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await connect(pairingPhrase);
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    }
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center gradient-bg">
      <form className="bg-white dark:bg-secondary p-8 rounded-xl shadow-md w-full max-w-md" onSubmit={handleConnect}>
        <h2 className="text-2xl font-bold mb-6 text-primary">Connect to Node</h2>
        <input
          className="w-full p-3 rounded border border-border mb-4 bg-transparent text-primary"
          type="text"
          placeholder="Pairing Phrase"
          value={pairingPhrase}
          onChange={e => setPairingPhrase(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full py-3 rounded bg-primary text-white font-bold hover:opacity-90 transition"
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting…' : 'Connect'}
        </button>

        {error && <p className="mt-4 text-red-600">{error}</p>}
      </form>
    </section>
  );
};

export default ConnectionForm;
