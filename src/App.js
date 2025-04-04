import {useState,useEffect} from 'react';
import './App.css';
import {Buffer} from 'buffer';
import LNC from '@lightninglabs/lnc-web';

console.log(Buffer)
function App() {


  // Main
  const [lnc,setLNC] = useState();
  const isConnected = () => console.log(lnc.isConnected);
  const isReady = () => console.log(lnc.isReady);
  const load = () => lnc.preload();
  const run = () => lnc.run();
  const connect = () => lnc.connect();
  const disconnect = () => lnc.disconnect();


  const [assets,setAssets] = useState();
  const [nodeChannels,setChannels] = useState([]);

  const [assetMeta,setMeta] = useState();
  const [nodeInfo,setNodeInfo] = useState();
  // LNC 

  const [pairingPhrase, setPairingPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [connectionError, setConnectionError] = useState(null);

  const handleConnect = async (event) => {
    event.preventDefault(); // Prevent default form submission

    setConnectionError(null); // Reset error

    try {
      const lncInstance = new LNC({
        pairingPhrase: pairingPhrase,
        password: password,
      });

      await lncInstance.connect();

      setLNC(lncInstance);
    } catch (error) {
      console.error('LNC connection error:', error);
      setConnectionError(error.message || 'Failed to connect. Please check your credentials.');
    }
  };

  useEffect(() => {
    if(lnc){
      getInfo();
      listChannels();
      listAssets();
    }
  },[lnc]);
  // LND
  
  const getInfo = async() => {
      const { lightning } = lnc.lnd;
      const info = await lightning.getInfo();
      setNodeInfo(info);
      console.log(info);
  };
  const listChannels = async() => {
      const { lightning } = lnc.lnd;
      const channels = await lightning.listChannels();
      console.log(channels);
      setChannels(channels.channels)
  };
  const listPeers = async() => {
      const { lightning } = lnc.lnd;
      const peers = await lightning.listPeers();
      console.log(peers);
  };

  const newAddress = async() => {
      const { lightning } = lnc.lnd;

      const address = await lightning.newAddress({ type: 'WITNESS_PUBKEY_HASH' });
      console.log(address);
  };
  const lookupInvoice = async() => {
      const { lightning } = lnc.lnd;

      const invoice = await lightning.lookupInvoice({ rHashStr: 'f21981515ef639a86642f64cbe9f844c5286aad18b57441627f37103b7fa32ea' });
      console.log(invoice);
  };

  // Streaming

  const logger = (data) => {
      console.log('logger', data);
  };

  const subscribePeerEvents = () => {
      const { lightning } = lnc.lnd;

      lightning.subscribePeerEvents({}, logger);
  };

  // Taproot Assets

  const listAssets = async() => {
      const { taprootAssets, mint, universe, assetWallet } = lnc.tapd;

      const assetsTap = await taprootAssets.listAssets();
      let assetsArr = [];
      console.log(assetsTap);
      for(let asset of assetsTap.assets){
        if(asset.assetType === "COLLECTIBLE"){
          const meta = await taprootAssets.fetchAssetMeta({asset_id: asset.assetGenesis.assetId.replace(/\+/g, '-').replace(/\//g, '_')});
          assetsArr.push({
            ...asset,
            decodedMeta: Buffer.from(meta.data,'base64').toString('utf8')
          });
          console.log(assetsArr)
        } else {
          assetsArr.push(asset);
        }
      }
      setAssets(assetsArr);


  };

  const listBatches = async() => {
      const { taprootAssets, mint, universe, assetWallet } = lnc.tapd;

      const assets = await mint.listBatches();
      console.log(assets);
  };

  const listFederationServers = async() => {
      const { taprootAssets, mint, universe, assetWallet } = lnc.tapd;

      const assets = await universe.listFederationServers();
      console.log(assets);
  };

  const nextScriptKey = async() => {
      const { taprootAssets, mint, universe, assetWallet } = lnc.tapd;
      const assets = await assetWallet.nextScriptKey({ keyFamily: 1 })
      console.log(assets);
  };
  const mintAsset = async() => {
      const { taprootAssets, mint, universe, assetWallet } = lnc.tapd;
      console.log(mint.mintAsset)
      const batch = await mint.mintAsset();
      console.log(batch);
  };


  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {lnc ? (
        <div className="bg-white rounded-lg shadow-md p-8">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-800">Taproot Assets Demo</h1>
            <p>Connected as: {nodeInfo?.alias}</p>
            <p>Total channels: {nodeChannels?.length || 0}</p>
            <p>Total assets: {assets?.length || 0}</p>

          </header>
          <div>
            <h3 className="text-xl font-semibold mb-4 text-gray-700">
              Welcome to Taproot Assets demo!
            </h3>
            <p className="text-gray-600 mb-6">
              A protocol to mint assets in Bitcoin that are transferable via lightning network!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assets?.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 shadow-sm">
                  <p className="font-semibold text-gray-800 mb-2">
                    Name: {item.assetGenesis.name}
                  </p>
                  <p className="text-gray-700 mb-2">Type: {item.assetType}</p>
                  <p className="text-gray-700 mb-2">Amount: {item.amount}</p>
                  {item.assetType === 'COLLECTIBLE' && (
                    <div className="mt-4">
                      <p className="font-semibold text-gray-800 mb-2">Data</p>
                      <img
                        src={item.decodedMeta}
                        alt="Collectible Asset"
                        className="max-w-full rounded-md"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-4 tracking-tight">
            Unlock the Power of Taproot Assets
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
            Seamlessly mint, transfer, and manage Bitcoin-based assets with the speed and efficiency of the Lightning Network.
          </p>
        </div>
  
        <div className="bg-white rounded-xl shadow-2xl p-12 max-w-md w-full">
          <div className="mb-6 text-center">
            <p className="text-lg font-semibold text-gray-700 mb-4">
              Connect your Lightning Node to get started:
            </p>
          </div>
          <div className="flex justify-center">
          <form onSubmit={handleConnect}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="pairingPhrase">
                Pairing Phrase
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="pairingPhrase"
                type="text"
                placeholder="Enter your pairing phrase"
                value={pairingPhrase}
                onChange={(e) => setPairingPhrase(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-center">
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                type="submit"
              >
                Connect with LNC
              </button>
            </div>
            {connectionError && (
              <div className="mt-4 text-red-500 text-sm text-center">
                {connectionError}
              </div>
            )}
          </form>
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Powered by secure and decentralized Lightning Network technology.
            </p>
          </div>
        </div>
  
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Taproot Assets Demo. All rights reserved.
          </p>
        </div>
      </div>
    )};
    </div>
  );
}

export default App;
