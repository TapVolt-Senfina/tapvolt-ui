import React, { useState, useEffect } from 'react';
import './App.css';
import { Buffer } from 'buffer';
// Correct: Use default import for LNC and named import for taprpc
import LNC, { taprpc } from '@lightninglabs/lnc-web';

// Define expected numeric values based on .proto definitions
const ASSET_TYPE_NORMAL_NUM = 0;
const ASSET_TYPE_COLLECTIBLE_NUM = 1;
const ASSET_VERSION_V0_NUM = 0; // Use V0 based on tapcli success
const META_TYPE_OPAQUE_NUM = 0; // Based on taprpc.AssetMetaType


function App() {
  const [lnc, setLNC] = useState(null); // Initialize with null
  const [assets, setAssets] = useState([]);
  const [batchAssets, setBatchAssets] = useState([]); 
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
  const [mintAssetMeta, setMintAssetMeta] = useState(''); // Re-enable meta input
  const [mintAssetError, setMintAssetError] = useState(null);
  const [mintAssetSuccess, setMintAssetSuccess] = useState(null);
  const [isMinting, setIsMinting] = useState(false); // Add minting state



  // Fund Channel Form State
  const [assetAmount, setAssetAmount] = useState('');
  const [assetId, setAssetId] = useState('');
  const [peerPubkey, setPeerPubkey] = useState('');
  const [feeRateSatPerVbyte, setFeeRateSatPerVbyte] = useState('');
  const [fundChannelError, setFundChannelError] = useState(null);
  const [fundChannelSuccess, setFundChannelSuccess] = useState(null);
  const [isFunding, setIsFunding] = useState(false);

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
        //password: password,
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
      console.log(lnc.tapd.tapChannels)
      getInfo();
      listChannels();
      listAssets();
      listBatches();
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
  const listBatches = async () => {
    if (!lnc || !lnc.tapd || !lnc.tapd.mint) {
      setMintAssetError("LNC or Taproot Mint service not initialized.");
      setIsMinting(false);
      return;
    }
    const { mint } = lnc.tapd;
    try {
      const assetsBatch = await mint.listBatches();
      console.log(assetsBatch);
      let formattedAssetsArray = [];
      if (assetsBatch && Array.isArray(assetsBatch.batches) && assetsBatch.batches.length > 0) {
        console.log(assetsBatch)
        for(let batch of assetsBatch.batches){
          /* All batches are saved in the node, their 'state' changes, it can be
          FINISHED, PENDING or CANCELED */
          if(batch.batch.state === "BATCH_STATE_PENDING"){
            const formattedAssets = batch.batch.assets.map(asset => ({
              name: asset.name,
              amount: asset.amount,
              assetVersion: asset.assetVersion,
              assetType: asset.assetType,
              assetMeta: asset.assetMeta?.data ? Buffer.from(asset.assetMeta.data, 'base64').toString('utf8') : '', // decode metadata
            }));
            console.log(formattedAssets)
            formattedAssetsArray.push(formattedAssets);
          }
        }

      
        setBatchAssets(formattedAssetsArray);
      } else {
        setBatchAssets([]); // Set to empty array if no batches or assets
      }
    } catch (error) {
      console.error("Failed to list batches:", error);
      setBatchAssets([]); // Set to empty array on error
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

    // Use the name from state, but sanitize it
    const sanitizedName = mintAssetName.replace(/[\r\n]+/g, '').trim();
    if (!sanitizedName) {
        setMintAssetError("Asset name cannot be empty or contain only whitespace/newlines.");
        setIsMinting(false);
        return;
    }

    const amount = parseInt(mintAssetAmount, 10);
    if (isNaN(amount) || amount <= 0) {
        setMintAssetError("Invalid amount provided. Must be a positive number.");
        setIsMinting(false);
        return;
    }

    // Reintroduce metadata handling, ensuring data is Base64
    let metaDataBytesBase64 = "";
    const trimmedMeta = mintAssetMeta.trim();
    if (trimmedMeta) {
        try {
            const sanitizedMeta = trimmedMeta.replace(/[\r\n]+/g, ''); // Sanitize meta too
            metaDataBytesBase64 = Buffer.from(sanitizedMeta, 'utf8').toString('base64');
             // Add console log to check the base64 string
            console.log("Encoded Metadata (Base64):", metaDataBytesBase64);
        } catch (bufferError) {
            console.error("Error encoding metadata:", bufferError);
            setMintAssetError("Failed to encode metadata.");
            setIsMinting(false);
            return;
        }
    } else {
        // If no meta provided, send empty base64 string as data might be required
        // OR omit asset_meta entirely. Let's try sending empty data first.
        metaDataBytesBase64 = ""; // Represents empty bytes
        console.log("No metadata provided, sending empty base64 string for data field.");
    }


    try {
      const { mint } = lnc.tapd;

      // Construct request, ensuring correct field names and data types
      // Use snake_case for asset_meta and ensure data is base64 string
      const request = {
        asset: {
          asset_version: ASSET_VERSION_V0_NUM,
          asset_type: "NORMAL", // NORMAL OR COLLECTIBLE, need to implement for collectibles (an image or any doc)
          name: sanitizedName,
          amount: amount.toString(),
          // Use snake_case for asset_meta field name
          asset_meta: {
              data: metaDataBytesBase64,      // Ensure this is a base64 string
              type: META_TYPE_OPAQUE_NUM     // Use 0 (OPAQUE)
          }
        },
        short_response: false,
      };

      console.log("Minting request (JS object, snake_case meta):", request);
      console.log("Minting request (JSON):", JSON.stringify(request, null, 2));

      const response = await mint.mintAsset(request);
      console.log("Minting response:", response);

       // Check response structure carefully based on actual successful response
      if (response && response.pendingBatch && response.pendingBatch.batchKey) {
        const batchKeyHex = Buffer.from(response.pendingBatch.batchKey).toString('hex');
        setMintAssetSuccess(
          `Asset minting initiated. Batch key: ${batchKeyHex}`
        );
        setMintAssetName('');
        setMintAssetAmount('');
        setMintAssetMeta(''); // Clear metadata field
        listBatches();

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
  const finalizeBatch = async () => {
    // Basic check if lnc services exist
    if (!lnc || !lnc.tapd || !lnc.tapd.mint) {
      setMintAssetError("LNC or Taproot Mint service not initialized.");
      setIsMinting(false);
      return;
    }
    const {mint} = lnc.tapd;
    const batchResponse = await mint.finalizeBatch({
      fee_rate: 253 //floor
    });
    console.log(batchResponse);
    await listBatches();
  };
  const cancelBatch = async () => {
    // Basic check if lnc services exist
    if (!lnc || !lnc.tapd || !lnc.tapd.mint) {
      setMintAssetError("LNC or Taproot Mint service not initialized.");
      setIsMinting(false);
      return;
    }
    const {mint} = lnc.tapd;
    const batchResponse = await mint.cancelBatch({});
    console.log(batchResponse);
    await listBatches();
  };

  const fundChannel = async (event) => {
    if (event) event.preventDefault();
    setFundChannelError(null);
    setFundChannelSuccess(null);
    setIsFunding(true);

    if (!lnc || !lnc.tapd || !lnc.tapd.tapChannels) {
      setFundChannelError("LNC or Taproot TapChannel service not initialized.");
      setIsFunding(false);
      return;
    }

    const { tapChannels } = lnc.tapd;

    try {
      const request = {
        asset_amount: parseInt(assetAmount, 10),
        asset_id: assetId,
        peer_pubkey: peerPubkey,
        fee_rate_sat_per_vbyte: parseInt(feeRateSatPerVbyte, 10),
      };

      const fundChannelResponse = await tapChannels.fundChannel(request);
      console.log("Fund Channel Response:", fundChannelResponse);
      setFundChannelSuccess("Channel funding initiated successfully.");
      setAssetAmount('');
      setAssetId('');
      setPeerPubkey('');
      setFeeRateSatPerVbyte('');
    } catch (error) {
      console.error("Failed to fund channel:", error);
      setFundChannelError(error.message || "Failed to fund channel. Please check your inputs.");
    } finally {
      setIsFunding(false);
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
              {/* BitcoinConnect looks better but can't be sure that all connection methods supports tapd; 
              It looks that only Lit running with both tapd and lnd in integrated mode does */}
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
                {/** Implement later as lightning terminal does or test bitcoin connect again (with LNC connection)
                 * in future
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
                
                */}

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
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">SENFINA TapVolt Demo</h1>
             <div className="mt-4 text-sm text-gray-600 space-y-1">
                <p>Alias: <span className="font-medium text-gray-800">{nodeInfo?.alias || 'Loading...'}</span></p>
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
                    Asset Name
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
                {/* Metadata Input (Optional) */}
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mintAssetMeta">
                    Metadata (Optional Text)
                    </label>
                    <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    id="mintAssetMeta"
                    type="text"
                    placeholder="e.g., Asset description"
                    value={mintAssetMeta}
                    onChange={(e) => setMintAssetMeta(e.target.value)}
                    disabled={isMinting}
                    />
                     <p className="text-xs text-gray-500 mt-1">This will be stored as OPAQUE metadata.</p>
                </div>

              <button
                className={`w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out ${isMinting ? 'opacity-50 cursor-not-allowed' : ''}`}
                type="submit"
                disabled={isMinting}
              >
                {isMinting ? 'Minting...' : 'Mint Asset'}
              </button>
              {mintAssetError && (
                <div className="mt-3 text-red-600 text-sm bg-red-100 p-3 rounded border border-red-300">{mintAssetError}</div>
              )}
              {mintAssetSuccess && (
                <div className="mt-3 text-green-600 text-sm bg-green-100 p-3 rounded border border-green-300">{mintAssetSuccess}</div>
              )}
            </form>
          </div>
          {batchAssets.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-2">Assets in Batch</h4>
              {
                batchAssets.map(batch => {
                  return(
                    <ul>
                    {
                    batch.map((asset, index) => (
                      <li key={index} className="border p-2 rounded mb-2">
                        <strong>{asset.name}</strong> - {asset.amount}
                        <p className="text-xs text-gray-500">
                          Type: {asset.assetType}
                        </p>
                        {asset.assetMeta && (
                          <p className="text-xs text-gray-500">
                            Meta: {asset.assetMeta}
                          </p>
                        )}
                      </li>
                    ))
                    }
                    </ul>
                  )
                })
              }
              <button
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out mt-4"
                onClick={cancelBatch}
              >
                Cancel Batch
              </button>
              <button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out mt-4"
                onClick={finalizeBatch}
              >
                Finalize Batch
              </button>
            </div>
          )}
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

                        // Prefer assetIdStr for display if available
                        const displayAssetId = item.assetGenesis?.assetIdStr || item.assetGenesis?.assetId || 'N/A';

                        return (
                            <div key={index} className="border rounded-lg p-4 shadow-sm bg-white hover:shadow-md transition-shadow">
                            <p className="font-semibold text-gray-800 mb-2 truncate" title={item.assetGenesis?.name}>
                                Name: {item.assetGenesis?.name || 'N/A'}
                            </p>
                            <p className="text-gray-700 mb-2">Type: <span className="font-mono bg-gray-100 px-1 rounded text-xs">{assetTypeString}</span></p>
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
          {/* Fund Channel Form */}
          {
            assets?.length > 0 &&
            <div>
              <h3 className="text-xl font-semibold mb-4 text-gray-700">
                Fund Taproot Asset Channel
              </h3>
              <p className="text-gray-600 mb-6">
                Open a channel with assets.
              </p>

              <form onSubmit={fundChannel} className="mb-6 bg-gray-50 p-6 rounded-lg border">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="assetAmount">
                    Asset Amount
                  </label>
                  <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    id="assetAmount"
                    type="number"
                    placeholder="e.g., 1"
                    value={assetAmount}
                    onChange={(e) => setAssetAmount(e.target.value)}
                    required
                    disabled={isFunding}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="assetId">
                    Asset ID
                  </label>
                  <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    id="assetId"
                    type="text"
                    placeholder="e.g., asset_id"
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    required
                    disabled={isFunding}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="peerPubkey">
                    Peer Public Key
                  </label>
                  <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    id="peerPubkey"
                    type="text"
                    placeholder="e.g., peer_pubkey"
                    value={peerPubkey}
                    onChange={(e) => setPeerPubkey(e.target.value)}
                    required
                    disabled={isFunding}
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="feeRateSatPerVbyte">
                    Fee Rate (sat/vbyte)
                  </label>
                  <input
                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    id="feeRateSatPerVbyte"
                    type="number"
                    placeholder="e.g., 1"
                    value={feeRateSatPerVbyte}
                    onChange={(e) => setFeeRateSatPerVbyte(e.target.value)}
                    required
                    disabled={isFunding}
                  />
                </div>

                <button
                  className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out ${isFunding ? 'opacity-50 cursor-not-allowed' : ''}`}
                  type="submit"
                  disabled={isFunding}
                >
                  {isFunding ? 'Funding...' : 'Fund Channel'}
                </button>
                {fundChannelError && (
                  <div className="mt-3 text-red-600 text-sm bg-red-100 p-3 rounded border border-red-300">{fundChannelError}</div>
                )}
                {fundChannelSuccess && (
                  <div className="mt-3 text-green-600 text-sm bg-green-100 p-3 rounded border border-green-300">{fundChannelSuccess}</div>
                )}
              </form>
            </div>
          }
        </div>

    </div>
  );
}

export default App;