import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import { Buffer } from 'buffer';
import LNC from '@lightninglabs/lnc-web';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Constants and Helpers
import { ASSET_TYPE_COLLECTIBLE_NUM, ASSET_VERSION_V0_NUM, META_TYPE_OPAQUE_NUM, ASSET_TYPE_NORMAL_NUM } from './utils/constants';

// Components
import LoadingSpinner from './components/LoadingSpinner';
import ConnectScreen from './components/ConnectScreen';
import AppHeader from './components/AppHeader';
import DarkModeToggle from './components/DarkModeToggle';
import NavBar from './components/NavBar';
import PeersModal from './components/PeersModal';

import RoutingPage from './pages/RoutingPage';
import ChannelsPage from './pages/ChannelsPage';
import TaprootAssetsPage from './pages/TaprootAssetsPage';

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
  const [channelAssets, setChannelAssets] = useState([]);
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
  const [nodePeers, setNodePeers] = useState();

  // Fund Channel Form State
  const [assetAmount, setAssetAmount] = useState('');
  const [assetId, setAssetId] = useState('');
  const [peerPubkey, setPeerPubkey] = useState('');
  const [feeRateSatPerVbyte, setFeeRateSatPerVbyte] = useState('');
  const [fundChannelError, setFundChannelError] = useState(null);
  const [fundChannelSuccess, setFundChannelSuccess] = useState(null);
  const [isFunding, setIsFunding] = useState(false);
  const [isPeersModalOpen, setIsPeersModalOpen] = useState(false);

  // Tap Asset Invoice State
  const [tapAssetChannels, setTapAssetChannels] = useState([]);
  const [isLoadingTapAssetChannels, setIsLoadingTapAssetChannels] = useState(false);
  const [tapAssetChannelsError, setTapAssetChannelsError] = useState(null);
  const [selectedInvoiceAssetId, setSelectedInvoiceAssetId] = useState('');
  const [selectedInvoicePeerPubkey, setSelectedInvoicePeerPubkey] = useState('');
  const [tapInvoiceAmount, setTapInvoiceAmount] = useState('');
  const [isCreatingTapInvoice, setIsCreatingTapInvoice] = useState(false);
  const [tapInvoiceError, setTapInvoiceError] = useState(null);
  const [tapInvoiceSuccess, setTapInvoiceSuccess] = useState(null);
  const [latestTapInvoice, setLatestTapInvoice] = useState(null);

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

  const bytesLikeToHex = useCallback((value) => {
    if (!value) return '';
    try {
      if (value instanceof Uint8Array) {
        return Buffer.from(value).toString('hex');
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (/^[0-9a-f]+$/.test(normalized)) return normalized;
        return Buffer.from(value, 'base64').toString('hex');
      }
    } catch (error) {
      console.error('Failed converting bytes-like value to hex:', error);
    }
    return '';
  }, []);

  const assetIdToHex = useCallback((asset) => {
    const raw = asset?.assetGenesis?.assetId;
    if (!raw) return '';
    if (typeof raw === 'string') {
      if (/^[0-9a-f]+$/i.test(raw)) return raw.toLowerCase();
      const fromB64 = bytesLikeToHex(raw);
      if (fromB64) return fromB64;
    }
    return bytesLikeToHex(raw);
  }, [bytesLikeToHex]);

  const extractPeerPubkeyHex = useCallback((channel) => {
    return bytesLikeToHex(
      channel?.peerPubkey ||
      channel?.peerPubKey ||
      channel?.remotePubkey ||
      channel?.remotePubKey ||
      channel?.peer
    );
  }, [bytesLikeToHex]);

  const parseChannelAssetBalances = useCallback((channels) => {
    const assetsById = new Map();

    const normalizeIntString = (value) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 ? String(Math.trunc(value)) : '0';
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return /^\d+$/.test(trimmed) ? trimmed : '0';
      }
      return '0';
    };

    const addIntStrings = (a, b) => {
      const aNorm = normalizeIntString(a);
      const bNorm = normalizeIntString(b);
      let i = aNorm.length - 1;
      let j = bNorm.length - 1;
      let carry = 0;
      let out = '';

      while (i >= 0 || j >= 0 || carry > 0) {
        const digitA = i >= 0 ? aNorm.charCodeAt(i) - 48 : 0;
        const digitB = j >= 0 ? bNorm.charCodeAt(j) - 48 : 0;
        const sum = digitA + digitB + carry;
        out = String(sum % 10) + out;
        carry = Math.floor(sum / 10);
        i -= 1;
        j -= 1;
      }

      return out.replace(/^0+(?=\d)/, '');
    };

    const parseCustomChannelData = (rawData) => {
      if (!rawData) return null;
      if (typeof rawData === 'object' && !(rawData instanceof Uint8Array)) return rawData;

      const parseJsonString = (str) => {
        if (!str?.trim()) return null;
        try {
          return JSON.parse(str);
        } catch (_error) {
          return null;
        }
      };

      if (rawData instanceof Uint8Array) {
        const asUtf8 = Buffer.from(rawData).toString('utf8');
        return parseJsonString(asUtf8);
      }

      if (typeof rawData === 'string') {
        const fromPlain = parseJsonString(rawData);
        if (fromPlain) return fromPlain;

        try {
          const decoded = Buffer.from(rawData, 'base64').toString('utf8');
          return parseJsonString(decoded);
        } catch (_error) {
          return null;
        }
      }

      return null;
    };

    const upsertAsset = ({
      assetIdHex,
      name,
      decimalDisplay,
      localDelta,
      remoteDelta,
      capacityDelta,
      channelKey,
    }) => {
      if (!assetIdHex) return;
      if (!assetsById.has(assetIdHex)) {
        assetsById.set(assetIdHex, {
          assetIdHex,
          name: name || 'Unknown Asset',
          decimalDisplay,
          localBalance: '0',
          remoteBalance: '0',
          channelCapacity: '0',
          channelKeys: new Set(),
        });
      }

      const current = assetsById.get(assetIdHex);
      if ((!current.name || current.name === 'Unknown Asset') && name) current.name = name;
      if ((current.decimalDisplay === undefined || current.decimalDisplay === null) && decimalDisplay !== undefined && decimalDisplay !== null) {
        current.decimalDisplay = decimalDisplay;
      }

      current.localBalance = addIntStrings(current.localBalance, localDelta);
      current.remoteBalance = addIntStrings(current.remoteBalance, remoteDelta);
      current.channelCapacity = addIntStrings(current.channelCapacity, capacityDelta);
      if (channelKey) current.channelKeys.add(channelKey);
    };

    (Array.isArray(channels) ? channels : []).forEach((channel) => {
      const channelKey =
        channel?.channelPoint ||
        channel?.channel_point ||
        channel?.chanId ||
        channel?.chan_id ||
        channel?.scid ||
        `${Math.random()}`;

      const channelData = parseCustomChannelData(channel?.customChannelData || channel?.custom_channel_data);
      if (!channelData || typeof channelData !== 'object') return;

      const fundingAssets = channelData?.fundingAssets || channelData?.funding_assets || [];
      const localAssets = channelData?.localAssets || channelData?.local_assets || [];
      const remoteAssets = channelData?.remoteAssets || channelData?.remote_assets || [];
      const channelCapacity = channelData?.capacity || 0;

      const metaByAssetId = new Map();

      (Array.isArray(fundingAssets) ? fundingAssets : []).forEach((fundingAsset) => {
        const genesis = fundingAsset?.assetGenesis || fundingAsset?.asset_genesis || {};
        const fundingAssetId = bytesLikeToHex(genesis?.assetId || genesis?.asset_id || fundingAsset?.assetId || fundingAsset?.asset_id);
        if (!fundingAssetId) return;

        metaByAssetId.set(fundingAssetId, {
          name: genesis?.name || fundingAsset?.name || 'Unknown Asset',
          decimalDisplay: fundingAsset?.decimalDisplay ?? fundingAsset?.decimal_display,
        });

        upsertAsset({
          assetIdHex: fundingAssetId,
          name: genesis?.name || fundingAsset?.name,
          decimalDisplay: fundingAsset?.decimalDisplay ?? fundingAsset?.decimal_display,
          capacityDelta: channelCapacity,
          channelKey,
        });
      });

      (Array.isArray(localAssets) ? localAssets : []).forEach((entry) => {
        const entryId = bytesLikeToHex(entry?.assetId || entry?.asset_id);
        if (!entryId) return;

        const meta = metaByAssetId.get(entryId) || {};
        upsertAsset({
          assetIdHex: entryId,
          name: meta.name,
          decimalDisplay: meta.decimalDisplay,
          localDelta: entry?.amount,
          channelKey,
        });
      });

      (Array.isArray(remoteAssets) ? remoteAssets : []).forEach((entry) => {
        const entryId = bytesLikeToHex(entry?.assetId || entry?.asset_id);
        if (!entryId) return;

        const meta = metaByAssetId.get(entryId) || {};
        upsertAsset({
          assetIdHex: entryId,
          name: meta.name,
          decimalDisplay: meta.decimalDisplay,
          remoteDelta: entry?.amount,
          channelKey,
        });
      });
    });

    return Array.from(assetsById.values())
      .map((item) => ({
        assetIdHex: item.assetIdHex,
        name: item.name,
        decimalDisplay: item.decimalDisplay,
        localBalance: item.localBalance,
        remoteBalance: item.remoteBalance,
        totalInChannels: addIntStrings(item.localBalance, item.remoteBalance),
        channelCapacity: item.channelCapacity,
        channelsCount: item.channelKeys.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bytesLikeToHex]);

  const invoiceChannelAssets = useMemo(() => {
    return (Array.isArray(channelAssets) ? channelAssets : [])
      .filter((item) => /^[0-9a-f]+$/i.test(item?.assetIdHex || ''));
  }, [channelAssets]);

  const totalAssetsCount = useMemo(() => {
    const allAssetIds = new Set();

    (Array.isArray(assets) ? assets : []).forEach((asset) => {
      const id = assetIdToHex(asset);
      if (id) allAssetIds.add(id);
    });

    invoiceChannelAssets.forEach((asset) => {
      if (asset.assetIdHex) allAssetIds.add(asset.assetIdHex.toLowerCase());
    });

    return allAssetIds.size;
  }, [assets, invoiceChannelAssets, assetIdToHex]);

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
      try {
        setIsPaired(Boolean(new LNC({})?.credentials?.isPaired));
      } catch (_refreshError) {
        setIsPaired(false);
      }
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
      lncInstance.credentials.password = trimmedPassword;
      if (!lncInstance?.credentials?.isPaired) {
        throw new Error('No paired credentials found. Connect your node first.');
      }

      await lncInstance.connect();

      setLNC(lncInstance);
      setIsPaired(Boolean(lncInstance?.credentials?.isPaired));
      setPassword('');
    } catch (error) {
      console.error('LNC login error:', error);
      setConnectionError(error.message || 'Failed to login. Check password.');
      setLNC(null);
      try {
        setIsPaired(Boolean(new LNC({})?.credentials?.isPaired));
      } catch (_refreshError) {
        setIsPaired(false);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const getInfo = useCallback(async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for getInfo"); return; }
    try { const info = await lnc.lnd.lightning.getInfo(); setNodeInfo(info); }
    catch (error) { console.error("Failed to get node info:", error); setNodeInfo(null); }
  }, [lnc]);

  const listChannels = useCallback(async () => {
    if (!lnc || !lnc.lnd?.lightning) { console.error("LNC or LND lightning service not initialized for listChannels"); return; }
    try {
      const response = await lnc.lnd.lightning.listChannels();
      const channels = Array.isArray(response?.channels) ? response.channels : [];
      setChannels(channels);
      setChannelAssets(parseChannelAssetBalances(channels));
    }
    catch (error) {
      console.error("Failed to list channels:", error);
      setChannels([]);
      setChannelAssets([]);
    }
  }, [lnc, parseChannelAssetBalances]);

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

  const listTapAssetChannels = useCallback(async () => {
    if (!lnc?.tapd?.tapChannels) {
      setTapAssetChannels([]);
      setTapAssetChannelsError('Taproot Asset channel service is not available on this node.');
      return;
    }

    const { tapChannels } = lnc.tapd;
    setIsLoadingTapAssetChannels(true);
    setTapAssetChannelsError(null);

    try {
      const methodCandidates = ['listChannels', 'listAssetChannels'];
      let channels = [];

      for (const methodName of methodCandidates) {
        if (typeof tapChannels?.[methodName] !== 'function') continue;
        const response = await tapChannels[methodName]({});
        const batch = response?.channels || response?.assetChannels || response?.tapChannels || [];
        if (Array.isArray(batch) && batch.length > 0) {
          channels = batch;
          break;
        }
      }

      if (!channels.length) {
        setTapAssetChannels([]);
        setTapAssetChannelsError(
          'No Taproot Asset channels found yet. Open/fund an asset channel first.'
        );
        return;
      }

      setTapAssetChannels(channels);
    } catch (error) {
      console.error('Failed to list Taproot Asset channels:', error);
      setTapAssetChannels([]);
      setTapAssetChannelsError(error.message || 'Failed to load Taproot Asset channels.');
    } finally {
      setIsLoadingTapAssetChannels(false);
    }
  }, [lnc]);

  useEffect(() => {
    if (lnc && lnc.isConnected) {
      console.log('LNC ready, fetching node data...');
      getInfo();
      listChannels();
      listAssets();
      listBatches();
      listPeers();
      listTapAssetChannels();
    } else {
      setNodeInfo(null);
      setChannels([]);
      setAssets([]);
      setChannelAssets([]);
      setBatchAssets([]);
      setNodePeers([]);
      setTapAssetChannels([]);
      setTapAssetChannelsError(null);
      setSelectedInvoicePeerPubkey('');
      setSelectedInvoiceAssetId('');
      setTapInvoiceAmount('');
      setTapInvoiceError(null);
      setTapInvoiceSuccess(null);
      setLatestTapInvoice(null);
    }
  }, [lnc, getInfo, listChannels, listAssets, listBatches, listPeers, listTapAssetChannels]); // Added useCallback dependencies

  useEffect(() => {
    if (!invoiceChannelAssets.length) {
      setSelectedInvoiceAssetId('');
      return;
    }

    const stillValid = invoiceChannelAssets.some((asset) => asset.assetIdHex === selectedInvoiceAssetId);
    if (!stillValid) {
      setSelectedInvoiceAssetId(invoiceChannelAssets[0].assetIdHex);
    }
  }, [invoiceChannelAssets, selectedInvoiceAssetId]);

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
        setMintAssetSuccess(<>Asset minting initiated. Batch key: <div style={{ overflowX: "auto" }}>{batchKeyHex}</div></>);
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

  const handleCreateTapAssetInvoice = async (event) => {
    if (event) event.preventDefault();
    setTapInvoiceError(null);
    setTapInvoiceSuccess(null);
    setIsCreatingTapInvoice(true);

    if (!lnc?.tapd?.tapChannels?.addInvoice) {
      setTapInvoiceError('tapChannels.addInvoice is not available on this LNC session.');
      setIsCreatingTapInvoice(false);
      return;
    }

    try {
      const amount = parseInt(tapInvoiceAmount, 10);
      if (Number.isNaN(amount) || amount <= 0) throw new Error('Asset amount must be a positive number.');
      if (!selectedInvoiceAssetId?.trim()) throw new Error('Select an asset first.');
      if (!/^[0-9a-f]+$/i.test(selectedInvoiceAssetId)) throw new Error('Selected asset ID must be hex.');

      const request = {
        assetId: Buffer.from(selectedInvoiceAssetId.trim(), 'hex'),
        assetAmount: amount.toString(),
        invoiceRequest: {
          memo: `Tap asset invoice - ${new Date().toISOString()}`,
        },
      };

      if (selectedInvoicePeerPubkey?.trim()) {
        if (!/^[0-9a-f]+$/i.test(selectedInvoicePeerPubkey)) {
          throw new Error('Selected peer pubkey must be hex.');
        }
        request.peerPubkey = Buffer.from(selectedInvoicePeerPubkey.trim(), 'hex');
      }

      const response = await lnc.tapd.tapChannels.addInvoice(request);
      const invoiceResult = response?.invoiceResult || {};
      const paymentRequest =
        invoiceResult?.paymentRequest ||
        invoiceResult?.payment_request ||
        invoiceResult?.payReq ||
        invoiceResult?.pay_req ||
        '';
      const paymentHashHex =
        bytesLikeToHex(invoiceResult?.rHash) ||
        bytesLikeToHex(invoiceResult?.r_hash) ||
        (typeof invoiceResult?.rHashStr === 'string' ? invoiceResult.rHashStr : '');

      if (!paymentRequest) {
        throw new Error('Invoice was created but no payment request was returned.');
      }

      setLatestTapInvoice({
        paymentRequest,
        paymentHashHex,
        acceptedBuyQuote: response?.acceptedBuyQuote || null,
      });
      setTapInvoiceSuccess('Taproot Asset invoice created. Share it with your counterparty to pay with assets.');
    } catch (error) {
      console.error('Failed to create Taproot Asset invoice:', error);
      setLatestTapInvoice(null);
      setTapInvoiceError(error.message || 'Failed to create Taproot Asset invoice.');
    } finally {
      setIsCreatingTapInvoice(false);
    }
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
    <BrowserRouter>
      <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <DarkModeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

        <div
          className="max-w-7xl mx-auto rounded-2xl shadow-xl transition-all duration-300"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            boxShadow: darkMode
              ? '0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.2)'
              : '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.01)'}`,
            margin: '16px auto',
          }}
        >
          <AppHeader
            nodeInfo={nodeInfo}
            nodeChannelsCount={nodeChannels?.length}
            assetsCount={totalAssetsCount}
            peersCount={nodePeers?.length}
            onShowPeers={() => setIsPeersModalOpen(true)}
          />

          <NavBar darkMode={darkMode} />

          <Routes>
            <Route
              path="/routing"
              element={
                <RoutingPage
                  lnc={lnc}
                  darkMode={darkMode}
                  nodeChannels={nodeChannels}
                />
              }
            />
            <Route
              path="/channels"
              element={
                <ChannelsPage
                  lnc={lnc}
                  darkMode={darkMode}
                  nodeChannels={nodeChannels}
                />
              }
            />
            <Route
              path="/taproot-assets"
              element={
                <TaprootAssetsPage
                  // Mint
                  mintAssetName={mintAssetName} setMintAssetName={setMintAssetName}
                  mintAssetAmount={mintAssetAmount} setMintAssetAmount={setMintAssetAmount}
                  mintAssetType={mintAssetType}
                  handleAssetTypeChange={handleAssetTypeChange}
                  mintAssetFilePreview={mintAssetFilePreview}
                  handleFileChange={handleFileChange}
                  mintAssetMeta={mintAssetMeta} setMintAssetMeta={setMintAssetMeta}
                  isMinting={isMinting}
                  mintAssetError={mintAssetError}
                  mintAssetSuccess={mintAssetSuccess}
                  handleMintAssetSubmit={handleMintAssetSubmit}
                  // Batch
                  batchAssets={batchAssets}
                  handleCancelBatch={handleCancelBatch}
                  handleFinalizeBatch={handleFinalizeBatch}
                  // Assets & Channels
                  assets={assets}
                  channelAssets={channelAssets}
                  // Fund Channel
                  assetAmount={assetAmount} setAssetAmount={setAssetAmount}
                  assetId={assetId} setAssetId={setAssetId}
                  peerPubkey={peerPubkey} setPeerPubkey={setPeerPubkey}
                  feeRateSatPerVbyte={feeRateSatPerVbyte} setFeeRateSatPerVbyte={setFeeRateSatPerVbyte}
                  isFunding={isFunding}
                  fundChannelError={fundChannelError}
                  fundChannelSuccess={fundChannelSuccess}
                  handleFundChannelSubmit={handleFundChannelSubmit}
                  nodePeers={nodePeers}
                  onShowPeers={() => setIsPeersModalOpen(true)}
                  // Tap Invoice
                  invoiceChannelAssets={invoiceChannelAssets}
                  tapAssetChannels={tapAssetChannels}
                  tapAssetChannelsError={tapAssetChannelsError}
                  isLoadingTapAssetChannels={isLoadingTapAssetChannels}
                  listTapAssetChannels={listTapAssetChannels}
                  selectedInvoiceAssetId={selectedInvoiceAssetId}
                  setSelectedInvoiceAssetId={setSelectedInvoiceAssetId}
                  selectedInvoicePeerPubkey={selectedInvoicePeerPubkey}
                  setSelectedInvoicePeerPubkey={setSelectedInvoicePeerPubkey}
                  tapInvoiceAmount={tapInvoiceAmount}
                  setTapInvoiceAmount={setTapInvoiceAmount}
                  isCreatingTapInvoice={isCreatingTapInvoice}
                  tapInvoiceError={tapInvoiceError}
                  tapInvoiceSuccess={tapInvoiceSuccess}
                  latestTapInvoice={latestTapInvoice}
                  handleCreateTapAssetInvoice={handleCreateTapAssetInvoice}
                  // Utils
                  darkMode={darkMode}
                  extractPeerPubkeyHex={extractPeerPubkeyHex}
                  bytesLikeToHex={bytesLikeToHex}
                />
              }
            />
            <Route path="*" element={<Navigate to="/routing" replace />} />
          </Routes>

          <PeersModal
            isOpen={isPeersModalOpen}
            onClose={() => setIsPeersModalOpen(false)}
            peers={nodePeers}
            darkMode={darkMode}
            lnc={lnc}
            onPeerAdded={listPeers}
          />

          <footer
            className="px-6 py-4 border-t text-center text-xs"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
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
    </BrowserRouter>
  );
}

export default App;
