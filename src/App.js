import React, { useState, useEffect } from 'react';
import './App.css';
import { Buffer } from 'buffer';
import LNC, { taprpc } from '@lightninglabs/lnc-web';

// --- Constants from Original ---
const ASSET_TYPE_COLLECTIBLE_NUM = 1;
const ASSET_VERSION_V0_NUM = 0;
const META_TYPE_OPAQUE_NUM = 0;
const ASSET_TYPE_NORMAL_NUM = 0;

// --- Helper Function for UI (From Target) ---
const getEnumName = (enumObj, value) => {
    if (value === undefined || value === null || !enumObj) return 'N/A';
    for (const key in enumObj) { if (Object.prototype.hasOwnProperty.call(enumObj, key) && enumObj[key] === value) return key; }
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(enumObj, value)) return value;
    return `UNKNOWN (${value})`;
};


function App() {
  // --- State Variables (From Original) ---
  const [lnc, setLNC] = useState(null);
  const [assets, setAssets] = useState([]);
  const [batchAssets, setBatchAssets] = useState([]);
  const [nodeChannels, setChannels] = useState([]);
  const [nodeInfo, setNodeInfo] = useState(null);

  // LNC Connection Form State
  const [pairingPhrase, setPairingPhrase] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Mint Asset Form State
  const [mintAssetName, setMintAssetName] = useState('');
  const [mintAssetAmount, setMintAssetAmount] = useState('');
  const [mintAssetMeta, setMintAssetMeta] = useState(''); // For normal assets
  const [mintAssetType, setMintAssetType] = useState('NORMAL'); // 'NORMAL' or 'COLLECTIBLE'
  const [mintAssetFile, setMintAssetFile] = useState(null); // For collectible image file
  const [mintAssetFilePreview, setMintAssetFilePreview] = useState(null); // For collectible image preview
  const [mintAssetError, setMintAssetError] = useState(null);
  const [mintAssetSuccess, setMintAssetSuccess] = useState(null);
  const [isMinting, setIsMinting] = useState(false);

  // Fund Channel Form State
  const [assetAmount, setAssetAmount] = useState('');
  const [assetId, setAssetId] = useState('');
  const [peerPubkey, setPeerPubkey] = useState('');
  const [feeRateSatPerVbyte, setFeeRateSatPerVbyte] = useState('');
  const [fundChannelError, setFundChannelError] = useState(null);
  const [fundChannelSuccess, setFundChannelSuccess] = useState(null);
  const [isFunding, setIsFunding] = useState(false);

  // UI State
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // --- Dark Mode Logic ---
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
          '--input-bg': '#2a2a2a', '--badge-bg': '#333333'
        }
      : {
          '--bg-primary': '#f9fafb', '--bg-secondary': '#ffffff', '--bg-card': '#ffffff',
          '--text-primary': '#1f2937', '--text-secondary': '#6b7280', '--border-color': '#e5e7eb',
          '--accent-light': '#4f46e5', '--accent-dark': '#3730a3', '--success-bg': '#ecfdf5',
          '--success-text': '#047857', '--error-bg': '#fef2f2', '--error-text': '#b91c1c',
          '--form-bg': '#f8fafc', '--batch-bg': '#eff6ff', '--batch-border': '#bfdbfe',
          '--input-bg': '#ffffff', '--badge-bg': '#f3f4f6'
        };
    Object.entries(colors).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [darkMode]);


  // --- LNC Connection Logic ---
  const handleConnect = async (event) => {
    event.preventDefault();
    setConnectionError(null);
    setIsConnecting(true);
    try {
      if (!LNC) { throw new Error("LNC constructor not available."); }
      const lncInstance = new LNC({ pairingPhrase: pairingPhrase });
      await lncInstance.connect();
      setLNC(lncInstance);
      setPairingPhrase('');
    } catch (error) {
      console.error('LNC connection error:', error);
      setConnectionError(error.message || 'Failed to connect. Check phrase/proxy.');
      setLNC(null);
    } finally {
      setIsConnecting(false);
    }
  };

  // --- Data Fetching Logic ---
  useEffect(() => {
    if (lnc && lnc.isReady) {
      console.log('LNC ready, fetching node data...');
      getInfo();
      listChannels();
      listAssets();
      listBatches();
      // listFederationServers(); // Kept commented as it was in original full example
    } else {
      setNodeInfo(null); setChannels([]); setAssets([]); setBatchAssets([]);
    }
  }, [lnc]);

  const getInfo = async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for getInfo"); return; }
    try { const info = await lnc.lnd.lightning.getInfo(); setNodeInfo(info); console.log("Node Info:", info); }
    catch(error) { console.error("Failed to get node info:", error); setNodeInfo(null); }
  };

  // const listFederationServers = async() => { /* ... original commented out ... */ };

  const listChannels = async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for listChannels"); return; }
    try { const r = await lnc.lnd.lightning.listChannels(); setChannels(Array.isArray(r?.channels) ? r.channels : []); }
    catch (error) { console.error("Failed to list channels:", error); setChannels([]); }
  };

  const listAssets = async () => {
    if (!lnc || !lnc.tapd?.taprootAssets) { console.error("LNC or Taproot Assets service not initialized for listAssets"); return; }
    const { taprootAssets } = lnc.tapd;
    try {
      const assetsTap = await taprootAssets.listAssets({ include_unconfirmed_mints: true });
      let assetsArr = [];
      if (assetsTap && Array.isArray(assetsTap.assets)) {
        for (let asset of assetsTap.assets) {
          const assetType = asset?.assetGenesis?.assetType; // This is the numeric type
          const assetId = asset?.assetGenesis?.assetId;
          // Try to decode metadata if it's a collectible and has an ID
          // The display logic later will check if decodedMeta is a data URL
          if (assetType === "COLLECTIBLE") {
            try {
              const meta = await taprootAssets.fetchAssetMeta({ asset_id: assetId });
              if (meta && meta.data && meta.type === "META_TYPE_OPAQUE") { // Check type OPAQUE
                // The meta.data is expected to be base64 encoded bytes.
                // If we stored a data URL, it was (DataURL string -> UTF8 bytes -> base64).
                // So, decode base64 -> UTF8 string. This should yield the DataURL.
                const decodedMeta = Buffer.from(meta.data, 'base64').toString('utf8');
                assetsArr.push({ ...asset, decodedMeta: decodedMeta });
              } else {
                assetsArr.push(asset); // Push asset even if meta fetch fails or is not opaque
              }
            } catch (metaError) {
              console.error(`Failed to fetch metadata for asset ${assetId}:`, metaError);
              assetsArr.push(asset); // Push asset even if meta fetch fails
            }
          } else {
            assetsArr.push(asset);
          }
        }
      }
      setAssets(assetsArr);
    } catch (error) { console.error("Failed to list assets:", error); setAssets([]); }
  };

  const listBatches = async () => {
    if (!lnc || !lnc.tapd?.mint) { console.error("LNC or Taproot Mint service not initialized for listBatches."); return; }
    const { mint } = lnc.tapd;
    try {
      const assetsBatch = await mint.listBatches();
      let formattedAssetsArray = [];
      if (assetsBatch && Array.isArray(assetsBatch.batches)) {
        for (let batch of assetsBatch.batches) {
          if (batch?.batch?.state === "BATCH_STATE_PENDING") {
            const formattedAssets = batch.batch.assets.map(asset => ({
              name: asset.name,
              amount: asset.amount?.toString(),
              assetVersion: asset.assetVersion,
              assetType: asset.assetType,
              assetMeta: asset.assetMeta?.data ? Buffer.from(asset.assetMeta.data, 'base64').toString('utf8') : '', // Assuming meta in batch is also base64(utf8_string)
            }));
            formattedAssetsArray.push(formattedAssets);
          }
        }
      }
      setBatchAssets(formattedAssetsArray);
    } catch (error) { console.error("Failed to list batches:", error); setBatchAssets([]); }
  };

  // --- Action Functions ---
  const mintAsset = async (event) => {
    event.preventDefault();
    setMintAssetError(null); setMintAssetSuccess(null); setIsMinting(true);
    setMintAssetFilePreview(null); // Clear preview on new attempt

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

    const assetTypeNum = mintAssetType === 'COLLECTIBLE' ? ASSET_TYPE_COLLECTIBLE_NUM : ASSET_TYPE_NORMAL_NUM;
    let metaContentForEncoding = ""; // This will be the string (text or Data URL) that gets base64 encoded

    if (mintAssetType === 'COLLECTIBLE' && mintAssetFile) {
        try {
            metaContentForEncoding = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result); // reader.result is the Data URL
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(mintAssetFile);
            });
            console.log("File read as Data URL for metadata:", metaContentForEncoding.substring(0,100) + "...");
        } catch (fileError) {
            console.error("Error reading file for metadata:", fileError);
            setMintAssetError("Failed to read image file for metadata.");
            setIsMinting(false); return;
        }
    } else if (mintAssetType === 'NORMAL') {
        const trimmedMeta = mintAssetMeta.trim();
        if (trimmedMeta) {
            metaContentForEncoding = trimmedMeta.replace(/[\r\n]+/g, '');
        }
    }
    // If Collectible but no file, metaContentForEncoding remains empty, which is fine.

    let finalMetaBase64 = "";
    if (metaContentForEncoding) {
        try {
            // The API expects asset_meta.data to be base64(actual_bytes_of_metadata)
            // For text: base64(utf8_bytes_of_text_string)
            // For image (via Data URL): base64(utf8_bytes_of_DataURL_string)
            finalMetaBase64 = Buffer.from(metaContentForEncoding, 'utf8').toString('base64');
            console.log("Final Encoded Metadata (Base64 of UTF8 content):", finalMetaBase64.substring(0,100) + "...");
        } catch (bufferError) {
            console.error("Error encoding metadata content to Base64:", bufferError);
            setMintAssetError("Failed to encode metadata content.");
            setIsMinting(false); return;
        }
    }

    try {
        const { mint } = lnc.tapd;
        const request = {
            asset: {
                asset_version: ASSET_VERSION_V0_NUM,
                asset_type: assetTypeNum,
                name: sanitizedName,
                amount: amount.toString(),
                asset_meta: {
                    data: finalMetaBase64, // This is base64(utf8_string_of_content)
                    type: META_TYPE_OPAQUE_NUM // OPAQUE means client interprets it
                }
            },
            short_response: false,
        };
        console.log("Minting request:", JSON.stringify({ ...request, asset: { ...request.asset, asset_meta: { ...request.asset.asset_meta, data: request.asset.asset_meta.data.substring(0,100) + "..." }}}, null, 2));

        const response = await mint.mintAsset(request);
        console.log("Minting response:", response);

        if (response?.pendingBatch?.batchKey) {
            const batchKeyHex = Buffer.from(response.pendingBatch.batchKey).toString('hex');
            setMintAssetSuccess(
              <>Asset minting initiated. Batch key: <div style={{overflowX: "auto"}}>{batchKeyHex}</div></>
            );
            // Clear form fields
            setMintAssetName(''); setMintAssetAmount(''); setMintAssetMeta('');
            setMintAssetType('NORMAL'); setMintAssetFile(null); setMintAssetFilePreview(null);
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

  const finalizeBatch = async () => {
    if (!lnc || !lnc.tapd?.mint) { setMintAssetError("LNC or Taproot Mint service not initialized."); return; }
    setIsMinting(true); setMintAssetError(null); setMintAssetSuccess(null);
    try {
      const { mint } = lnc.tapd;
      const feeRate = 253; // Keep original example
      const batchResponse = await mint.finalizeBatch({ fee_rate: feeRate });
      setMintAssetSuccess(`Batch finalize initiated. TXID: ${batchResponse?.batch?.batchTxid || 'N/A'}`);
      await listBatches(); await listAssets();
    } catch (error) {
        console.error("Finalize batch error:", error);
        setMintAssetError(`Finalize failed: ${error.message || 'Unknown error'}`);
    } finally { setIsMinting(false); }
  };

  const cancelBatch = async () => {
    if (!lnc || !lnc.tapd?.mint) { setMintAssetError("LNC or Taproot Mint service not initialized."); return; }
    setIsMinting(true); setMintAssetError(null); setMintAssetSuccess(null);
    try {
      const { mint } = lnc.tapd;
      await mint.cancelBatch({});
      setMintAssetSuccess("Pending batch cancelled successfully.");
      await listBatches();
    } catch (error) {
        console.error("Cancel batch error:", error);
        setMintAssetError(`Cancel failed: ${error.message || 'Unknown error'}`);
    } finally { setIsMinting(false); }
  };

  const fundChannel = async (event) => {
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
      console.error("Failed to fund channel:", error);
      setFundChannelError(error.message || "Failed to fund channel. Check inputs and node connection.");
    } finally { setIsFunding(false); }
  };


  // --- Render Logic ---
   if (isConnecting) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <svg className="animate-spin h-10 w-10 mb-4" style={{ color: 'var(--accent-light)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-xl font-semibold animate-pulse"> Connecting to Node... </p>
      </div> );
  }

  if (!lnc) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4" style={{ background: darkMode ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #c7d2fe 0%, #ede9fe 100%)', color: 'var(--text-primary)' }}>
        <div className="absolute top-4 right-4"> <button onClick={toggleDarkMode} className="p-2 rounded-full transition-colors duration-200" style={{ background: darkMode ? '#ffffff20' : '#00000020' }}> {darkMode ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>} </button> </div>
        <img src="/favicon.png" alt="Senfina TapVolt Logo" className="w-24 h-24 mb-6" />
        <div className="text-center mb-8"> <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tighter" style={{ color: darkMode ? '#ffffff' : '#1e293b', textShadow: darkMode ? '0 2px 10px rgba(99, 102, 241, 0.5)' : '0 2px 5px rgba(0, 0, 0, 0.1)' }}> Senfina TapVolt </h1> <p className="text-lg md:text-xl max-w-xl leading-relaxed mx-auto" style={{ color: darkMode ? '#b4b4b4' : '#4b5563' }}> Connect your LNC-enabled node. </p> </div>
        <div className="bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-10 w-full max-w-md transition-all duration-300" style={{ background: darkMode ? 'rgba(30, 30, 40, 0.7)' : 'rgba(255, 255, 255, 0.85)', boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}` }}>
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>Connect Your Node</h2>
          <form onSubmit={handleConnect}>
            <div className="mb-5">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="pairingPhrase">LNC Pairing Phrase</label>
              <textarea id="pairingPhrase" className="w-full px-4 py-3 rounded-lg transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`, boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)' }} placeholder="Enter pairing phrase..." value={pairingPhrase} onChange={(e) => setPairingPhrase(e.target.value)} required rows="4" disabled={isConnecting} />
            </div>
            <button type="submit" className="w-full py-3 px-4 rounded-lg font-bold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: `linear-gradient(135deg, var(--accent-light), var(--accent-dark))`, boxShadow: darkMode ? '0 4px 12px rgba(79, 70, 229, 0.3)' : '0 4px 12px rgba(79, 70, 229, 0.2)' }} disabled={isConnecting}> {isConnecting ? 'Connecting...' : 'Connect with LNC'} </button>
          </form>
          {connectionError && ( <div className="mt-6 p-4 rounded-lg text-center text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}> {connectionError} </div> )}
          <div className="mt-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-sm">Powered by Lightning Node Connect</p>
            <p className="text-xs mt-2">Need help? <a href="https://docs.lightning.engineering/lightning-network-tools/lightning-node-connect/overview" target="_blank" rel="noopener noreferrer" className="ml-1 transition-colors duration-200" style={{ color: 'var(--accent-light)' }}>Documentation</a></p>
          </div>
        </div>
        <div className="absolute bottom-6 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>© {new Date().getFullYear()} Senfina TapVolt Demo</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300 p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <button onClick={toggleDarkMode} className="fixed top-4 right-4 z-50 p-2 rounded-full transition-colors duration-200" style={{ background: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
         {darkMode ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
      </button>

      <div className="max-w-6xl mx-auto rounded-2xl shadow-xl transition-all duration-300" style={{ backgroundColor: 'var(--bg-secondary)', boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.01)'}` }}>
        <header className="p-6 border-b transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4"> <img src="/favicon.png" alt="Logo" className="w-10 h-10" /> <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Senfina TapVolt</h1> </div>
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
                  <form onSubmit={mintAsset} className="rounded-xl transition-colors duration-300 p-6" style={{ backgroundColor: 'var(--form-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                    {/* Asset Name */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetName">Asset Name</label>
                      <input id="mintAssetName" className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="text" placeholder="e.g., MyToken" value={mintAssetName} onChange={(e) => setMintAssetName(e.target.value)} required disabled={isMinting} />
                    </div>
                    {/* Asset Amount */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetAmount">Amount (Units)</label>
                      <input id="mintAssetAmount" className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="number" placeholder="e.g., 1000" value={mintAssetAmount} onChange={(e) => setMintAssetAmount(e.target.value)} min="1" required disabled={isMinting} />
                    </div>
                    {/* Asset Type Picker */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetTypeSelect">Asset Type</label>
                        <select
                            id="mintAssetTypeSelect"
                            className="w-full px-3 py-2 rounded-md transition-colors duration-200"
                            style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}
                            value={mintAssetType}
                            onChange={(e) => {
                                setMintAssetType(e.target.value);
                                if (e.target.value === 'NORMAL') { // Clear file if switching to normal
                                    setMintAssetFile(null);
                                    setMintAssetFilePreview(null);
                                } else { // Clear text meta if switching to collectible
                                    setMintAssetMeta('');
                                }
                            }}
                            disabled={isMinting}
                        >
                            <option value="NORMAL">Normal</option>
                            <option value="COLLECTIBLE">Collectible (Image Metadata)</option>
                        </select>
                    </div>

                    {/* Conditional Metadata Input: File for Collectible, Text for Normal */}
                    {mintAssetType === 'COLLECTIBLE' ? (
                        <div className="mb-6">
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetFile">Asset Image (Optional)</label>
                            <input
                                id="mintAssetFile"
                                className="w-full text-sm rounded-md file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:transition-colors file:duration-200 disabled:opacity-50"
                                style={{
                                    backgroundColor: 'var(--input-bg)',
                                    color: 'var(--text-primary)',
                                    border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                    '--file-bg': darkMode ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
                                    '--file-text': 'var(--text-primary)',
                                    '--file-hover-bg': darkMode ? 'rgba(255,255,255,0.2)' : '#e0e0e0',
                                }}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        if (file.size > 5 * 1024 * 1024) { // 5MB limit for example
                                            setMintAssetError("File size exceeds 5MB limit.");
                                            setMintAssetFile(null);
                                            setMintAssetFilePreview(null);
                                            e.target.value = null; // Clear the input
                                            return;
                                        }
                                        setMintAssetFile(file);
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setMintAssetFilePreview(reader.result);
                                        };
                                        reader.readAsDataURL(file);
                                        setMintAssetError(null); // Clear previous errors
                                    } else {
                                        setMintAssetFile(null);
                                        setMintAssetFilePreview(null);
                                    }
                                }}
                                disabled={isMinting}
                            />
                            {mintAssetFilePreview && (
                                <div className="mt-3 border rounded-md p-2 inline-block" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-bg)' }}>
                                    <img src={mintAssetFilePreview} alt="Preview" className="max-w-xs max-h-32 rounded" />
                                </div>
                            )}
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Image data will be stored as a Data URL string within OPAQUE metadata. Keep file sizes reasonable.</p>
                        </div>
                    ) : (
                        <div className="mb-6">
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="mintAssetMeta">Metadata (Optional Text)</label>
                            <input
                                id="mintAssetMeta"
                                className="w-full px-3 py-2 rounded-md transition-colors duration-200"
                                style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}
                                type="text"
                                placeholder="e.g., Asset description"
                                value={mintAssetMeta}
                                onChange={(e) => setMintAssetMeta(e.target.value)}
                                disabled={isMinting}
                            />
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Stored as OPAQUE metadata.</p>
                        </div>
                    )}

                    <button className="w-full py-2 px-4 rounded-md font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] text-white" style={{ background: `linear-gradient(135deg, var(--accent-light), var(--accent-dark))`, boxShadow: darkMode ? '0 4px 12px rgba(79, 70, 229, 0.3)' : '0 4px 12px rgba(79, 70, 229, 0.2)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} type="submit" disabled={isMinting}>
                      {isMinting ? 'Adding to Batch...' : 'Add Asset to Batch'}
                    </button>
                    {mintAssetError && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}>{mintAssetError}</div>}
                    {mintAssetSuccess && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}` }}>{mintAssetSuccess}</div>}
                  </form>
                </section>

                {/* Pending Batch Section */}
                 {batchAssets.length > 0 && (
                   <section className="rounded-xl p-6 transition-colors duration-300" style={{ backgroundColor: 'var(--batch-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--batch-border)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                    <h3 className="text-xl font-bold mb-4" style={{ color: darkMode ? '#93c5fd' : '#1e40af' }}>Pending Mint Batch</h3>
                    <div className="max-h-60 overflow-y-auto pr-2 mb-4 space-y-2">
                      {batchAssets.flatMap((batch, batchIndex) =>
                        batch.map((asset, assetIndex) => (
                          <div key={`${batchIndex}-${assetIndex}`} className="p-3 rounded-lg transition-colors duration-200" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`, boxShadow: darkMode ? '0 2px 5px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{asset.name}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{asset.amount} units</span>
                            </div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                              Type: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetType, asset.assetType)}</span> |
                              Version: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetVersion, asset.assetVersion)}</span>
                            </div>
                            {asset.assetMeta && asset.assetMeta.startsWith('data:image') && (
                                <img src={asset.assetMeta} alt="Batch Asset Preview" className="mt-2 max-h-16 rounded border" style={{ borderColor: 'var(--border-color)' }} />
                            )}
                            {asset.assetMeta && !asset.assetMeta.startsWith('data:image') && <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }} title={asset.assetMeta}>Meta: {asset.assetMeta}</p>}
                          </div>
                        ))
                      )}
                    </div>
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
                   {assets.length > 0 ? (
                     <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2">
                       {assets.map((item, index) => {
                          const typeNum = item.assetGenesis.assetType; // This is the numeric type
                          const typeName = getEnumName(taprpc?.AssetType, typeNum); // Get string name like "NORMAL" or "COLLECTIBLE"
                          const ver = getEnumName(taprpc?.AssetVersion, item.assetGenesis?.version ?? item.version);
                          const id = item.assetGenesis?.assetIdStr || item.assetGenesis?.assetId || 'N/A';
                          return (
                            <div key={index} className="rounded-lg p-4 transition-all duration-300 transform hover:scale-[1.01]" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`, boxShadow: darkMode ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                              <p className="font-semibold mb-2 truncate" style={{ color: 'var(--text-primary)' }} title={item.assetGenesis?.name}>{item.assetGenesis?.name || 'Unnamed Asset'}</p>
                              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <p>Amount: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.amount?.toString() || 'N/A'}</span></p>
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>Type: {typeName}</span>
                                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>Version: {ver}</span>
                                </div>
                                <p className="text-xs break-all pt-1" title={id}>ID: <span style={{ fontFamily: 'monospace' }}>{id}</span></p>
                                <p className="text-xs break-all">Genesis Pt: {item.assetGenesis?.genesisPoint || 'N/A'}</p>
                                <p className="text-xs">Anchor Height: <span style={{ fontFamily: 'monospace' }}>{item.chainAnchor?.blockHeight || 'Unconfirmed'}</span></p>
                              </div>
                              {/* Display decoded metadata for COLLECTIBLE assets */}
                              {typeName === 'COLLECTIBLE' && item.decodedMeta && (
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                  <p className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Decoded Metadata</p>
                                  {item.decodedMeta.startsWith('data:image') ?
                                    <img src={item.decodedMeta} alt="Asset Preview" className="max-w-full h-auto rounded border" style={{ borderColor: 'var(--border-color)' }} onError={(e) => { e.target.style.display='none'; const nextEl = e.target.nextElementSibling; if (nextEl && nextEl.tagName === 'PRE') nextEl.style.display='block'; }}/>
                                    : null // Only show img if it's a data URI for an image
                                  }
                                  {/* Fallback to show raw metadata if not an image or image fails to load */}
                                  <pre className="text-xs p-2 rounded overflow-auto max-h-28 border" style={{ display: (item.decodedMeta.startsWith('data:image')) ? 'none' : 'block', backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                                    {item.decodedMeta.length > 200 ? item.decodedMeta.substring(0,200) + "..." : item.decodedMeta}
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
                 {assets?.length > 0 && (
                   <section>
                     <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Fund Asset Channel</h2>
                     <form onSubmit={fundChannel} className="rounded-xl p-6 transition-colors duration-300" style={{ backgroundColor: 'var(--form-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
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
                        {fundChannelError && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}>{fundChannelError}</div>}
                        {fundChannelSuccess && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}` }}>{fundChannelSuccess}</div>}
                     </form>
                   </section>
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
        /* Style for file input button */
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