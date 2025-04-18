import React from 'react';
import { useDarkMode }  from '../context/DarkModeContext.tsx';
import { useLncContext } from '../context/LncContext.tsx';

const DashboardHeader: React.FC = () => {
  const { dark, toggle } = useDarkMode();
  const { lnc } = useLncContext();

  // Example: node info (mock)
  const nodeInfo = lnc ? { alias: 'MyNode', pubkey: 'abcdef123456' } : null;

  return (
    <header className="p-6 border-b border-border flex items-center justify-between bg-secondary rounded-xl mb-8">
      <div className="flex items-center space-x-4">
        <span className="text-3xl font-bold">⚡ TapVolt</span>
        {nodeInfo && (
          <span className="text-primary text-lg">{nodeInfo.alias}</span>
        )}
      </div>
      <button
        className="text-2xl focus:outline-none"
        onClick={toggle}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? '🌙' : '☀️'}
      </button>
    </header>
  );
};

export default DashboardHeader;
