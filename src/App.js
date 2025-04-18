import React, { useState, useEffect, useCallback, useContext } from 'react';
import './App.css';
import { Buffer } from 'buffer';
import LNC, { taprpc } from '@lightninglabs/lnc-web';
import { StoreProvider, StoreContext } from './context/StoreContext';
import useLnc from './hooks/useLnc';
import LncSessionControls from './components/LncSessionControls';

// Define expected numeric values based on .proto definitions
const ASSET_TYPE_NORMAL_NUM = 0;
const ASSET_TYPE_COLLECTIBLE_NUM = 1;
const ASSET_VERSION_V0_NUM = 0;
const META_TYPE_OPAQUE_NUM = 0;

function App() {
  const root = useContext(StoreContext);
  const auth = root.auth;

  // Use the new useLnc session hook
  const lncState = useLnc();

  useEffect(() => {
    auth.init();
  }, [auth]);

  const [lnc, setLNC] = useState(null); // Stores the *active* LNC instance
  const [isConnected, setIsConnected] = useState(false); // Track connection status explicitly
  const [assets, setAssets] = useState([]);
  const [batchAssets, setBatchAssets] = useState([]);
  const [nodeChannels, setChannels] = useState([]);
  const [nodeInfo, setNodeInfo] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // LNC Connection Form State
  const [pairingPhrase, setPairingPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Track initial load state

  // MobX AuthStore state
  // Hardcoded phrase for rapid testing
  const [loginInput, setLoginInput] = useState('buffalo very rotate mind hobby embrace supreme drive target recycle');
  const [loginError, setLoginError] = useState('');

  // Show login form if not authenticated
  if (!auth.authenticated) {
    // Auto-submit login on mount
    useEffect(() => {
      let cancelled = false;
      (async () => {
        setLoginError('');
        try {
          await auth.login(loginInput);
        } catch (err) {
          if (!cancelled) setLoginError(err.message || 'Login failed');
        }
      })();
      return () => { cancelled = true; };
    }, [auth, loginInput]);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <form className="bg-white p-6 rounded shadow-md" onSubmit={async e => {
          e.preventDefault();
          setLoginError('');
          try {
            await auth.login(loginInput);
          } catch (err) {
            setLoginError(err.message || 'Login failed');
          }
        }}>
          <h2 className="mb-4 font-bold text-lg">Connect with Pairing Phrase</h2>
          <input
            type="text"
            value={loginInput}
            onChange={e => setLoginInput(e.target.value)}
            className="border p-2 rounded w-full mb-2"
            placeholder="Enter pairing phrase or password"
            required
          />
          <button className="w-full py-2 px-4 rounded bg-blue-600 text-white font-bold" type="submit">Connect</button>
          {loginError && <div className="mt-2 text-red-600">{loginError}</div>}
          {auth.errors.main && <div className="mt-2 text-red-600">{auth.errors.main}</div>}
        </form>
      </div>
    );
  }

  // Mint Asset Form State
  const [mintAssetName, setMintAssetName] = useState('');
  const [mintAssetAmount, setMintAssetAmount] = useState('');
  const [mintAssetMeta, setMintAssetMeta] = useState('');
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

  // --- LNC Session Controls ---
  // Show session controls at the top of the main app UI

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  // Apply dark mode styles
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

  // Helper function to attach listeners to a confirmed LNC instance
  const attachLncListeners = useCallback((lncInstance) => {
    if (!lncInstance || typeof lncInstance.on !== 'function') {
        console.error("Cannot attach listeners: LNC instance is invalid or does not have an 'on' method.", lncInstance);
        // Set error state appropriate for this failure
        setConnectionError("Failed to initialize LNC event listeners.");
        setIsConnected(false); // Ensure we are marked as disconnected
        setLNC(null); // Clear potentially invalid instance
        return;
    }

    console.log("Attaching LNC event listeners...");

    // Remove previous listeners if any were attached to this specific instance object
    // Note: LNC might not expose a robust way to remove specific listeners by function reference.
    // Relying on instance replacement might be the primary cleanup mechanism.
    // lncInstance.off might not exist or work as expected.

    lncInstance.on('connected', () => {
      console.log('LNC connected event fired.');
      setIsConnected(true);
      setConnectionError(null);
    });

    lncInstance.on('disconnected', () => {
      console.log('LNC disconnected event fired.');
      setIsConnected(false);
      // setConnectionError("LNC disconnected."); // Optional: notify user
      setLNC(null); // Clear the instance on disconnect
      // Clear data
       setNodeInfo(null); setChannels([]); setAssets([]); setBatchAssets([]);
    });

    lncInstance.on('error', (error) => {
      console.error('LNC error event:', error);
      setConnectionError(`LNC runtime error: ${error?.message || 'Unknown error'}`);
      // Optionally disconnect on certain errors
      // setIsConnected(false); setLNC(null);
    });

    // Recheck readiness after attaching listeners, especially for auto-connect cases
    if (lncInstance.isReady) {
        console.log("Instance confirmed ready after attaching listeners.");
        setIsConnected(true); // Ensure state reflects readiness
    }

  }, []); // Add any state setters used inside if needed, e.g. [setIsConnected, setConnectionError, setLNC]

  // Function to attempt initialization from storage
  const attemptAutoConnect = useCallback(async () => {
      setIsInitializing(true);
      setConnectionError(null);
      console.log('Attempting to initialize LNC from storage...');
      if (!LNC) {
          console.error("LNC constructor not available.");
          setConnectionError('LNC library failed to load.');
          setIsInitializing(false);
          return;
      }
      let lncInstance;
      try {
          lncInstance = new LNC({});

          if (lncInstance.isReady) {
              console.log('LNC is ready (loaded from storage). Attaching listeners and setting active.');
              // Attach listeners *after* confirming readiness
              attachLncListeners(lncInstance);
              setLNC(lncInstance); // Set the ready instance
             // setIsConnected will be set by the listener attachment logic or 'connected' event
          } else {
              console.log('LNC is not ready from storage.');
              setLNC(null);
              setIsConnected(false);
          }
      } catch (error) {
          console.error('Failed to initialize LNC from storage:', error);
          setConnectionError('Failed to check LNC session state.');
          setLNC(null);
          setIsConnected(false);
      } finally {
          setIsInitializing(false);
      }
  }, [attachLncListeners]); // Add attachLncListeners dependency

  // Attempt auto-connect on component mount
  useEffect(() => {
      attemptAutoConnect();
      // Cleanup function
      return () => {
          if (lnc) {
              console.log("Cleaning up LNC instance on unmount.");
              // LNC doesn't have a standard way to remove all listeners ('off' might not exist/work)
              // Rely on disconnect to stop events and instance replacement for listener management
              lnc.disconnect();
          }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptAutoConnect]); // Run only once on mount

  // Handle the connection form submission (Explicit Connect)
  const handleConnect = async (event) => {
    event.preventDefault();
    if (!pairingPhrase.trim()) {
        setConnectionError("Pairing phrase cannot be empty.");
        return;
    }
    setConnectionError(null);
    setIsConnecting(true);

    console.log('Explicit connection attempt initiated...');

    // Disconnect any existing instance
    if (lnc) {
        console.log('Disconnecting previous LNC instance...');
        // Remove listeners maybe? LNC library might not support .off() reliably.
        // Rely on disconnect() and creating a new instance.
        lnc.disconnect();
        setLNC(null);
        setIsConnected(false);
    }

    let newLncInstance;
    try {
      console.log('Creating new LNC instance for connection...');
      newLncInstance = new LNC({
        pairingPhrase: pairingPhrase,
        // password: password, // Add password if using it
      });

      console.log('Attempting to connect new LNC instance...');
      await newLncInstance.connect();
      console.log('LNC connect() method resolved successfully.');

      // Attach listeners *after* successful connection
      attachLncListeners(newLncInstance);
      setLNC(newLncInstance); // Store the successfully connected instance
      setIsConnected(true); // Explicitly set connected as connect() succeeded
      setConnectionError(null);

    } catch (error) {
      console.error('LNC connection error during explicit connect:', error);
      const message = error.message || 'Failed to connect. Please check pairing phrase or proxy server.';
      setConnectionError(message);
      setIsConnected(false);
      setLNC(null);
      if (newLncInstance) {
          // Attempt cleanup even if connect failed mid-way
          newLncInstance.disconnect();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Fetch data when LNC is connected AND the instance exists
  useEffect(() => {
    if (isConnected && lnc) {
      console.log('LNC connected state is true, fetching node data...');
      getInfo();
      listChannels();
      listAssets();
      listBatches();
    } else {
      console.log('LNC disconnected or instance null, clearing data.');
      setNodeInfo(null); setChannels([]); setAssets([]); setBatchAssets([]);
    }
  }, [isConnected, lnc]); // Rerun when isConnected or lnc instance changes


  // --- Data Fetching Functions ---
  const getInfo = async () => {
    if (!lnc || !isConnected || !lnc.lnd || !lnc.lnd.lightning) { console.warn("LNC not ready for getInfo."); return; }
    console.log("Attempting to get node info...");
    try { const info = await lnc.lnd.lightning.getInfo(); setNodeInfo(info); console.log("Node Info fetched:", info); }
    catch(error) { console.error("Failed to get node info:", error); setNodeInfo(null); }
  };
  const listChannels = async () => {
    if (!lnc || !isConnected || !lnc.lnd || !lnc.lnd.lightning) { console.warn("LNC not ready for listChannels."); return; }
    console.log("Attempting to list channels...");
    try { const r = await lnc.lnd.lightning.listChannels(); setChannels(Array.isArray(r?.channels) ? r.channels : []); }
    catch (error) { console.error("Failed to list channels:", error); setChannels([]); }
  };
  const listAssets = async () => {
    if (!lnc || !isConnected || !lnc.tapd || !lnc.tapd.taprootAssets) { console.warn("LNC not ready for listAssets."); return; }
    console.log("Attempting to list assets...");
    const { taprootAssets } = lnc.tapd;
    try {
        const assetsTap = await taprootAssets.listAssets({ include_unconfirmed_mints: true });
        let assetsArr = [];
        if (assetsTap?.assets) {
            for (let asset of assetsTap.assets) {
                const assetTypeNum = asset?.assetType;
                const assetIdForMeta = asset?.assetGenesis?.assetIdStr || asset?.assetGenesis?.assetId;
                if (assetTypeNum === ASSET_TYPE_COLLECTIBLE_NUM && assetIdForMeta) {
                   try {
                     const meta = await taprootAssets.fetchAssetMeta({ asset_id_str: assetIdForMeta });
                     const decodedMeta = meta?.data ? Buffer.from(meta.data).toString('utf8') : '';
                     assetsArr.push({ ...asset, decodedMeta });
                   } catch (metaError) { console.error(`Failed fetch meta ${assetIdForMeta}:`, metaError); assetsArr.push(asset); }
                } else { assetsArr.push(asset); }
            }
        } setAssets(assetsArr);
    } catch (error) { console.error("Failed to list assets:", error); setAssets([]); }
  };
  const listBatches = async () => {
    if (!lnc || !isConnected || !lnc.tapd || !lnc.tapd.mint) { console.warn("LNC not ready for listBatches."); return; }
    console.log("Attempting to list batches...");
    const { mint } = lnc.tapd;
    try {
      const r = await mint.listBatches(); let pending = [];
      if (r?.batches) {
        for(let b of r.batches){
          if(["BATCH_STATE_PENDING", "BATCH_STATE_FROZEN", "BATCH_STATE_COMMITTED"].includes(b?.batch?.state)) {
             const assets = b.batch.assets.map(a => ({ name: a.name, amount: a.amount?.toString(), assetVersion: a.assetVersion, assetType: a.assetType, assetMeta: a.assetMeta?.data ? Buffer.from(a.assetMeta.data).toString('utf8') : '' }));
             pending.push(...assets); // Directly add assets to the flattened list
          } } } setBatchAssets(pending);
    } catch (error) { console.error("Failed list batches:", error); setBatchAssets([]); }
  };

  // --- Minting and Batch Functions ---
  const mintAsset = async (event) => {
    event.preventDefault();
    if (!lnc || !isConnected || !lnc.tapd?.mint) { setMintAssetError("LNC not connected or Mint service unavailable."); return; }
    setMintAssetError(null); setMintAssetSuccess(null); setIsMinting(true);
    const name = mintAssetName.replace(/[\r\n]+/g, '').trim(); if (!name) { setMintAssetError("Name required."); setIsMinting(false); return; }
    const amount = parseInt(mintAssetAmount, 10); if (isNaN(amount) || amount <= 0) { setMintAssetError("Invalid amount."); setIsMinting(false); return; }
    let metaB64 = ""; const meta = mintAssetMeta.trim();
    if (meta) { try { metaB64 = Buffer.from(meta.replace(/[\r\n]+/g, ''), 'utf8').toString('base64'); } catch (e) { setMintAssetError("Meta encode fail."); setIsMinting(false); return; }}
    try {
      const req = { asset: { asset_version: ASSET_VERSION_V0_NUM, asset_type: ASSET_TYPE_NORMAL_NUM, name, amount: amount.toString(), asset_meta: { data: metaB64, type: META_TYPE_OPAQUE_NUM }}, short_response: false };
      const res = await lnc.tapd.mint.mintAsset(req);
      if (res?.pendingBatch?.batchKey) {
        setMintAssetSuccess(`Added to batch: ${Buffer.from(res.pendingBatch.batchKey).toString('hex')}`);
        setMintAssetName(''); setMintAssetAmount(''); setMintAssetMeta(''); listBatches();
      } else { setMintAssetError(res?.error || 'Mint fail: Unexpected response.'); }
    } catch (e) { console.error('Mint error:', e); setMintAssetError(`Mint fail: ${e.message || 'Unknown'}`); }
    finally { setIsMinting(false); }
  };
  const finalizeBatch = async () => {
    if (!lnc || !isConnected || !lnc.tapd?.mint) { setMintAssetError("LNC not connected or Mint service unavailable."); return; }
    setIsMinting(true); setMintAssetError(null); setMintAssetSuccess(null);
    try {
      const fee = 10; // Example
      const res = await lnc.tapd.mint.finalizeBatch({ fee_rate: fee });
      setMintAssetSuccess(`Batch finalize initiated. TXID: ${res?.batch?.batchTxid || 'N/A'}`);
      setBatchAssets([]); setTimeout(listAssets, 3000);
    } catch (e) { console.error("Finalize error:", e); setMintAssetError(`Finalize fail: ${e.message || 'Unknown'}`); }
    finally { setIsMinting(false); }
  };
  const cancelBatch = async () => {
     if (!lnc || !isConnected || !lnc.tapd?.mint) { setMintAssetError("LNC not connected or Mint service unavailable."); return; }
     setIsMinting(true); setMintAssetError(null); setMintAssetSuccess(null);
     try { await lnc.tapd.mint.cancelBatch({}); setMintAssetSuccess("Batch cancelled."); setBatchAssets([]); }
     catch (e) { console.error("Cancel error:", e); setMintAssetError(`Cancel fail: ${e.message || 'Unknown'}`); }
     finally { setIsMinting(false); }
  };

  // --- Channel Funding Function ---
  const fundChannel = async (event) => {
    event.preventDefault();
     if (!lnc || !isConnected || !lnc.tapd?.tapChannels) { setFundChannelError("LNC not connected or Channel service unavailable."); return; }
     setFundChannelError(null); setFundChannelSuccess(null); setIsFunding(true);
    const amt = parseInt(assetAmount, 10); const fee = parseInt(feeRateSatPerVbyte, 10);
    if (isNaN(amt) || amt <= 0) { setFundChannelError("Bad Amount."); setIsFunding(false); return; }
    if (isNaN(fee) || fee <= 0) { setFundChannelError("Bad Fee."); setIsFunding(false); return; }
    if (!assetId?.trim()) { setFundChannelError("Asset ID needed."); setIsFunding(false); return; }
    if (!peerPubkey?.trim()) { setFundChannelError("Peer Pubkey needed."); setIsFunding(false); return; }
    try {
      const assetIdBytes = Buffer.from(assetId.trim(), 'hex'); const peerBytes = Buffer.from(peerPubkey.trim(), 'hex');
      const req = { asset_amount: amt.toString(), asset_id: assetIdBytes, peer_pubkey: peerBytes, fee_rate_sat_per_vbyte: fee };
      const res = await lnc.tapd.tapChannels.fundChannel(req);
      setFundChannelSuccess(`Funding TX: ${res?.txid || 'N/A'}, Index: ${res?.outputIndex}`);
      setAssetAmount(''); setAssetId(''); setPeerPubkey(''); setFeeRateSatPerVbyte('');
    } catch (e) { console.error("Fund error:", e); setFundChannelError(e.message || "Fund fail."); }
    finally { setIsFunding(false); }
  };

  // --- Render Logic ---
  const getEnumName = (enumObj, value) => {
    if (value === undefined || value === null || !enumObj) return 'N/A';
    for (const key in enumObj) { if (Object.prototype.hasOwnProperty.call(enumObj, key) && enumObj[key] === value) return key; }
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(enumObj, value)) return value;
    return `UNKNOWN (${value})`;
  };

   if (isInitializing || isConnecting) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 flex justify-center items-center"> <img src="/favicon.png" alt="Loading Logo" className="w-16 h-16" /> </div>
          <div className="absolute inset-0 rounded-full border-t-4 border-accent-500 animate-spin" style={{ borderColor: 'var(--accent-light) transparent transparent transparent' }}></div>
        </div> <p className="text-xl font-semibold animate-pulse"> {isInitializing ? 'Initializing...' : 'Connecting...'} </p>
      </div> );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4" style={{ background: darkMode ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #c7d2fe 0%, #ede9fe 100%)', color: 'var(--text-primary)' }}>
        <div className="absolute top-4 right-4"> <button onClick={toggleDarkMode} className="p-2 rounded-full transition-colors duration-200" style={{ background: darkMode ? '#ffffff20' : '#00000020' }}> {darkMode ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>} </button> </div>
        <div className="relative w-32 h-32 mb-6 animate-float"> <div className="absolute inset-0 flex justify-center items-center"> <img src="/favicon.png" alt="Taproot Assets Logo" className="w-full h-full p-2" /> </div> <div className="absolute -inset-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full blur opacity-30 animate-pulse-slow"></div> </div>
        <div className="text-center mb-8"> <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tighter" style={{ color: darkMode ? '#ffffff' : '#1e293b', textShadow: darkMode ? '0 2px 10px rgba(99, 102, 241, 0.5)' : '0 2px 5px rgba(0, 0, 0, 0.1)' }}> Taproot Assets </h1> <p className="text-lg md:text-xl max-w-xl leading-relaxed mx-auto" style={{ color: darkMode ? '#b4b4b4' : '#4b5563' }}> Connect your node to mint, transfer, and manage assets. </p> </div>
        <div className="bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-10 w-full max-w-md transition-all duration-300" style={{ background: darkMode ? 'rgba(30, 30, 40, 0.7)' : 'rgba(255, 255, 255, 0.85)', boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}` }}>
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>Connect Your Node</h2>
          <form onSubmit={handleConnect}>
            <div className="mb-5"> <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>LNC Pairing Phrase</label> <textarea className="w-full px-4 py-3 rounded-lg transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`, boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)' }} placeholder="Enter pairing phrase..." value={pairingPhrase} onChange={(e) => setPairingPhrase(e.target.value)} required rows="4" disabled={isConnecting} /> </div>
            <button type="submit" className="w-full py-3 px-4 rounded-lg font-bold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: `linear-gradient(135deg, var(--accent-light), var(--accent-dark))`, boxShadow: darkMode ? '0 4px 12px rgba(79, 70, 229, 0.3)' : '0 4px 12px rgba(79, 70, 229, 0.2)' }} disabled={isConnecting}> {isConnecting ? 'Connecting...' : 'Connect with Lightning'} </button>
          </form>
          {connectionError && ( <div className="mt-6 p-4 rounded-lg text-center text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}> {connectionError} </div> )}
           <div className="mt-8 text-center" style={{ color: 'var(--text-secondary)' }}> <p className="text-sm">Powered by Lightning Node Connect</p> <p className="text-xs mt-2">Need help? <a href="https://docs.lightning.engineering/lightning-network-tools/lightning-node-connect/overview" target="_blank" rel="noopener noreferrer" className="ml-1 transition-colors duration-200" style={{ color: 'var(--accent-light)' }}>Documentation</a></p> </div>
        </div> <div className="absolute bottom-6 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>© {new Date().getFullYear()} Taproot Assets Demo</div>
      </div> );
  }

  // --- Main Application UI (Rendered when isConnected is true) ---
  return (
    <div className="min-h-screen transition-colors duration-300 p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <button onClick={toggleDarkMode} className="fixed top-4 right-4 z-50 p-2 rounded-full transition-colors duration-200" style={{ background: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}> {darkMode ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>} </button>
      <div className="max-w-6xl mx-auto rounded-2xl shadow-xl transition-all duration-300" style={{ backgroundColor: 'var(--bg-secondary)', boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.01)'}` }}>
        <header className="p-6 border-b transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4"> <div className="relative w-12 h-12"><div className="absolute inset-0 flex justify-center items-center"><img src="/favicon.png" alt="Logo" className="w-full h-full" /></div><div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full blur opacity-30"></div></div> <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Taproot Assets</h1> </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}> <div>Alias: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeInfo?.alias || '...'}</span></div> <div>Network: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeInfo?.network || '...'}</span></div> <div>Height: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeInfo?.blockHeight || '...'}</span></div> <div>Synced: <span className="font-medium" style={{ color: nodeInfo?.syncedToChain ? '#10b981' : '#ef4444' }}>{typeof nodeInfo?.syncedToChain === 'boolean' ? (nodeInfo.syncedToChain ? 'Yes' : 'No') : '...'}</span></div> <div>Channels: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{nodeChannels?.length ?? '...'}</span></div> <div>Assets: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{assets?.length ?? '...'}</span></div> </div>
          </div> </header>
        <div className="p-6"> <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="space-y-8">
                <section> <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Mint New Asset</h2> <form onSubmit={mintAsset} className="rounded-xl transition-colors duration-300 p-6" style={{ backgroundColor: 'var(--form-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                    <div className="mb-4"><label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Asset Name</label><input className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="text" placeholder="e.g., MyToken" value={mintAssetName} onChange={(e) => setMintAssetName(e.target.value)} required disabled={isMinting} /></div>
                    <div className="mb-4"><label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Amount (Units)</label><input className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="number" placeholder="e.g., 1000" value={mintAssetAmount} onChange={(e) => setMintAssetAmount(e.target.value)} min="1" required disabled={isMinting} /></div>
                    <div className="mb-6"><label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Metadata (Optional)</label><input className="w-full px-3 py-2 rounded-md transition-colors duration-200" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }} type="text" placeholder="e.g., Asset description" value={mintAssetMeta} onChange={(e) => setMintAssetMeta(e.target.value)} disabled={isMinting} /><p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Stored as OPAQUE metadata.</p></div>
                    <button className="w-full py-2 px-4 rounded-md font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] text-white" style={{ background: `linear-gradient(135deg, var(--accent-light), var(--accent-dark))`, boxShadow: darkMode ? '0 4px 12px rgba(79, 70, 229, 0.3)' : '0 4px 12px rgba(79, 70, 229, 0.2)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} type="submit" disabled={isMinting}>{isMinting ? 'Adding to Batch...' : 'Add Asset to Batch'}</button>
                    {mintAssetError && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}` }}>{mintAssetError}</div>}
                    {mintAssetSuccess && <div className="mt-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}` }}>{mintAssetSuccess}</div>}
                </form> </section>
                 {batchAssets.length > 0 && ( <section className="rounded-xl p-6 transition-colors duration-300" style={{ backgroundColor: 'var(--batch-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--batch-border)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                    <h3 className="text-xl font-bold mb-4" style={{ color: darkMode ? '#93c5fd' : '#1e40af' }}>Pending Mint Batch</h3>
                    <div className="max-h-60 overflow-y-auto pr-2 mb-4 space-y-2"> {batchAssets.map((asset, index) => (
                        <div key={index} className="p-3 rounded-lg transition-colors duration-200" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--border-color)'}`, boxShadow: darkMode ? '0 2px 5px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.05)' }}> <div className="flex justify-between items-center"><span className="font-medium" style={{ color: 'var(--text-primary)' }}>{asset.name}</span><span style={{ color: 'var(--text-secondary)' }}>{asset.amount} units</span></div> <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Type: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetType, asset.assetType)}</span> | Version: <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--badge-bg)' }}>{getEnumName(taprpc?.AssetVersion, asset.assetVersion)}</span></div> {asset.assetMeta && <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }} title={asset.assetMeta}>Meta: {asset.assetMeta}</p>} </div> ))}
                    </div> <div className="flex flex-col sm:flex-row gap-3"> <button className="flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'white', color: 'var(--text-primary)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'var(--border-color)'}`, boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} onClick={cancelBatch} disabled={isMinting}>Cancel Batch</button> <button className="flex-1 py-2 px-4 rounded-md font-medium text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: darkMode ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(16, 185, 129, 0.2)', opacity: isMinting ? '0.7' : '1', cursor: isMinting ? 'not-allowed' : 'pointer' }} onClick={finalizeBatch} disabled={isMinting}>{isMinting ? 'Processing...' : 'Finalize Batch'}</button> </div>
                 </section> )}
      </div>
      <style jsx>{` @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } } @keyframes pulse-slow { 0% { opacity: 0.2; } 50% { opacity: 0.3; } 100% { opacity: 0.2; } } .animate-float { animation: float 4s ease-in-out infinite; } .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; } `}</style>
    </div>
  );
}

// ... rest of the code ...
// Wrap the App in StoreProvider for context
const AppWithProvider = () => (
  <StoreProvider>
    <App />
  </StoreProvider>
);

export default AppWithProvider;