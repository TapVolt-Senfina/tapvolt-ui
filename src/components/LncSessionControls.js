import React from 'react';

/**
 * LncSessionControls - UI for session logout and troubleshooting
 * Props:
 *   lncState: the useLnc() state object (must include logout, isConnected, isInitializing)
 */
export default function LncSessionControls({ lncState }) {
  return (
    <div className="flex flex-col gap-2 items-center my-6">
      {lncState.isConnected && (
        <button
          className="py-2 px-4 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition"
          onClick={lncState.logout}
        >
          Log out & Forget Session
        </button>
      )}
      {!lncState.isConnected && !lncState.isInitializing && (
        <p className="text-xs text-gray-500">Paste a new pairing phrase to reconnect.</p>
      )}
    </div>
  );
}
