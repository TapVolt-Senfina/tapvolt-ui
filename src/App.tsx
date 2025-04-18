// ────────────────────────────────────────────────
// File: src/App.tsx
// Root app: stitches everything together
// ────────────────────────────────────────────────
import React from 'react';
import './styles.css';                    // your tailwind / css‑vars
import { DarkModeProvider } from './context/DarkModeContext.tsx';
import { LncProvider }      from './context/LncContext.tsx';

import LoadingScreen    from './components/LoadingScreen.tsx';
import ConnectionForm   from './components/ConnectionForm.tsx';
import DashboardHeader  from './components/DashboardHeader.tsx';
import MintAssetForm    from './components/MintAssetForm.tsx';
import PendingBatch     from './components/PendingBatch.tsx';
import AssetList        from './components/AssetList.tsx';
import FundChannelForm  from './components/FundChannelForm.tsx';

import useLnc from './hooks/useLnc.ts';
import { useDarkMode } from './context/DarkModeContext.tsx';
import ReactDOM from 'react-dom';

const DarkModeToggle: React.FC = () => {
  const { dark, toggle } = useDarkMode();
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode">
      {dark ? '🌙' : '☀️'}
    </button>
  );
};

const App: React.FC = () => {
  const {
    isInitializing, isConnecting, isConnected,
    batchAssets, assets, lncState,   // <- whatever you expose
  } = useLnc();                       // global connection state

  if (isInitializing || isConnecting) return <LoadingScreen />;

  return (
    <DarkModeProvider>
      <DarkModeToggle />
      <LncProvider value={lncState}>
        {isConnected ? (
          <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-primary text-primary">
            <DashboardHeader />
            <section className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-8">
                <MintAssetForm />
                {batchAssets.length > 0 && <PendingBatch />}
              </div>

              <div className="space-y-8">
                <AssetList assets={assets} />
                {assets.length > 0 && <FundChannelForm />}
              </div>
            </section>
          </main>
        ) : (
          <ConnectionForm />
        )}
      </LncProvider>
    </DarkModeProvider>
  );
};

export default App;
