import React, { useState } from 'react';
import { XMarkIcon, PlusCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid'; // Added PlusCircleIcon, ArrowPathIcon

const PeersModal = ({ isOpen, onClose, peers, darkMode, lnc, onPeerAdded }) => { // Added lnc and onPeerAdded props
  const [newPeerAddr, setNewPeerAddr] = useState('');
  const [connectPeerError, setConnectPeerError] = useState(null);
  const [connectPeerSuccess, setConnectPeerSuccess] = useState(null);
  const [isConnectingPeer, setIsConnectingPeer] = useState(false);

  if (!isOpen) {
    return null;
  }

  const modalBgColor = darkMode ? 'var(--bg-card)' : 'var(--bg-secondary)';
  const textColor = darkMode ? 'var(--text-primary)' : 'var(--text-primary)';
  const borderColor = darkMode ? 'var(--border-color)' : 'var(--border-color)';
  const inputBg = darkMode ? 'var(--input-bg)' : 'var(--input-bg)';
  const itemBgHover = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const buttonBg = darkMode ? 'var(--accent-dark)' : 'var(--accent-light)';
  const buttonHoverBg = darkMode ? 'var(--accent-light)' : 'var(--accent-dark)';


  const handleAddPeer = async (e) => {
    e.preventDefault();
    setConnectPeerError(null);
    setConnectPeerSuccess(null);
    setIsConnectingPeer(true);

    if (!lnc || !lnc.lnd?.lightning) {
      setConnectPeerError("LNC or LND lightning service not initialized.");
      setIsConnectingPeer(false);
      return;
    }
    if (!newPeerAddr.trim()) {
      setConnectPeerError("Peer address cannot be empty.");
      setIsConnectingPeer(false);
      return;
    }

    const parts = newPeerAddr.trim().split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setConnectPeerError("Invalid peer address format. Expected pubkey@host:port");
      setIsConnectingPeer(false);
      return;
    }

    const [pubkey, hostWithPort] = parts;



    try {
      // ConnectPeerRequest expects addr: { pubkey: string, host: string }, perm: boolean
      const request = {
        addr: {
          pubkey: pubkey,
          host: hostWithPort,
        },
        // timeout: '10s' // Optional: a string like "10s", "1m"
      };
      await lnc.lnd.lightning.connectPeer(request);
      setConnectPeerSuccess(`Successfully initiated connection to ${newPeerAddr}.`);
      setNewPeerAddr('');
      if (onPeerAdded) {
        onPeerAdded(); // Callback to refresh the peers list in the parent
      }
    } catch (error) {
      console.error("Failed to connect to peer:", error);
      setConnectPeerError(error.message || "Failed to connect to peer. Check the address and node logs.");
    } finally {
      setIsConnectingPeer(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-300 ease-in-out"
      onClick={onClose}
    >
      <div
        className="relative rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" // Changed max-h, added flex flex-col
        style={{ backgroundColor: modalBgColor, color: textColor, border: `1px solid ${borderColor}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b" style={{ borderColor }}>
          <h3 className="text-xl font-semibold">Connected Peers</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-opacity-20 transition-colors"
            style={{ color: 'var(--text-secondary)', backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
            aria-label="Close modal"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Add Peer Form */}
        <form onSubmit={handleAddPeer} className="mb-6 p-4 rounded-md" style={{ backgroundColor: 'var(--bg-primary)', border: `1px solid ${borderColor}` }}>
          <h4 className="text-md font-semibold mb-3">Add New Peer</h4>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-grow">
              <label htmlFor="peerAddr" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Peer Address (pubkey@host:port)
              </label>
              <input
                type="text"
                id="peerAddr"
                value={newPeerAddr}
                onChange={(e) => setNewPeerAddr(e.target.value)}
                placeholder="02xxxx...@127.0.0.1:9735"
                className="w-full px-3 py-2 rounded-md shadow-sm focus:ring-1 focus:outline-none"
                style={{
                  backgroundColor: inputBg,
                  color: textColor,
                  border: `1px solid ${borderColor}`,
                  borderColor: connectPeerError ? 'var(--error-text)' : (darkMode ? 'var(--border-color)' : 'var(--border-color)'),
                  // ringColor: 'var(--accent-light)' // Tailwind doesn't easily support dynamic ring colors via style prop
                }}
                disabled={isConnectingPeer}
              />
            </div>
            <button
              type="submit"
              disabled={isConnectingPeer}
              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: isConnectingPeer ? (darkMode ? '#555' : '#ccc') : buttonBg,
                cursor: isConnectingPeer ? 'not-allowed' : 'pointer',
                // ringColor: buttonBg, // Tailwind doesn't easily support dynamic ring colors via style prop
                // offsetColor: darkMode ? 'var(--bg-card)' : 'var(--bg-secondary)'
              }}
              onMouseOver={e => !isConnectingPeer && (e.currentTarget.style.backgroundColor = buttonHoverBg)}
              onMouseOut={e => !isConnectingPeer && (e.currentTarget.style.backgroundColor = buttonBg)}
            >
              {isConnectingPeer ? (
                <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
              ) : (
                <PlusCircleIcon className="h-5 w-5 mr-2" />
              )}
              {isConnectingPeer ? 'Connecting...' : 'Add Peer'}
            </button>
          </div>
          {connectPeerError && (
            <p className="mt-2 text-sm" style={{ color: 'var(--error-text)' }}>Error: {connectPeerError}</p>
          )}
          {connectPeerSuccess && (
            <p className="mt-2 text-sm" style={{ color: 'var(--success-text)' }}>{connectPeerSuccess}</p>
          )}
        </form>

        {/* Peers List */}
        <div className="overflow-y-auto flex-grow"> {/* Added flex-grow for scrolling */}
          {peers && peers.length > 0 ? (
            <div className="space-y-3">
              {peers.map((peer, index) => (
                <div
                  key={peer.pub_key || index}
                  className="p-4 rounded-md transition-colors duration-150"
                  style={{ border: `1px solid ${borderColor}`, backgroundColor: 'var(--bg-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = itemBgHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                >
                  <p className="font-mono text-sm break-all">
                    <strong>Pubkey:</strong> {peer.pub_key}
                  </p>
                  <p className="text-sm">
                    <strong>Address:</strong> {peer.address}
                  </p>
                  {/* ... other peer details ... */}
                  <p className="text-sm">
                    <strong>Bytes Sent:</strong> {peer.bytes_sent?.toString()}
                  </p>
                  <p className="text-sm">
                    <strong>Bytes Recv:</strong> {peer.bytes_recv?.toString()}
                  </p>
                  <p className="text-sm">
                    <strong>Inbound:</strong> {peer.inbound ? 'Yes' : 'No'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No peers connected or data unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeersModal;