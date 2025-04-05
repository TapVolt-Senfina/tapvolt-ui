import React, { useState, useEffect } from 'react';
import './App.css';
import { Buffer } from 'buffer';
// Correct: Use default import for LNC and named import for taprpc
import LNC, { taprpc } from '@lightninglabs/lnc-web';

// Define expected numeric values based on .proto definitions
const ASSET_TYPE_NORMAL_NUM = 0;
const ASSET_TYPE_COLLECTIBLE_NUM = 1;
const ASSET_VERSION_V0_NUM = 0; // Use V0 based on tapcli success
const ASSET_VERSION_V1_NUM = 1;
// const META_TYPE_OPAQUE_NUM = 0; // Not needed for this test


function App() {
  const [lnc, setLNC] = useState(null); // Initialize with null
  const [assets, setAssets] = useState([]);
  const [nodeChannels, setChannels] = useState([]);
  const [nodeInfo, setNodeInfo] = useState(null); // Initialize with null

  // LNC Connection Form State
  const [pairingPhrase, setPairingPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false); // Add connecting state

    // Mint Asset Form State - Keep inputs but values might be ignored for testing
  const [mintAssetName, setMintAssetName] = useState('');
  const [mintAssetAmount, setMintAssetAmount] = useState('');
  const [mintAssetMeta, setMintAssetMeta] = useState('');
  const [mintAssetError, setMintAssetError] = useState(null);
  const [mintAssetSuccess, setMintAssetSuccess] = useState(null);
  const [isMinting, setIsMinting] = useState(false); // Add minting state

  const handleConnect = async (event) => {
    event.preventDefault();
    setConnectionError(null);
    setIsConnecting(true); // Set connecting state
    try {
      // Verify LNC is available before constructing
      if (!LNC) {
          throw new Error("LNC constructor is not available. Check library import and installation.");
      }
      console.log('Attempting to instantiate LNC...');
      const lncInstance = new LNC({
        pairingPhrase: pairingPhrase,
        password: password,
        // Optionally add other configuration like workerPath if needed
      });
      console.log('LNC instance created, attempting to connect...');
      await lncInstance.connect();
      console.log('LNC connected successfully.');
      setLNC(lncInstance);
    } catch (error) {
      console.error('LNC connection error:', error);
      setConnectionError(error.message || 'Failed to connect. Please check your credentials or LNC setup.');
    } finally {
      setIsConnecting(false); // Reset connecting state
    }
  };

  useEffect(() => {
    // Fetch data only if LNC object exists and seems ready
    if (lnc && lnc.isReady) {
      console.log('LNC ready, fetching node data...');
      getInfo();
      listChannels();
      listAssets();
    }
  }, [lnc]); // Rerun when lnc state changes

  const getInfo = async () => {
    if (!lnc || !lnc.lnd || !lnc.lnd.lightning) {
        console.error("LNC or LND lightning service not initialized for getInfo");
        return;
    }
    const { lightning } = lnc.lnd;
    try {
        const info = await lightning.getInfo();
        setNodeInfo(info);
        console.log("Node Info:", info);
    } catch(error) {
        console.error("Failed to get node info:", error);
        setNodeInfo(null); // Reset on error
    }
  };

  const listChannels = async () => {
    if (!lnc || !lnc.lnd || !lnc.lnd.lightning) {
        console.error("LNC or LND lightning service not initialized for listChannels");
        return;
    }
    const { lightning } = lnc.lnd;
    try {
        const channelsResponse = await lightning.listChannels();
        console.log("Channels Response:", channelsResponse);
        // Ensure channelsResponse.channels is an array before setting
        setChannels(Array.isArray(channelsResponse?.channels) ? channelsResponse.channels : []);
    } catch (error) {
        console.error("Failed to list channels:", error);
        setChannels([]); // Set to empty array on error
    }
  };

  const listAssets = async () => {
    if (!lnc || !lnc.tapd || !lnc.tapd.taprootAssets) {
        console.error("LNC or Taproot Assets service not initialized for listAssets");
        return;
    }
    const { taprootAssets } = lnc.tapd;
    try {
        // Add necessary flags if needed, like include_unconfirmed_mints: true
        const assetsTap = await taprootAssets.listAssets({ include_unconfirmed_mints: true });
        console.log("Assets Response:", assetsTap);
        let assetsArr = [];
        if (assetsTap && Array.isArray(assetsTap.assets)) {
            for (let asset of assetsTap.assets) {
                // Safely access assetType and assetIdStr
                const assetTypeNum = asset?.assetType; // This might be the number or string from API
                // Prefer assetIdStr if available, otherwise use assetId
                const assetIdForMeta = asset?.assetGenesis?.assetIdStr || asset?.assetGenesis?.assetId;

                // Check if the type matches the expected numeric value for COLLECTIBLE
                if (assetTypeNum === ASSET_TYPE_COLLECTIBLE_NUM && assetIdForMeta) {
                   try {
                     const meta = await taprootAssets.fetchAssetMeta({ asset_id_str: assetIdForMeta });
                     if (meta && meta.data) {
                       // Attempt to decode as UTF8, adjust if meta can be binary/image data directly
                       const decodedMeta = Buffer.from(meta.data).toString('utf8');
                       assetsArr.push({ ...asset, decodedMeta });
                     } else {
                       assetsArr.push(asset); // Add asset even if meta fetch fails or has no data
                     }
                   } catch (metaError) {
                      console.error(`Failed to fetch meta for asset ${assetIdForMeta}:`, metaError);
                      assetsArr.push(asset); // Add asset even if meta fetch fails
                   }
                } else {
                    assetsArr.push(asset);
                }
            }
        }
        setAssets(assetsArr);
    } catch (error) {
        console.error("Failed to list assets:", error);
        setAssets([]); // Set to empty array on error
    }
  };


  const mintAsset = async (event) => {
    event.preventDefault();
    setMintAssetError(null);
    setMintAssetSuccess(null);
    setIsMinting(true); // Set minting state

    // Basic check if lnc services exist
    if (!lnc || !lnc.tapd || !lnc.tapd.mint) {
        setMintAssetError("LNC or Taproot Mint service not initialized.");
        setIsMinting(false);
        return;
    }

    // *** Use Hardcoded name and ensure amount is valid ***
    const hardcodedName = "test1";
    console.log(`Using hardcoded name: "${hardcodedName}"`);

    const amount = parseInt(mintAssetAmount, 10);
    if (isNaN(amount) || amount <= 0) {
        setMintAssetError("Invalid amount provided. Must be a positive number.");
        setIsMinting(false);
        return;
    }

    try {
      const { mint } = lnc.tapd;

      // *** Build the ABSOLUTE MINIMUM request, removing asset_meta ***
      const encoder = new TextEncoder();

      const request = {
        asset: {
          asset_version: ASSET_VERSION_V0_NUM, // Use 0 (V0) based on tapcli
          asset_type: ASSET_TYPE_NORMAL_NUM,   // Use 0 (NORMAL)
          name: hardcodedName,                // Use the hardcoded name
          amount: amount.toString(),          // Send amount as string
          assetMeta: {
            data: new Uint8Array(1)
          }
        },
        short_response: false,
      };

      console.log("Minting request (JS object, absolute minimum):", request);
      console.log("Minting request (JSON):", JSON.stringify(request, null, 2));

      const response = await mint.mintAsset(request);
      console.log("Minting response:", response);

       // Check response structure carefully based on actual successful response
      if (response && response.pendingBatch && response.pendingBatch.batchKey) {
        const batchKeyHex = Buffer.from(response.pendingBatch.batchKey).toString('hex');
        setMintAssetSuccess(
          `Asset minting initiated. Batch key: ${batchKeyHex}`
        );
        // Don't clear name field since it wasn't used for the request value
        // setMintAssetName('');
        setMintAssetAmount('');
        setMintAssetMeta(''); // Clear metadata field
        // Refresh asset list after a short delay
        setTimeout(listAssets, 2000);
      } else {
        // Check if there's an error field in the response itself
        const backendError = response?.error || 'Unexpected response structure from server.';
        console.error("Mint asset response invalid:", response);
        setMintAssetError(`Failed to initiate asset minting. ${backendError}`);
      }
    } catch (error) {
      console.error('Mint asset error:', error);
      const errorMsg = error.message || 'Failed to mint asset. Unknown error.';
      // Try to extract more details from the error object
      const details = error.details || (error.toString ? error.toString() : 'No details available');
      setMintAssetError(`Minting failed: ${errorMsg} (Details: ${details})`);
    } finally {
        setIsMinting(false); // Reset minting state
    }
  };


  // --- Render Logic ---

  // Loading state while connecting
   if (isConnecting) {
       return <div className="flex justify-center items-center min-h-screen text-gray-600">Connecting to LNC...</div>;
   }

  // Render Connection form if LNC is not initialized/connected
  if (!lnc) {
      return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100">
            <div className="text-center mb-8 px-4">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-4 tracking-tight">
                Unlock the Power of Taproot Assets
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl leading-relaxed mx-auto">
                Seamlessly mint, transfer, and manage Bitcoin-based assets with the speed and efficiency of the Lightning Network.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-2xl p-8 md:p-12 max-w-md w-full mx-4">
              <div className="mb-6 text-center">
                <p className="text-lg font-semibold text-gray-700 mb-4">
                  Connect your Lightning Node:
                </p>
              </div>
              <form onSubmit={handleConnect}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pairingPhrase">
                    Pairing Phrase (LNC)
                  </label>
                  <input
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    id="pairingPhrase"
                    type="text"
                    placeholder="Enter your pairing phrase"
                    value={pairingPhrase}
                    onChange={(e) => setPairingPhrase(e.target.value)}
                    required
                    disabled={isConnecting}
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                    Password
                  </label>
                  <input
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                    id="password"
                    type="password"
                    placeholder="******************"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isConnecting}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <button
                    className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full transition duration-150 ease-in-out ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    type="submit"
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect with LNC'}
                  </button>
                </div>
                {connectionError && (
                  <div className="mt-4 text-red-600 text-sm text-center bg-red-100 p-3 rounded border border-red-300">
                    {connectionError}
                  </div>
                )}
              </form>
              <div className="mt-8 text-center">
                <p className="text-sm text-gray-500">
                  Powered by Lightning Node Connect.
                </p>
                 <p className="text-xs text-gray-400 mt-2">
                    Ensure LNC is running and accessible. Need help?
                    <a href="https://docs.lightning.engineering/lightning-network-tools/lightning-node-connect/installation" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
                        LNC Docs
                    </a>
                 </p>
              </div>
            </div>

            <div className="mt-12 text-center px-4">
              <p className="text-xs text-gray-400">
                © {new Date().getFullYear()} Taproot Assets Demo. All rights reserved.
              </p>
            </div>
          </div>
      );
  }

  // --- Main App Content ---
  // Helper function to get enum name from value, if taprpc is loaded
  const getEnumName = (enumObj, value) => {
    if (!enumObj) return 'UNKNOWN';
    for (const key in enumObj) {
      // Check if the property belongs to the object itself (not inherited)
      // and if the value matches
      if (Object.prototype.hasOwnProperty.call(enumObj, key) && enumObj[key] === value) {
        return key;
      }
    }
    // Fallback for potential string values returned by API sometimes
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(enumObj, value)) {
        return value;
    }
    return 'UNKNOWN_VALUE';
  };


  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="bg-white rounded-lg shadow-md p-6 md:p-8 max-w-4xl mx-auto">
          <header className="mb-8 border-b pb-4">
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">SENFINA LNC Demo</h1>
             <div className="mt-4 text-sm text-gray-600 space-y-1">
                <p>Alias: <span className="font-medium text-gray-800">{nodeInfo?.alias || 'Loading...'}</span></p>
                <p>Network: <span className="font-medium text-gray-800">{nodeInfo?.network || 'Loading...'}</span></p>
                <p>Block Height: <span className="font-medium text-gray-800">{nodeInfo?.blockHeight || 'Loading...'}</span></p>
                <p>Synced: <span className="font-medium text-gray-800">{typeof nodeInfo?.syncedToChain === 'boolean' ? (nodeInfo.syncedToChain ? 'Yes' : 'No') : 'Loading...'}</span></p>
                <p>Channels: <span className="font-medium text-gray-800">{nodeChannels?.length ?? 'Loading...'}</span></p>
                <p>Assets: <span className="font-medium text-gray-800">{assets?.length ?? 'Loading...'}</span></p>
             </div>
          </header>

          {/* Mint Asset Section */}
          <div className="mb-10">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">
              Mint New Taproot Asset
            </h3>
            <p className="text-gray-600 mb-6">
              Create new assets directly on the Bitcoin blockchain, transferable via Lightning.
            </p>

            <form onSubmit={mintAsset} className="mb-6 bg-gray-50 p-6 rounded-lg border">
                {/* Name Input */}
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mintAssetName">
                    Asset Name (Current value ignored for this test)
                    </label>
                    <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    id="mintAssetName"
                    type="text"
                    placeholder="e.g., MyToken"
                    value={mintAssetName}
                    onChange={(e) => setMintAssetName(e.target.value)}
                    required
                    disabled={isMinting}
                    />
                </div>
                {/* Amount Input */}
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mintAssetAmount">
                    Amount (Units)
                    </label>
                    <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    id="mintAssetAmount"
                    type="number"
                    placeholder="e.g., 1000"
                    value={mintAssetAmount}
                    onChange={(e) => setMintAssetAmount(e.target.value)}
                    min="1"
                    required
                    disabled={isMinting}
                    />
                </div>
                {/* Metadata Input (Optional, value ignored for this test) */}
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mintAssetMeta">
                    Metadata (Optional Text, ignored for this test)
                    </label>
                    <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-200" // Indicate ignored
                    id="mintAssetMeta"
                    type="text"
                    placeholder="e.g., Asset description"
                    value={mintAssetMeta}
                    onChange={(e) => setMintAssetMeta(e.target.value)}
                    disabled={true} // Disable for this test
                    />
                     <p className="text-xs text-gray-500 mt-1">Metadata is omitted for this specific test.</p>
                </div>

              <button
                className={`w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out ${isMinting ? 'opacity-50 cursor-not-allowed' : ''}`}
                type="submit"
                disabled={isMinting}
              >
                {isMinting ? 'Minting...' : 'Mint Asset (Minimal Request Test)'}
              </button>
              {mintAssetError && (
                <div className="mt-3 text-red-600 text-sm bg-red-100 p-3 rounded border border-red-300">{mintAssetError}</div>
              )}
              {mintAssetSuccess && (
                <div className="mt-3 text-green-600 text-sm bg-green-100 p-3 rounded border border-green-300">{mintAssetSuccess}</div>
              )}
            </form>
          </div>

          {/* Owned Assets Section */}
          <div>
            <h3 className="text-xl font-semibold mb-6 text-gray-700">
              Owned Assets
            </h3>
             {assets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {assets.map((item, index) => {
                        // Use helper to safely get enum names from numeric or string values
                        const assetTypeString = getEnumName(taprpc?.AssetType, item.assetType);
                        const assetVersionString = getEnumName(taprpc?.AssetVersion, item.version);

                        // Prefer assetIdStr for display if available
                        const displayAssetId = item.assetGenesis?.assetIdStr || item.assetGenesis?.assetId || 'N/A';

                        return (
                            <div key={index} className="border rounded-lg p-4 shadow-sm bg-white hover:shadow-md transition-shadow">
                            <p className="font-semibold text-gray-800 mb-2 truncate" title={item.assetGenesis?.name}>
                                Name: {item.assetGenesis?.name || 'N/A'}
                            </p>
                            <p className="text-gray-700 mb-2">Type: <span className="font-mono bg-gray-100 px-1 rounded text-xs">{assetTypeString}</span></p>
                            <p className="text-gray-700 mb-2">Version: <span className="font-mono bg-gray-100 px-1 rounded text-xs">{assetVersionString}</span></p>
                            <p className="text-gray-700 mb-2">Amount: {item.amount ? item.amount.toString() : 'N/A'}</p>
                            <p className="text-xs text-gray-500 mb-2 break-all" title={displayAssetId}>ID: {displayAssetId}</p>
                            <p className="text-xs text-gray-500 break-all">Genesis Pt: {item.assetGenesis?.genesisPoint || 'N/A'}</p>
                            <p className="text-xs text-gray-500 break-all">Anchor Height: {item.chainAnchor?.blockHeight || 'Unconfirmed'}</p>


                            {assetTypeString === 'COLLECTIBLE' && item.decodedMeta && (
                                <div className="mt-4 pt-4 border-t">
                                    <p className="font-semibold text-gray-800 mb-2">Decoded Meta Data</p>
                                    {/* Basic attempt to render image or text */}
                                    {item.decodedMeta.startsWith('data:image') ? (
                                        <img
                                            src={item.decodedMeta}
                                            alt="Collectible Asset Preview"
                                            className="max-w-full h-auto rounded-md border"
                                            onError={(e) => {
                                                const target = e.target; // No type casting
                                                target.style.display = 'none';
                                                const nextSibling = target.nextElementSibling;
                                                if (nextSibling instanceof HTMLElement) { // Keep instanceof check
                                                    nextSibling.style.display = 'block';
                                                }
                                            }}
                                        />
                                    ) : null}
                                    {/* Fallback or text display */}
                                    <pre
                                      className={`text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40 border ${item.decodedMeta.startsWith('data:image') ? 'hidden' : ''}`}
                                      style={{ display: item.decodedMeta.startsWith('data:image') ? 'none' : 'block' }} // Ensure correct initial display state
                                    >
                                        {item.decodedMeta}
                                    </pre>
                                </div>
                            )}
                            </div>
                        );
                    })}
                </div>
             ) : (
                 <p className="text-gray-500">No assets found or still loading...</p>
             )}
          </div>
        </div>
    </div>
  );
}

export default App;