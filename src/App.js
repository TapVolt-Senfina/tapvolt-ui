import React, { useState, useEffect } from 'react'; // Added useCallback just in case, though not strictly needed by original logic
import './App.css'; // Assuming your base CSS/Tailwind setup is here
import { Buffer } from 'buffer';
// Correct: Use default import for LNC and named import for taprpc
import LNC, { taprpc } from '@lightninglabs/lnc-web';

// --- Constants from Original ---
const ASSET_TYPE_COLLECTIBLE_NUM = 1;
const ASSET_VERSION_V0_NUM = 0; // Use V0 based on tapcli success
const META_TYPE_OPAQUE_NUM = 0; // Based on taprpc.AssetMetaType
// Added NORMAL type based on mintAsset logic
const ASSET_TYPE_NORMAL_NUM = 0;

// --- Helper Function for UI (From Target) ---
const getEnumName = (enumObj, value) => {
    if (value === undefined || value === null || !enumObj) return 'N/A';
    for (const key in enumObj) { if (Object.prototype.hasOwnProperty.call(enumObj, key) && enumObj[key] === value) return key; }
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(enumObj, value)) return value; // Handle potential string values
    return `UNKNOWN (${value})`;
};


function App() {
  // --- State Variables (From Original) ---
  const [lnc, setLNC] = useState(null);
  const [assets, setAssets] = useState([]);
  const [batchAssets, setBatchAssets] = useState([]); // Original uses nested array: [[asset1, asset2], ...]
  const [nodeChannels, setChannels] = useState([]);
  const [nodeInfo, setNodeInfo] = useState(null);

  // LNC Connection Form State (From Original)
  const [pairingPhrase, setPairingPhrase] = useState('');
  // const [password, setPassword] = useState(''); // Password was commented out in original
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Mint Asset Form State (From Original)
  const [mintAssetName, setMintAssetName] = useState('');
  const [mintAssetAmount, setMintAssetAmount] = useState('');
  const [mintAssetMeta, setMintAssetMeta] = useState('');
  const [mintAssetError, setMintAssetError] = useState(null);
  const [mintAssetSuccess, setMintAssetSuccess] = useState(null);
  const [isMinting, setIsMinting] = useState(false);

  // Fund Channel Form State (From Original)
  const [assetAmount, setAssetAmount] = useState('');
  const [assetId, setAssetId] = useState('');
  const [peerPubkey, setPeerPubkey] = useState('');
  const [feeRateSatPerVbyte, setFeeRateSatPerVbyte] = useState('');
  const [fundChannelError, setFundChannelError] = useState(null);
  const [fundChannelSuccess, setFundChannelSuccess] = useState(null);
  const [isFunding, setIsFunding] = useState(false);

  // --- UI State (From Target) ---
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  // Using isConnecting from original state instead of adding isInitializing


  // --- Dark Mode Logic (From Target) ---
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    const root = document.documentElement;
    const colors = darkMode
      ? { // Dark mode colors
          '--bg-primary': '#121212', '--bg-secondary': '#1e1e1e', '--bg-card': '#252525',
          '--text-primary': '#e0e0e0', '--text-secondary': '#a0a0a0', '--border-color': '#333333',
          '--accent-light': '#4f46e5', '--accent-dark': '#3730a3', '--success-bg': '#064e3b',
          '--success-text': '#10b981', '--error-bg': '#7f1d1d', '--error-text': '#f87171',
          '--form-bg': '#1f1f1f', '--batch-bg': '#172554', '--batch-border': '#1e3a8a',
          '--input-bg': '#2a2a2a', '--badge-bg': '#333333'
        }
      : { // Light mode colors
          '--bg-primary': '#f9fafb', '--bg-secondary': '#ffffff', '--bg-card': '#ffffff',
          '--text-primary': '#1f2937', '--text-secondary': '#6b7280', '--border-color': '#e5e7eb',
          '--accent-light': '#4f46e5', '--accent-dark': '#3730a3', '--success-bg': '#ecfdf5',
          '--success-text': '#047857', '--error-bg': '#fef2f2', '--error-text': '#b91c1c',
          '--form-bg': '#f8fafc', '--batch-bg': '#eff6ff', '--batch-border': '#bfdbfe',
          '--input-bg': '#ffffff', '--badge-bg': '#f3f4f6'
        };
    Object.entries(colors).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [darkMode]);


  // --- LNC Connection Logic (From Original) ---
  const handleConnect = async (event) => {
    event.preventDefault();
    setConnectionError(null);
    setIsConnecting(true); // Set connecting state
    try {
      if (!LNC) { throw new Error("LNC constructor not available."); }
      console.log('Attempting to instantiate LNC...');
      const lncInstance = new LNC({
        pairingPhrase: pairingPhrase,
        // password: password, // Original had password commented out
      });
      console.log('LNC instance created, attempting to connect...');
      await lncInstance.connect();
      console.log('LNC connected successfully.');
      setLNC(lncInstance); // Set the connected instance
      // Clear connection form state on success
      setPairingPhrase('');
      // setPassword('');
    } catch (error) {
      console.error('LNC connection error:', error);
      setConnectionError(error.message || 'Failed to connect. Check phrase/proxy.');
      setLNC(null); // Ensure LNC state is null on error
    } finally {
      setIsConnecting(false); // Reset connecting state
    }
  };

  // --- Data Fetching Logic (From Original) ---
  useEffect(() => {
    // Fetch data only if LNC object exists and seems ready
    // Original used lnc.isReady, let's stick to that for now.
    // Add checks for services before calling them inside the functions.
    if (lnc && lnc.isReady) {
      console.log('LNC ready, fetching node data...');
      getInfo();
      listChannels();
      listAssets();
      listBatches();
      listFederationServers();
    } else {
      // Optional: Clear data if lnc becomes null or not ready
      setNodeInfo(null);
      setChannels([]);
      setAssets([]);
      setBatchAssets([]);
    }
  }, [lnc]); // Rerun when lnc state changes (Original trigger)

  const getInfo = async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for getInfo"); return; }
    const { lightning } = lnc.lnd;
    try { const info = await lightning.getInfo(); setNodeInfo(info); console.log("Node Info:", info); }
    catch(error) { console.error("Failed to get node info:", error); setNodeInfo(null); }
  };
  const listFederationServers = async() => {
    const { universe } = lnc.tapd;
    const servers = await universe.listFederationServers();
    console.log(servers);
  };
  const listChannels = async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for listChannels"); return; }
    const { lightning } = lnc.lnd;
    try { const r = await lightning.listChannels(); setChannels(Array.isArray(r?.channels) ? r.channels : []); }
    catch (error) { console.error("Failed to list channels:", error); setChannels([]); }
  };

  const listAssets = async () => { // Original listAssets logic
    if (!lnc || !lnc.tapd?.taprootAssets) { console.error("LNC or Taproot Assets service not initialized for listAssets"); return; }
    const { taprootAssets } = lnc.tapd;
    try {
      const assetsTap = await taprootAssets.listAssets({ include_unconfirmed_mints: true });
      console.log("Assets Response:", assetsTap);
      let assetsArr = [];
      if (assetsTap && Array.isArray(assetsTap.assets)) {
        for (let asset of assetsTap.assets) {
          const assetTypeNum = asset?.assetType;
          const assetIdForMeta = asset?.assetGenesis?.assetIdStr || asset?.assetGenesis?.assetId;

          if (assetTypeNum === ASSET_TYPE_COLLECTIBLE_NUM && assetIdForMeta) {
            try {
              const meta = await taprootAssets.fetchAssetMeta({ asset_id_str: assetIdForMeta });
              if (meta && meta.data) {
                // Use Buffer for potentially binary data, then try UTF8
                const decodedMeta = Buffer.from(meta.data).toString('utf8');
                assetsArr.push({ ...asset, decodedMeta });
              } else { assetsArr.push(asset); }
            } catch (metaError) { console.error(`Failed fetch meta ${assetIdForMeta}:`, metaError); assetsArr.push(asset); }
          } else { assetsArr.push(asset); }
        }
      }
      setAssets(assetsArr);
    } catch (error) { console.error("Failed to list assets:", error); setAssets([]); }
  };

  const listBatches = async () => { // Original listBatches logic (produces nested array)
    if (!lnc || !lnc.tapd?.mint) { console.error("LNC or Taproot Mint service not initialized for listBatches."); return; } // Adjusted error message slightly
    const { mint } = lnc.tapd;
    try {
      const assetsBatch = await mint.listBatches();
      console.log("List Batches Response:", assetsBatch); // Log raw response
      let formattedAssetsArray = [];
      if (assetsBatch && Array.isArray(assetsBatch.batches) && assetsBatch.batches.length > 0) {
        for (let batch of assetsBatch.batches) {
          // Original check: PENDING state only
          if (batch?.batch?.state === "BATCH_STATE_PENDING") { // Stick to original logic
            const formattedAssets = batch.batch.assets.map(asset => ({
              name: asset.name,
              amount: asset.amount?.toString(), // Ensure string
              assetVersion: asset.assetVersion,
              assetType: asset.assetType,
              // Use Buffer for meta decode
              assetMeta: asset.assetMeta?.data ? Buffer.from(asset.assetMeta.data).toString('utf8') : '',
            }));
            console.log("Pending Batch Found:", formattedAssets);
            formattedAssetsArray.push(formattedAssets); // Keep the nested structure
          }
        }
      }
      setBatchAssets(formattedAssetsArray); // Set the nested array
    } catch (error) { console.error("Failed to list batches:", error); setBatchAssets([]); }
  };

  // --- Action Functions (From Original) ---

  const mintAsset = async (event) => { // Original mintAsset logic
    event.preventDefault();
    setMintAssetError(null); setMintAssetSuccess(null); setIsMinting(true);

    if (!lnc || !lnc.tapd?.mint) { setMintAssetError("LNC or Taproot Mint service not initialized."); setIsMinting(false); return; }

    const sanitizedName = mintAssetName.replace(/[\r\n]+/g, '').trim();
    if (!sanitizedName) { setMintAssetError("Asset name cannot be empty."); setIsMinting(false); return; }

    const amount = parseInt(mintAssetAmount, 10);
    if (isNaN(amount) || amount <= 0) { setMintAssetError("Invalid amount."); setIsMinting(false); return; }

    let metaDataBytesBase64 = "";
    const trimmedMeta = mintAssetMeta.trim();
    if (trimmedMeta) {
        try {
            const sanitizedMeta = trimmedMeta.replace(/[\r\n]+/g, '');
            metaDataBytesBase64 = Buffer.from(sanitizedMeta, 'utf8').toString('base64');
            console.log("Encoded Metadata (Base64):", metaDataBytesBase64);
        } catch (bufferError) {
            console.error("Error encoding metadata:", bufferError);
            setMintAssetError("Failed to encode metadata."); setIsMinting(false); return;
        }
    }

    try {
      const { mint } = lnc.tapd;
      const request = {
        asset: {
          asset_version: ASSET_VERSION_V0_NUM,
          asset_type: ASSET_TYPE_NORMAL_NUM, // Use Number from constant
          name: sanitizedName,
          amount: amount.toString(), // Amount must be string
          asset_meta: {
              data: metaDataBytesBase64,
              type: META_TYPE_OPAQUE_NUM
          }
        },
        short_response: false, // Keep from original
      };
      console.log("Minting request (Original Logic):", JSON.stringify(request, null, 2));

      const response = await mint.mintAsset(request);
      console.log("Minting response:", response);

      if (response?.pendingBatch?.batchKey) {
        const batchKeyHex = Buffer.from(response.pendingBatch.batchKey).toString('hex');
        setMintAssetSuccess(
          <>
          Asset minting initiated. Batch key: <div style={{overflowX: "auto"}}>{batchKeyHex}</div>
          </>
        );
        setMintAssetName(''); setMintAssetAmount(''); setMintAssetMeta('');
        listBatches(); // Refresh batch list
      } else {
        const backendError = response?.error || 'Unexpected response structure.';
        console.error("Mint asset response invalid:", response);
        setMintAssetError(`Failed to initiate asset minting. ${backendError}`);
      }
    } catch (error) {
      console.error('Mint asset error:', error);
      const errorMsg = error.message || 'Unknown error.';
      const details = error.details || (error.toString ? error.toString() : 'No details');
      setMintAssetError(`Minting failed: ${errorMsg} (Details: ${details})`);
    } finally {
        setIsMinting(false);
    }
  };

  const finalizeBatch = async () => { // Original finalizeBatch logic
    if (!lnc || !lnc.tapd?.mint) { setMintAssetError("LNC or Taproot Mint service not initialized."); return; } // Simplified check
    setIsMinting(true); // Use isMinting for feedback
    setMintAssetError(null); setMintAssetSuccess(null); // Clear previous messages

    try {
      const { mint } = lnc.tapd;
      // Original used hardcoded fee 253, let's keep that.
      const feeRate = 253;
      console.log(`Finalizing batch with fee rate: ${feeRate} sat/vB`);
      const batchResponse = await mint.finalizeBatch({ fee_rate: feeRate });
      console.log("Finalize Batch Response:", batchResponse);
      // Provide success message - adapt based on actual response structure if needed
      setMintAssetSuccess(`Batch finalize initiated. TXID: ${batchResponse?.batch?.batchTxid || 'N/A'}`);
      await listBatches(); // Refresh batches (should be empty)
      await listAssets(); // Refresh assets list
    } catch (error) {
        console.error("Finalize batch error:", error);
        // Set error message on the mint form area for user feedback
        setMintAssetError(`Finalize failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsMinting(false);
    }
  };

  const cancelBatch = async () => { // Original cancelBatch logic
    if (!lnc || !lnc.tapd?.mint) { setMintAssetError("LNC or Taproot Mint service not initialized."); return; }
    setIsMinting(true); // Use isMinting for feedback
    setMintAssetError(null); setMintAssetSuccess(null); // Clear previous messages

    try {
      const { mint } = lnc.tapd;
      console.log("Cancelling current batch...");
      const batchResponse = await mint.cancelBatch({});
      console.log("Cancel Batch Response:", batchResponse);
      // Provide success message
      setMintAssetSuccess("Pending batch cancelled successfully.");
      await listBatches(); // Refresh batch list (should be empty)
    } catch (error) {
        console.error("Cancel batch error:", error);
        setMintAssetError(`Cancel failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsMinting(false);
    }
  };

  const fundChannel = async (event) => { // Original fundChannel logic
    if (event) event.preventDefault();
    setFundChannelError(null); setFundChannelSuccess(null); setIsFunding(true);

    if (!lnc || !lnc.tapd?.tapChannels) { setFundChannelError("LNC or Taproot TapChannel service not initialized."); setIsFunding(false); return; }

    const { tapChannels } = lnc.tapd;

    try {
      // Original logic used hexToBytes for keys and assetId. Let's stick to that.
      // Need basic validation first.
      const amt = parseInt(assetAmount, 10);
      const fee = parseInt(feeRateSatPerVbyte, 10);
      if (isNaN(amt) || amt <= 0) { throw new Error("Invalid Asset Amount."); }
      if (isNaN(fee) || fee <= 0) { throw new Error("Invalid Fee Rate."); }
      if (!assetId?.trim()) { throw new Error("Asset ID (Hex) is required."); }
      if (!peerPubkey?.trim()) { throw new Error("Peer Public Key (Hex) is required."); }


      // Convert assetId and peerPubkey to base64 encoded strings
      const modifiedBase64 = assetId.replace(/\+/g, '-').replace(/\//g, '_');

      const peerPubkeyBase64 = Buffer.from(peerPubkey, 'hex').toString('base64');

      const request = {
        assetAmount: assetAmount, // string, not number
        assetId: modifiedBase64,
        peerPubkey: peerPubkeyBase64.replace(/\+/g, '-').replace(/\//g, '_'),
        feeRateSatPerVbyte: feeRateSatPerVbyte,
      };

      console.log("Fund Channel Request (Original Logic):", request); // Log byte arrays might show as objects
      const fundChannelResponse = await tapChannels.fundChannel(request);
      console.log("Fund Channel Response:", fundChannelResponse);
      // Adapt success message based on actual response if needed
      setFundChannelSuccess(`Channel funding initiated. TX: ${fundChannelResponse?.fundingTxid || 'N/A'}, Index: ${fundChannelResponse?.fundingOutputIndex}`);
      // Clear form on success
      setAssetAmount(''); setAssetId(''); setPeerPubkey(''); setFeeRateSatPerVbyte('');
    } catch (error) {
      console.error("Failed to fund channel:", error);
      setFundChannelError(error.message || "Failed to fund channel. Check inputs (ensure hex format) and node connection.");
    } finally {
      setIsFunding(false);
    }
  };


  // --- Render Logic ---

   // Loading State (Using Target's Style with Original Logic)
   if (isConnecting) { // Use original isConnecting state
    return (
      <div className="flex flex-col justify-center items-center min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <svg className="animate-spin h-10 w-10 mb-4" style={{ color: 'var(--accent-light)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-xl font-semibold animate-pulse"> Connecting to Node... </p>
      </div> );
  }

  // Connection Screen (Using Target's Style with Original Logic)
  if (!lnc) { // Use original check for lnc instance
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4" style={{ background: darkMode ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #c7d2fe 0%, #ede9fe 100%)', color: 'var(--text-primary)' }}>
        {/* Dark Mode Toggle */}
        <div className="absolute top-4 right-4"> <button onClick={toggleDarkMode} className="p-2 rounded-full transition-colors duration-200" style={{ background: darkMode ? '#ffffff20' : '#00000020' }}> {darkMode ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>} </button> </div>
        {/* Logo/Header */}
        <img src="/favicon.png" alt="Senfina TapVolt Logo" className="w-24 h-24 mb-6" />
        <div className="text-center mb-8"> <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tighter" style={{ color: darkMode ? '#ffffff' : '#1e293b', textShadow: darkMode ? '0 2px 10px rgba(99, 102, 241, 0.5)' : '0 2px 5px rgba(0, 0, 0, 0.1)' }}> Senfina TapVolt </h1> <p className="text-lg md:text-xl max-w-xl leading-relaxed mx-auto" style={{ color: darkMode ? '#b4b4b4' : '#4b5563' }}> Connect your LNC-enabled node. </p> </div>
        {/* Connection Form Card */}
        <div className="bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-10 w-full max-w-md transition-all duration-300" style={{ background: darkMode ? 'rgba(30, 30, 40, 0.7)' : 'rgba(255, 255, 255, 0.85)', boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}` }}>
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>Connect Your Node</h2>
          {/* Ensure onSubmit uses original handleConnect */}
          <form onSubmit={handleConnect}>
            <div className="mb-5">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="pairingPhrase">LNC Pairing Phrase</label>
              <textarea
                id="pairingPhrase"
                className="w-full px-4 py-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`, boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)' }}
                placeholder="Enter pairing phrase..."
                value={pairingPhrase} // Use original state
                onChange={(e) => setPairingPhrase(e.target.value)} // Use original setter
                required
                rows="4"
                disabled={isConnecting} />
            </div>
            {/* Password input commented out as in original */}
            {/* <div className="mb-6"> ... password input ... </div> */}
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg font-bold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, var(--accent-light), var(--accent-dark))`, boxShadow: darkMode ? '0 4px 12px rgba(79, 70, 229, 0.3)' : '0 4px 12px rgba(79, 70, 229, 0.2)' }}
              disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect with LNC'}
            </button>
          </form>
          {/* Error Display uses original state */}
          {connectionError && (
            <div className="mt-6 p-4 rounded-lg text-center text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}>
              {connectionError}
            </div>
          )}
          {/* Footer Links */}
          <div className="mt-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-sm">Powered by Lightning Node Connect</p>
            <p className="text-xs mt-2">Need help? <a href="https://docs.lightning.engineering/lightning-network-tools/lightning-node-connect/overview" target="_blank" rel="noopener noreferrer" className="ml-1 transition-colors duration-200" style={{ color: 'var(--accent-light)' }}>Documentation</a></p>
          </div>
        </div>
        {/* Footer Text */}
        <div className="absolute bottom-6 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>© {new Date().getFullYear()} Senfina TapVolt Demo</div>
      </div>
    );
  }

  // --- Main Application UI (Target's Style with Original Logic) ---
  return (
    <div className="min-h-screen transition-colors duration-300 p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Dark Mode Toggle */}
      <button onClick={toggleDarkMode} className="fixed top-4 right-4 z-50 p-2 rounded-full transition-colors duration-200" style={{ background: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
         {darkMode ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
      </button>

      {/* Main Content Card */}
      <div className="max-w-6xl mx-auto rounded-2xl shadow-xl transition-all duration-300" style={{ backgroundColor: 'var(--bg-secondary)', boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.01)'}` }}>
        {/* Header Section */}
        <header className="p-6 border-b transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
               <img src="/favicon.png" alt="Logo" className="w-10 h-10" />
               <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Senfina TapVolt</h1>
            </div>
            {/* Node Info Grid uses original state */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div>Alias: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeInfo?.alias || '...'}</span></div>
              <div>Height: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeInfo?.blockHeight || '...'}</span></div>
              <div>Synced: <span className="font-medium" style={{ color: nodeInfo?.syncedToChain ? '#10b981' : '#ef4444' }}>{typeof nodeInfo?.syncedToChain === 'boolean' ? (nodeInfo.syncedToChain ? 'Yes' : 'No') : '...'}</span></div>
              <div>Channels: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeChannels?.length ?? '...'}</span></div>
              <div>Assets: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{assets?.length ?? '...'}</span></div>
            </div>
          </div>
        </header>

        {/* Main Content Area (Grid Layout) */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* Left Column: Minting & Batch */}
             <div className="space-y-8">
                {/* Mint Asset Section */}
                <section>
                  <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Mint New Asset</h2>
                  {/* Mint Form uses original state/handlers */}
                  <form onSubmit={mintAsset} className="rounded-xl transition-colors duration-300 p-6" style={{ backgroundColor: 'var(--form-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                    <div className="mb-4">
                      <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetName">Asset Name</label>
                      <input id="mintAssetName" className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="text" placeholder="e.g., MyToken" value={mintAssetName} onChange={(e) => setMintAssetName(e.target.value)} required disabled={isMinting} />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetAmount">Amount (Units)</label>
                      <input id="mintAssetAmount" className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="number" placeholder="e.g., 1000" value={mintAssetAmount} onChange={(e) => setMintAssetAmount(e.target.value)} min="1" required disabled={isMinting} />
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetMeta">Metadata (Optional Text)</label>
                      <input id="mintAssetMeta" className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="text" placeholder="e.g., Asset description" value={mintAssetMeta} onChange={(e) => setMintAssetMeta(e.target.value)} disabled={isMinting} />
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Stored as OPAQUE metadata.</p>
                    </div>
                    <button className="w-full py-2 px-4 rounded-md font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] text-white" style={{ background: `linear-gradient(135deg, var(--accent-light), var(--accent-dark))`, boxShadow: darkMode ? '0 4px 12px rgba(79, 70, 229, 0.3)' : '0 4px 12px rgba(79, 70, 229, 0.2)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} type="submit" disabled={isMinting}>
                      {isMinting ? 'Adding to Batch...' : 'Add Asset to Batch'}
                    </button>
                    {/* Mint Feedback uses original state */}
                    {mintAssetError && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}>{mintAssetError}</div>}
                    {mintAssetSuccess && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}` }}>{mintAssetSuccess}</div>}
                  </form>
                </section>

                {/* Pending Batch Section */}
                {/* Check original batchAssets (nested array) */}
                 {batchAssets.length > 0 && (
                   <section className="rounded-xl p-6 transition-colors duration-300" style={{ backgroundColor: 'var(--batch-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--batch-border)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                    <h3 className="text-xl font-bold mb-4" style={{ color: darkMode ? '#93c5fd' : '#1e40af' }}>Pending Mint Batch</h3>
                    <div className="max-h-60 overflow-y-auto pr-2 mb-4 space-y-2">
                      {/* Map over the nested structure from original state */}
                      {batchAssets.flatMap((batch, batchIndex) => // Flatten the batches
                        batch.map((asset, assetIndex) => ( // Map assets within each batch
                          <div key={`${batchIndex}-${assetIndex}`} className="p-3 rounded-lg transition-colors duration-200" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`, boxShadow: darkMode ? '0 2px 5px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{asset.name}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{asset.amount} units</span>
                            </div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                              Type: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetType, asset.assetType)}</span> |
                              Version: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetVersion, asset.assetVersion)}</span>
                            </div>
                            {asset.assetMeta && <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }} title={asset.assetMeta}>Meta: {asset.assetMeta}</p>}
                          </div>
                        ))
                      )}
                    </div>
                    {/* Buttons use original handlers */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button className="flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'white', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'var(--border-color)'}`, boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} onClick={cancelBatch} disabled={isMinting}>Cancel Batch</button>
                      <button className="flex-1 py-2 px-4 rounded-md font-medium text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: darkMode ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(16, 185, 129, 0.2)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} onClick={finalizeBatch} disabled={isMinting}>{isMinting ? 'Processing...' : 'Finalize Batch'}</button>
                    </div>
                 </section>
                 )}
             </div>

             {/* Right Column: Owned Assets & Funding */}
             <div className="space-y-8">
                 {/* Owned Assets Section */}
                 <section>
                   <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Owned Assets</h2>
                   {/* Check original assets state */}
                   {assets.length > 0 ? (
                     <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2">
                       {/* Map original assets state */}
                       {assets.map((item, index) => {
                          const type = item.assetGenesis.assetType;
                          // Need to check where version comes from in original data. Assuming item.assetGenesis.version if available, else 'N/A'
                          const ver = getEnumName(taprpc?.AssetVersion, item.assetGenesis?.version ?? item.version); // Prioritize genesis version if exists
                          const id = item.assetGenesis?.assetIdStr || item.assetGenesis?.assetId || 'N/A';
                          return (
                            <div key={index} className="rounded-lg p-4 transition-all duration-300 transform hover:scale-[1.01]" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`, boxShadow: darkMode ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                              <p className="font-semibold mb-2 truncate" style={{ color: 'var(--text-primary)' }} title={item.assetGenesis?.name}>{item.assetGenesis?.name || 'Unnamed Asset'}</p>
                              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <p>Amount: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.amount?.toString() || 'N/A'}</span></p>
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>Type: {type}</span>
                                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>Version: {ver}</span>
                                </div>
                                <p className="text-xs break-all pt-1" title={id}>ID: <span style={{ fontFamily: 'monospace' }}>{id}</span></p>
                                <p className="text-xs break-all">Genesis Pt: {item.assetGenesis?.genesisPoint || 'N/A'}</p>
                                <p className="text-xs">Anchor Height: <span style={{ fontFamily: 'monospace' }}>{item.chainAnchor?.blockHeight || 'Unconfirmed'}</span></p>
                              </div>
                              {/* Use original decodedMeta state */}
                              {type === 'COLLECTIBLE' && item.decodedMeta && (
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                  <p className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Decoded Metadata</p>
                                  {item.decodedMeta.startsWith('data:image') ?
                                    <img src={item.decodedMeta} alt="Asset Preview" className="max-w-full h-auto rounded border" style={{ borderColor: 'var(--border-color)' }} onError={(e) => { e.target.style.display='none'; if(e.target.nextElementSibling) e.target.nextElementSibling.style.display='block'; }}/>
                                    : null
                                  }
                                  <pre className="text-xs p-2 rounded overflow-auto max-h-28 border" style={{ display: item.decodedMeta.startsWith('data:image') ? 'none' : 'block', backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                                    {item.decodedMeta}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                       })}
                     </div>
                   ) : (
                     <p style={{ color: 'var(--text-secondary)' }}>No assets found or still loading...</p>
                   )}
                 </section>

                 {/* Fund Channel Section */}
                 {/* Check original assets state */}
                 {assets?.length > 0 && (
                   <section>
                     <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Fund Asset Channel</h2>
                     {/* Fund Channel Form uses original state/handlers */}
                     <form onSubmit={fundChannel} className="rounded-xl p-6 transition-colors duration-300" style={{ backgroundColor: 'var(--form-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="mb-4 sm:mb-0">
                             {/* Ensure htmlFor matches input id */}
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
                        {/* Funding Feedback uses original state */}
                        {fundChannelError && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}>{fundChannelError}</div>}
                        {fundChannelSuccess && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}` }}>{fundChannelSuccess}</div>}
                     </form>
                   </section>
                 )}
             </div>
          </div>
        </div>

        {/* Footer Section */}
        <footer className="px-6 py-4 border-t text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          <p>Senfina TapVolt Demo</p>
        </footer>
      </div>

      {/* Styles from Target */}
      <style jsx global>{`
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
        @keyframes pulse-slow { 0% { opacity: 0.2; } 50% { opacity: 0.3; } 100% { opacity: 0.2; } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }

        /* Ensure body background matches theme */
        body {
           background-color: var(--bg-primary);
           transition: background-color 0.3s ease;
        }
        /* Add any other global styles needed */
      `}</style>
    </div>
  );
}

export default App;