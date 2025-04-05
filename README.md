# Senfina TapVolt - Taproot Asset Management App

TapVolt is a React application that allows users to interact with their Lightning Network node (LND and Tapd integrated) for managing Taproot Assets. This application provides functionalities to:

-   **View Owned Taproot Assets:** Display a list of Taproot Assets owned by the connected node.
-   **Mint New Assets:** Create and mint new Taproot Assets, including collectibles with metadata.
-   **Manage Minting Batches:** View, finalize, and cancel pending minting batches.
-   **Deposit Assets via Tapchannels:** Open Taproot Asset-enabled Lightning channels.
-   **Transfer Assets:** Send assets via Lightning Network or on-chain transactions (implementation pending).

## Features

-   **LNC Integration:** Connect to your LND node using Lightning Node Connect (LNC).
-   **Asset Listing:** Display detailed information about owned assets, including collectibles with metadata.
-   **Asset Minting:** Create new assets with customizable names, amounts, and metadata.
-   **Batch Management:** View, finalize, and cancel pending asset minting batches.
-   **Tapchannel Funding:** Open Taproot Asset-enabled Lightning channels.
-   **User-Friendly Interface:** Intuitive UI for easy asset management.

## Prerequisites

-   **Node.js** and **pnpm** installed.
-   A running [Lightning Terminal](https://github.com/lightninglabs/lightning-terminal) with LND node and Tapd integrated.
-   Lightning Node Connect (LNC) session created with Lightning Termninal.
-   Ensure your LND and Tapd are configured to support Taproot Assets. Check the `lit.conf` and `bitcoin.conf` examples in this repository.

## Installation

1.  Clone the repository:

    ```bash
    git clone <repository_url>
    cd tapvolt-ui
    ```

2.  Install dependencies:

    ```bash
    pnpm install
    ```

## Usage

1.  Start the development server:

    ```bash
    pnpm start
    ```

2.  Open your browser and navigate to `http://localhost:3000`.

3.  Enter your LNC pairing phrase to connect to your Lightning node.

4.  Once connected, you can view your owned assets, mint new assets, and manage batches.

## Configuration

-   Run bitcoind (testnet or signet) and configure it as the example of **bitcoin.conf** bellow that uses [Multinynet Signet](https://faucet.mutinynet.com/):
-   Run [Lightning Terminal](https://github.com/lightninglabs/lightning-terminal) (Lit) in integrated mode for both lnd and tapd, example of **lit.conf**:
-   The application uses `@lightninglabs/lnc-web` for LNC integration. Make sure LNC is running and accessible.
-   LND, Lit and Tapd docs for better undestanding: [https://docs.lightning.engineering/the-lightning-network/overview](https://docs.lightning.engineering/the-lightning-network/overview)

## Example `lit.conf` and `bitcoin.conf`

See the `examples` directory for example configurations of `lit.conf` and `bitcoin.conf` for testing with Signet.

- **bitcoin.conf**
```
signet=1
server=1
rpcuser=RPC_USER # change for your own
rpcpassword=RPC_PASSWORD # change for your own
rpcallowip=127.0.0.1
zmqpubrawblock=tcp://127.0.0.1:28336
zmqpubrawtx=tcp://127.0.0.1:28337
prune=1000 

[signet]
rpcport=18337
signetchallenge=512102f7561d208dd9ae99bf497273e16f389bdbd6c4742ddb8e6b216e64fa2928ad8f51ae
addnode=45.79.52.207:38333
dnsseed=0
signetblocktime=30
``` 
- **lit.conf**

```
#Lit Settings
enablerest=true
uipassword=YOUR_UI_PASSWORD
autopilot.disable=true # Disable for testnets/signet
httpslisten=127.0.0.1:8444 # Lit UI
network=signet 
loop-mode=disable
pool-mode=disable
lnd-mode=integrated # Must be integrated

# LND Settings
lnd.lnddir=DESIRED_LND_DIR_REMOVE_TO_KEEP_DEFAULT
lnd.alias=YOUR_NODE_ALIAS_ANY_VALUE_OR_JUST_REMOVE_IT # Makes easier to find your node at https://mutinynet.com/lightning
lnd.accept-keysend=true
lnd.minchansize=25000 # Can be changed if desired, minimum channel size that can be oppenned with you
lnd.bitcoin.active=1
lnd.bitcoin.node=bitcoind
lnd.bitcoind.dir=BITCOIN_DIRECTORY_REMOVE_FOR_DEFAULT
lnd.bitcoind.rpchost=127.0.0.1:18337 # Same used by Bitcoind
lnd.bitcoind.rpcuser=SAME_AS_BITCOIN.CONF
lnd.bitcoind.rpcpass=SAME_AS_BITCOIN.CONF
lnd.bitcoind.zmqpubrawblock=tcp://127.0.0.1:28336 # Same used by Bitcoind
lnd.bitcoind.zmqpubrawtx=tcp://127.0.0.1:28337 # Same used by Bitcoind
lnd.rpcmiddleware.enable=true
lnd.autopilot.active=false

# Tapd
taproot-assets.datadir=DESIRED_TAPD_DIR_OR_REMOVE_FOR_DEFAULT
#Taproot Assets Channels
lnd.protocol.option-scid-alias=true
lnd.protocol.zero-conf=true
lnd.protocol.simple-taproot-chans=true
lnd.protocol.simple-taproot-overlay-chans=true
lnd.protocol.custom-message=17
lnd.accept-keysend=true
lnd.accept-amp=true

# TOR (optional)
lnd.tor.active=true
lnd.tor.password=TOR_PWD
lnd.tor.socks=127.0.0.1:TOR_SOCKS_PORT
lnd.tor.streamisolation=true
lnd.tor.v3=true
lnd.tor.control=localhost:TOR_CONTROL_PORT

``` 

## Code Overview

-   **`App.js`:** Contains the main React application logic, including connection handling, asset listing, minting, and batch management.
-   **`@lightninglabs/lnc-web`:** Used for connecting to the Lightning node and for interacting with Taproot Asset functionalities.
-   **`Buffer`:** Used for encoding and decoding metadata.

## Key Functionalities

-   **`handleConnect`:** Connects to the Lightning node using LNC.
-   **`getInfo`:** Fetches node information.
-   **`listChannels`:** Lists active Lightning channels.
-   **`listAssets`:** Retrieves and displays owned Taproot Assets, including collectibles with metadata.
-   **`listBatches`:** Lists pending asset minting batches.
-   **`mintAsset`:** Mints a new Taproot Asset.
-   **`finalizeBatch`:** Finalizes a pending minting batch.
-   **`cancelBatch`:** Cancels a pending minting batch.
-   **`fundChannel`:** Opens a Taproot Asset-enabled Lightning channel.

## Future Enhancements

-   Implement asset transfer functionality via Lightning and on-chain.
-   Add more robust error handling and user feedback.
-   Enhance the UI/UX for better asset management.
-   Add asset transfer.
-   Implement collectibles minting.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

MIT