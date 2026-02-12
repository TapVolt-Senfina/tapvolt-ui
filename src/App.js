import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Buffer } from 'buffer';
import LNC, { taprpc } from '@lightninglabs/lnc-web';

// Constants and Helpers
import { ASSET_TYPE_COLLECTIBLE_NUM, ASSET_VERSION_V0_NUM, META_TYPE_OPAQUE_NUM, ASSET_TYPE_NORMAL_NUM } from './utils/constants';
// getEnumName is imported by components that need it directly from utils/helpers

// Components
import LoadingSpinner from './components/LoadingSpinner';
import ConnectScreen from './components/ConnectScreen';
import AppHeader from './components/AppHeader';
import DarkModeToggle from './components/DarkModeToggle';
import MintAssetForm from './components/MintAssetForm';
import PendingBatchDisplay from './components/PendingBatchDisplay';
import OwnedAssetsList from './components/OwnedAssetsList';
import FundChannelForm from './components/FundChannelForm';
import PeersModal from './components/PeersModal';

function App() {
  // LNC & Node State
  const [lnc, setLNC] = useState(null);
  const [isPaired, setIsPaired] = useState(() => {
    try {
      const lncInstance = new LNC({});
      return Boolean(lncInstance?.credentials?.isPaired);
    } catch (error) {
      console.error('Failed to read LNC pairing state:', error);
      return false;
    }
  });
  const [assets, setAssets] = useState([]);
  const [batchAssets, setBatchAssets] = useState([]);
  const [nodeChannels, setChannels] = useState([]);
  const [nodeInfo, setNodeInfo] = useState(null);

  // Connection Form State
  const [pairingPhrase, setPairingPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Mint Asset Form State
  const [mintAssetName, setMintAssetName] = useState('');
  const [mintAssetAmount, setMintAssetAmount] = useState('');
  const [mintAssetType, setMintAssetType] = useState('NORMAL');
  const [mintAssetFile, setMintAssetFile] = useState(null);
  const [mintAssetFilePreview, setMintAssetFilePreview] = useState(null);
  const [mintAssetMeta, setMintAssetMeta] = useState('');
  const [mintAssetError, setMintAssetError] = useState(null);
  const [mintAssetSuccess, setMintAssetSuccess] = useState(null);
  const [isMinting, setIsMinting] = useState(false);

  // Peers
  const [nodePeers,setNodePeers] = useState();

  // Fund Channel Form State
  const [assetAmount, setAssetAmount] = useState('');
  const [assetId, setAssetId] = useState('');
  const [peerPubkey, setPeerPubkey] = useState('');
  const [feeRateSatPerVbyte, setFeeRateSatPerVbyte] = useState('');
  const [fundChannelError, setFundChannelError] = useState(null);
  const [fundChannelSuccess, setFundChannelSuccess] = useState(null);
  const [isFunding, setIsFunding] = useState(false);
  const [isPeersModalOpen, setIsPeersModalOpen] = useState(false);

  // UI State
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    const root = document.documentElement;
    const colors = darkMode
      ? {
          '--bg-primary': '#121212', '--bg-secondary': '#1e1e1e', '--bg-card': '#252525',
          '--text-primary': '#e0e0e0', '--text-secondary': '#a0a0a0', '--border-color': '#333333',
          '--accent-light': '#4f46e5', '--accent-dark': '#3730a3', '--success-bg': '#064e3b',
          '--success-text': '#10b981', '--error-bg': '#7f1d1d', '--error-text': '#f87171',
          '--form-bg': '#1f1f1f', '--batch-bg': '#172554', '--batch-border': '#1e3a8a',
          '--input-bg': '#2a2a2a', '--badge-bg': '#333333',
          // Added from your original file input style for consistency
          '--file-bg': 'rgba(255,255,255,0.1)',
          '--file-hover-bg': 'rgba(255,255,255,0.2)',
          '--file-text': 'var(--text-primary)', // Assuming file text color matches primary text
        }
      : {
          '--bg-primary': '#f9fafb', '--bg-secondary': '#ffffff', '--bg-card': '#ffffff',
          '--text-primary': '#1f2937', '--text-secondary': '#6b7280', '--border-color': '#e5e7eb',
          '--accent-light': '#4f46e5', '--accent-dark': '#3730a3', '--success-bg': '#ecfdf5',
          '--success-text': '#047857', '--error-bg': '#fef2f2', '--error-text': '#b91c1c',
          '--form-bg': '#f8fafc', '--batch-bg': '#eff6ff', '--batch-border': '#bfdbfe',
          '--input-bg': '#ffffff', '--badge-bg': '#f3f4f6',
          // Added from your original file input style for consistency
          '--file-bg': '#f0f0f0',
          '--file-hover-bg': '#e0e0e0',
          '--file-text': 'var(--text-primary)',
        };
    Object.entries(colors).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [darkMode]);

  const handleConnect = async (event) => {
    event.preventDefault();
    setConnectionError(null);
    setIsConnecting(true);
    try {
      if (!LNC) { throw new Error("LNC constructor not available."); }

      const trimmedPairingPhrase = pairingPhrase.trim();
      const trimmedPassword = password.trim();
      if (!trimmedPairingPhrase) {
        throw new Error('Pairing phrase is required.');
      }
      if (!trimmedPassword) {
        throw new Error('Password is required.');
      }

      const lncInstance = new LNC({});
      lncInstance.credentials.pairingPhrase = trimmedPairingPhrase;
      await lncInstance.connect();
      // Verify node connectivity before persisting encrypted credentials.
      await lncInstance.lnd.lightning.listChannels();
      lncInstance.credentials.password = trimmedPassword;

      setLNC(lncInstance);
      setIsPaired(Boolean(lncInstance?.credentials?.isPaired));
      setPairingPhrase('');
      setPassword('');
    } catch (error) {
      console.error('LNC connection error:', error);
      setConnectionError(error.message || 'Failed to connect. Check phrase/proxy.');
      setLNC(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setConnectionError(null);
    setIsConnecting(true);
    try {
      if (!LNC) { throw new Error("LNC constructor not available."); }
      const trimmedPassword = password.trim();
      if (!trimmedPassword) {
        throw new Error('Password is required.');
      }

      const lncInstance = new LNC({});
      if (!lncInstance?.credentials?.isPaired) {
        throw new Error('No paired credentials found. Connect your node first.');
      }

      lncInstance.credentials.password = trimmedPassword;
      await lncInstance.connect();

      setLNC(lncInstance);
      setIsPaired(Boolean(lncInstance?.credentials?.isPaired));
      setPassword('');
    } catch (error) {
      console.error('LNC login error:', error);
      setConnectionError(error.message || 'Failed to login. Check password.');
      setLNC(null);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const getInfo = useCallback(async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for getInfo"); return; }
    try { const info = await lnc.lnd.lightning.getInfo(); setNodeInfo(info); }
    catch(error) { console.error("Failed to get node info:", error); setNodeInfo(null); }
  }, [lnc]);

  const listChannels = useCallback(async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for listChannels"); return; }
    try { const r = await lnc.lnd.lightning.listChannels(); setChannels(Array.isArray(r?.channels) ? r.channels : []); }
    catch (error) { console.error("Failed to list channels:", error); setChannels([]); }
  }, [lnc]);

  const listPeers = useCallback(async () => {
    if (!lnc || !lnc.lnd?.lightning) {
      console.error("LNC or LND lightning service not initialized for listPeers");
      return;
    }
    try {
      const response = await lnc.lnd.lightning.listPeers();
      console.log(response)
      setNodePeers(Array.isArray(response?.peers) ? response.peers : []);
    } catch (error) {
      console.error("Failed to list peers:", error);
      setNodePeers([]);
    }
  }, [lnc]);

  const listAssets = useCallback(async () => {
    if (!lnc || !lnc.tapd?.taprootAssets) { console.error("LNC or Taproot Assets service not initialized for listAssets"); return; }
    const { taprootAssets } = lnc.tapd;
    try {
      const assetsTap = await taprootAssets.listAssets({ include_unconfirmed_mints: true });
      let assetsArr = [];
      if (assetsTap && Array.isArray(assetsTap.assets)) {
        for (let asset of assetsTap.assets) {
          // Using direct string comparison as in your provided code.
          // Ensure API returns assetType as "COLLECTIBLE" string if it's a collectible.
          const assetTypeFromApi = asset?.assetGenesis?.assetType;
          const assetIdForMeta = asset?.assetGenesis?.assetId; // Using assetId (bytes) as per your code

          if (assetTypeFromApi === "COLLECTIBLE" && assetIdForMeta) { // Direct string comparison
            try {
              // Passing asset_id (bytes) as per your original listAssets
              const meta = await taprootAssets.fetchAssetMeta({ asset_id: assetIdForMeta });
              // Assuming meta.type is also a string "META_TYPE_OPAQUE"
              if (meta && meta.data && meta.type === "META_TYPE_OPAQUE") {
                const decodedMeta = Buffer.from(meta.data, 'base64').toString('utf8');
                assetsArr.push({ ...asset, decodedMeta });
              } else { assetsArr.push(asset); }
            } catch (metaError) { console.error(`Failed fetch meta ${Buffer.from(assetIdForMeta).toString('hex')}:`, metaError); assetsArr.push(asset); }
          } else { assetsArr.push(asset); }
        }
      }
      setAssets(assetsArr);
    } catch (error) { console.error("Failed to list assets:", error); setAssets([]); }
  }, [lnc]);

  const listBatches = useCallback(async () => {
    if (!lnc || !lnc.tapd?.mint) { console.error("LNC or Taproot Mint service not initialized for listBatches."); return; }
    const { mint } = lnc.tapd;
    try {
      const assetsBatch = await mint.listBatches();
      let formattedAssetsArray = [];
      if (assetsBatch && Array.isArray(assetsBatch.batches)) {
        for (let batch of assetsBatch.batches) {
          if (batch?.batch?.state === "BATCH_STATE_PENDING") { // Direct string comparison
            const formattedAssets = batch.batch.assets.map(assetItem => ({ // Renamed asset to assetItem to avoid conflict
              name: assetItem.name,
              amount: assetItem.amount?.toString(),
              assetVersion: assetItem.assetVersion,
              assetType: assetItem.assetType, // This should be numeric if used with getEnumName
              assetMeta: assetItem.assetMeta?.data ? Buffer.from(assetItem.assetMeta.data, 'base64').toString('utf8') : '',
            }));
            formattedAssetsArray.push(formattedAssets);
          }
        }
      }
      setBatchAssets(formattedAssetsArray);
    } catch (error) { console.error("Failed to list batches:", error); setBatchAssets([]); }
  }, [lnc]);

  useEffect(() => {
    if (lnc && lnc.isConnected) {
      console.log('LNC ready, fetching node data...');
      getInfo();
      listChannels();
      listAssets();
      listBatches();
      listPeers();
    } else {
      setNodeInfo(null); 
      setChannels([]); 
      setAssets([]); 
      setBatchAssets([]);
      setNodePeers([]);
    }
  }, [lnc, getInfo, listChannels, listAssets, listBatches,listPeers]); // Added useCallback dependencies

  // Mint Asset Form Handlers
  const handleAssetTypeChange = (e) => {
    const newType = e.target.value;
    setMintAssetType(newType);
    if (newType === 'NORMAL') {
      setMintAssetFile(null);
      setMintAssetFilePreview(null);
    } else { // COLLECTIBLE
      setMintAssetMeta('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMintAssetError("File size exceeds 5MB limit.");
        setMintAssetFile(null);
        setMintAssetFilePreview(null);
        e.target.value = null;
        return;
      }
      setMintAssetFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMintAssetFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setMintAssetError(null);
    } else {
      setMintAssetFile(null);
      setMintAssetFilePreview(null);
    }
  };
  
  const handleMintAssetSubmit = async (event) => {
    event.preventDefault();
    setMintAssetError(null); setMintAssetSuccess(null); setIsMinting(true);
    // setMintAssetFilePreview(null); // Already cleared by handleAssetTypeChange or if no file selected

    if (!lnc || !lnc.tapd?.mint) {
        setMintAssetError("LNC or Taproot Mint service not initialized.");
        setIsMinting(false); return;
    }

    const sanitizedName = mintAssetName.replace(/[\r\n]+/g, '').trim();
    if (!sanitizedName) {
        setMintAssetError("Asset name cannot be empty.");
        setIsMinting(false); return;
    }

    const amount = parseInt(mintAssetAmount, 10);
    if (isNaN(amount) || amount <= 0) {
        setMintAssetError("Invalid amount. Must be a positive number.");
        setIsMinting(false); return;
    }

    const currentAssetTypeNum = mintAssetType === 'COLLECTIBLE' ? ASSET_TYPE_COLLECTIBLE_NUM : ASSET_TYPE_NORMAL_NUM;
    let metaContentForEncoding = "";

    if (mintAssetType === 'COLLECTIBLE' && mintAssetFile) {
        try {
            metaContentForEncoding = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(mintAssetFile);
            });
        } catch (fileError) {
            setMintAssetError("Failed to read image file for metadata.");
            setIsMinting(false); return;
        }
    } else if (mintAssetType === 'NORMAL') {
        const trimmedMeta = mintAssetMeta.trim();
        if (trimmedMeta) metaContentForEncoding = trimmedMeta.replace(/[\r\n]+/g, '');
    }

    let finalMetaBase64 = "";
    if (metaContentForEncoding) {
        try {
            finalMetaBase64 = Buffer.from(metaContentForEncoding, 'utf8').toString('base64');
        } catch (bufferError) {
            setMintAssetError("Failed to encode metadata content.");
            setIsMinting(false); return;
        }
    }

    try {
        const { mint } = lnc.tapd;
        const request = {
            asset: {
                asset_version: ASSET_VERSION_V0_NUM, // Numeric
                asset_type: currentAssetTypeNum,    // Numeric
                name: sanitizedName,
                amount: amount.toString(),
                asset_meta: { data: finalMetaBase64, type: META_TYPE_OPAQUE_NUM } // Numeric
            },
            short_response: false,
        };
        const response = await mint.mintAsset(request);
        if (response?.pendingBatch?.batchKey) {
            const batchKeyHex = Buffer.from(response.pendingBatch.batchKey).toString('hex');
            setMintAssetSuccess(<>Asset minting initiated. Batch key: <div style={{overflowX: "auto"}}>{batchKeyHex}</div></>);
            setMintAssetName(''); setMintAssetAmount(''); setMintAssetMeta('');
            setMintAssetType('NORMAL'); setMintAssetFile(null); setMintAssetFilePreview(null);
            listBatches();
        } else {
            setMintAssetError(`Failed to initiate asset minting. ${response?.error || 'Unexpected response'}`);
        }
    } catch (error) {
        setMintAssetError(`Minting failed: ${error.message || 'Unknown error'}`);
    } finally {
        setIsMinting(false);
    }
  };

  const handleFinalizeBatch = async () => {
    if (!lnc || !lnc.tapd?.mint) { setMintAssetError("LNC or Taproot Mint service not initialized."); return; }
    setIsMinting(true); setMintAssetError(null); setMintAssetSuccess(null);
    try {
      const { mint } = lnc.tapd;
      const feeRate = 253;
      const batchResponse = await mint.finalizeBatch({ fee_rate: feeRate });
      setMintAssetSuccess(`Batch finalize initiated. TXID: ${batchResponse?.batch?.batchTxid || 'N/A'}`);
      await listBatches(); await listAssets();
    } catch (error) {
        setMintAssetError(`Finalize failed: ${error.message || 'Unknown error'}`);
    } finally { setIsMinting(false); }
  };

  const handleCancelBatch = async () => {
    if (!lnc || !lnc.tapd?.mint) { setMintAssetError("LNC or Taproot Mint service not initialized."); return; }
    setIsMinting(true); setMintAssetError(null); setMintAssetSuccess(null);
    try {
      const { mint } = lnc.tapd;
      await mint.cancelBatch({});
      setMintAssetSuccess("Pending batch cancelled successfully.");
      await listBatches();
    } catch (error) {
        setMintAssetError(`Cancel failed: ${error.message || 'Unknown error'}`);
    } finally { setIsMinting(false); }
  };
  
  const handleFundChannelSubmit = async (event) => {
    if (event) event.preventDefault();
    setFundChannelError(null); setFundChannelSuccess(null); setIsFunding(true);
    if (!lnc || !lnc.tapd?.tapChannels) { setFundChannelError("LNC or Taproot TapChannel service not initialized."); setIsFunding(false); return; }

    try {
      const amt = parseInt(assetAmount, 10);
      const fee = parseInt(feeRateSatPerVbyte, 10);
      if (isNaN(amt) || amt <= 0) { throw new Error("Invalid Asset Amount."); }
      if (isNaN(fee) || fee <= 0) { throw new Error("Invalid Fee Rate."); }
      if (!assetId?.trim()) { throw new Error("Asset ID (Hex) is required."); }
      if (!peerPubkey?.trim()) { throw new Error("Peer Public Key (Hex) is required."); }

      const assetIdBase64 = Buffer.from(assetId.trim(), 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      const peerPubkeyBase64 = Buffer.from(peerPubkey.trim(), 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      const request = {
        assetAmount: assetAmount,
        assetId: assetIdBase64,
        peerPubkey: peerPubkeyBase64,
        feeRateSatPerVbyte: feeRateSatPerVbyte,
      };
      const fundChannelResponse = await lnc.tapd.tapChannels.fundChannel(request);
      setFundChannelSuccess(`Channel funding initiated. TX: ${fundChannelResponse?.fundingTxid || 'N/A'}, Index: ${fundChannelResponse?.fundingOutputIndex}`);
      setAssetAmount(''); setAssetId(''); setPeerPubkey(''); setFeeRateSatPerVbyte('');
    } catch (error) {
      setFundChannelError(error.message || "Failed to fund channel. Check inputs and node connection.");
    } finally { setIsFunding(false); }
  };


  if (isConnecting && !lnc) {
    return <LoadingSpinner message="Connecting to Node..." />;
  }

  if (!lnc) {
    return (
      <ConnectScreen
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        pairingPhrase={pairingPhrase}
        setPairingPhrase={setPairingPhrase}
        password={password}
        setPassword={setPassword}
        isConnecting={isConnecting}
        handleConnect={handleConnect}
        handleLogin={handleLogin}
        connectionError={connectionError}
        isPaired={isPaired}
      />
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300 p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <DarkModeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <div className="max-w-6xl mx-auto rounded-2xl shadow-xl transition-all duration-300" style={{ backgroundColor: 'var(--bg-secondary)', boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.01)'}` }}>
        <AppHeader
          nodeInfo={nodeInfo}
          nodeChannelsCount={nodeChannels?.length}
          assetsCount={assets?.length}
          peersCount={nodePeers?.length} 
          onShowPeers={() => setIsPeersModalOpen(true)} // <-- Pass the handler here
        />
        <PeersModal
          isOpen={isPeersModalOpen}
          onClose={() => {
              setIsPeersModalOpen(false);
              // Optionally clear form status when closing modal
              // (You'd need to lift connectPeerError/Success state or pass setters if you want to clear from here)
          }}
          peers={nodePeers}
          darkMode={darkMode}
          lnc={lnc} // <-- Pass the LNC instance
          onPeerAdded={listPeers} // <-- Pass the listPeers function as a callback
        />
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              <MintAssetForm
                mintAssetName={mintAssetName} setMintAssetName={setMintAssetName}
                mintAssetAmount={mintAssetAmount} setMintAssetAmount={setMintAssetAmount}
                mintAssetType={mintAssetType} 
                onAssetTypeChange={handleAssetTypeChange}
                mintAssetFilePreview={mintAssetFilePreview}
                onFileChange={handleFileChange}
                mintAssetMeta={mintAssetMeta} setMintAssetMeta={setMintAssetMeta}
                isMinting={isMinting}
                mintAssetError={mintAssetError}
                mintAssetSuccess={mintAssetSuccess}
                darkMode={darkMode}
                onSubmit={handleMintAssetSubmit}
              />
              <PendingBatchDisplay
                batchAssets={batchAssets}
                isMinting={isMinting}
                darkMode={darkMode}
                onCancelBatch={handleCancelBatch}
                onFinalizeBatch={handleFinalizeBatch}
                taprpc={taprpc}
              />
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              <OwnedAssetsList
                assets={assets}
                darkMode={darkMode}
                taprpc={taprpc}
              />
              {assets?.length > 0 && (
                <FundChannelForm
                  assetAmount={assetAmount} setAssetAmount={setAssetAmount}
                  assetId={assetId} setAssetId={setAssetId}
                  assets={assets}
                  peers={nodePeers}
                  onShowPeers={() => setIsPeersModalOpen(true)}
                  peerPubkey={peerPubkey} setPeerPubkey={setPeerPubkey}
                  feeRateSatPerVbyte={feeRateSatPerVbyte} setFeeRateSatPerVbyte={setFeeRateSatPerVbyte}
                  isFunding={isFunding}
                  fundChannelError={fundChannelError}
                  fundChannelSuccess={fundChannelSuccess}
                  darkMode={darkMode}
                  onSubmit={handleFundChannelSubmit}
                />
              )}
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 border-t text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          <p>Senfina TapVolt Demo</p>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
        @keyframes pulse-slow { 0% { opacity: 0.2; } 50% { opacity: 0.3; } 100% { opacity: 0.2; } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        body { background-color: var(--bg-primary); transition: background-color 0.3s ease; }
        input[type="file"]::file-selector-button {
          background-color: var(--file-bg);
          color: var(--file-text);
          border: 1px solid ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'};
        }
        input[type="file"]::file-selector-button:hover {
          background-color: var(--file-hover-bg);
        }
      `}</style>
    </div>
  );
}

export default App;
