import React from 'react';
import { taprpc } from '@lightninglabs/lnc-web';
import MintAssetForm from '../components/MintAssetForm';
import PendingBatchDisplay from '../components/PendingBatchDisplay';
import OwnedAssetsList from '../components/OwnedAssetsList';
import ChannelAssetsList from '../components/ChannelAssetsList';
import FundChannelForm from '../components/FundChannelForm';
import FeedbackMessage from '../components/FeedbackMessage';

const TaprootAssetsPage = ({
    // Mint
    mintAssetName, setMintAssetName,
    mintAssetAmount, setMintAssetAmount,
    mintAssetType, handleAssetTypeChange,
    mintAssetFilePreview, handleFileChange,
    mintAssetMeta, setMintAssetMeta,
    isMinting, mintAssetError, mintAssetSuccess,
    handleMintAssetSubmit,
    // Batch
    batchAssets, handleCancelBatch, handleFinalizeBatch,
    // Assets
    assets, channelAssets,
    // Fund channel
    assetAmount, setAssetAmount,
    assetId, setAssetId,
    peerPubkey, setPeerPubkey,
    feeRateSatPerVbyte, setFeeRateSatPerVbyte,
    isFunding, fundChannelError, fundChannelSuccess,
    handleFundChannelSubmit,
    nodePeers, onShowPeers,
    // Tap Invoice
    invoiceChannelAssets,
    tapAssetChannels, tapAssetChannelsError,
    isLoadingTapAssetChannels, listTapAssetChannels,
    selectedInvoiceAssetId, setSelectedInvoiceAssetId,
    selectedInvoicePeerPubkey, setSelectedInvoicePeerPubkey,
    tapInvoiceAmount, setTapInvoiceAmount,
    isCreatingTapInvoice,
    tapInvoiceError, tapInvoiceSuccess,
    latestTapInvoice,
    handleCreateTapAssetInvoice,
    // Utils
    darkMode, extractPeerPubkeyHex, bytesLikeToHex,
}) => {
    return (
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
                    <ChannelAssetsList
                        channelAssets={channelAssets}
                        darkMode={darkMode}
                    />
                    {assets?.length > 0 && (
                        <FundChannelForm
                            assetAmount={assetAmount} setAssetAmount={setAssetAmount}
                            assetId={assetId} setAssetId={setAssetId}
                            assets={assets}
                            peers={nodePeers}
                            onShowPeers={onShowPeers}
                            peerPubkey={peerPubkey} setPeerPubkey={setPeerPubkey}
                            feeRateSatPerVbyte={feeRateSatPerVbyte} setFeeRateSatPerVbyte={setFeeRateSatPerVbyte}
                            isFunding={isFunding}
                            fundChannelError={fundChannelError}
                            fundChannelSuccess={fundChannelSuccess}
                            darkMode={darkMode}
                            onSubmit={handleFundChannelSubmit}
                        />
                    )}

                    {/* Create Taproot Asset Invoice */}
                    <section>
                        <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
                            Create Taproot Asset Invoice
                        </h2>
                        <form
                            onSubmit={handleCreateTapAssetInvoice}
                            className="rounded-xl p-6 transition-colors duration-300"
                            style={{
                                backgroundColor: 'var(--form-bg)',
                                border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                                boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)',
                            }}
                        >
                            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                                Uses <code>lnc.tapd.tapChannels.addInvoice</code> so the invoice is payable in the selected Taproot Asset.
                            </p>

                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="tapInvoiceAssetId">
                                    Asset
                                </label>
                                <select
                                    id="tapInvoiceAssetId"
                                    className="w-full px-3 py-2 rounded-md transition-colors duration-200"
                                    style={{
                                        backgroundColor: 'var(--input-bg)',
                                        color: 'var(--text-primary)',
                                        border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                    }}
                                    value={selectedInvoiceAssetId}
                                    onChange={(e) => setSelectedInvoiceAssetId(e.target.value)}
                                    required
                                    disabled={isCreatingTapInvoice || !invoiceChannelAssets.length}
                                >
                                    <option value="" disabled>Select an asset from channels</option>
                                    {invoiceChannelAssets.map((asset) => {
                                        const currentAssetIdHex = asset.assetIdHex;
                                        return (
                                            <option key={currentAssetIdHex} value={currentAssetIdHex}>
                                                {`${asset.name || 'Unnamed'} (in channels: ${asset.totalInChannels || '0'})`}
                                            </option>
                                        );
                                    })}
                                </select>
                                {!invoiceChannelAssets.length && (
                                    <p className="text-xs mt-2" style={{ color: 'var(--error-text)' }}>
                                        No Taproot Assets found in channels. Open/fund a Taproot Asset channel first.
                                    </p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }} htmlFor="tapInvoiceAmount">
                                    Asset Amount
                                </label>
                                <input
                                    id="tapInvoiceAmount"
                                    className="w-full px-3 py-2 rounded-md transition-colors duration-200"
                                    style={{
                                        backgroundColor: 'var(--input-bg)',
                                        color: 'var(--text-primary)',
                                        border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                    }}
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 10"
                                    value={tapInvoiceAmount}
                                    onChange={(e) => setTapInvoiceAmount(e.target.value)}
                                    required
                                    disabled={isCreatingTapInvoice}
                                />
                            </div>

                            <div className="mb-5">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <label className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }} htmlFor="tapInvoicePeerPubkey">
                                        Channel Peer (optional)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={listTapAssetChannels}
                                        className="text-xs px-2 py-1 rounded border"
                                        style={{
                                            borderColor: 'var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            backgroundColor: 'transparent',
                                        }}
                                        disabled={isLoadingTapAssetChannels || isCreatingTapInvoice}
                                    >
                                        {isLoadingTapAssetChannels ? 'Refreshing...' : 'Refresh channels'}
                                    </button>
                                </div>
                                <select
                                    id="tapInvoicePeerPubkey"
                                    className="w-full px-3 py-2 rounded-md transition-colors duration-200"
                                    style={{
                                        backgroundColor: 'var(--input-bg)',
                                        color: 'var(--text-primary)',
                                        border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                    }}
                                    value={selectedInvoicePeerPubkey}
                                    onChange={(e) => setSelectedInvoicePeerPubkey(e.target.value)}
                                    disabled={isCreatingTapInvoice}
                                >
                                    <option value="">Auto RFQ (all suitable peers)</option>
                                    {[...new Set(tapAssetChannels.map((channel) => extractPeerPubkeyHex(channel)).filter(Boolean))].map((peerHex) => (
                                        <option key={peerHex} value={peerHex}>{peerHex}</option>
                                    ))}
                                </select>
                                {tapAssetChannelsError && (
                                    <p className="text-xs mt-2" style={{ color: 'var(--error-text)' }}>
                                        {tapAssetChannelsError}
                                    </p>
                                )}
                                {tapAssetChannels.length > 0 && (
                                    <div className="mt-3 max-h-32 overflow-y-auto pr-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {tapAssetChannels.map((channel, idx) => (
                                            <div
                                                key={`${extractPeerPubkeyHex(channel)}-${idx}`}
                                                className="py-1 border-b"
                                                style={{ borderColor: 'var(--border-color)' }}
                                            >
                                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Peer:</span>{' '}
                                                {extractPeerPubkeyHex(channel) || 'unknown'}{' '}
                                                {channel?.assetId || channel?.asset_id ? (
                                                    <>
                                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Asset:</span>{' '}
                                                        {bytesLikeToHex(channel?.assetId || channel?.asset_id)}
                                                    </>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                className="w-full py-2 px-4 rounded-md font-medium text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                    boxShadow: darkMode ? '0 4px 12px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(59, 130, 246, 0.2)',
                                    opacity: isCreatingTapInvoice ? '0.7' : '1',
                                    cursor: isCreatingTapInvoice ? 'not-allowed' : 'pointer',
                                }}
                                type="submit"
                                disabled={isCreatingTapInvoice || !selectedInvoiceAssetId}
                            >
                                {isCreatingTapInvoice ? 'Creating Tap Asset Invoice...' : 'Create Tap Asset Invoice'}
                            </button>

                            <FeedbackMessage type="error" message={tapInvoiceError} darkMode={darkMode} />
                            <FeedbackMessage type="success" message={tapInvoiceSuccess} darkMode={darkMode} />

                            {latestTapInvoice?.paymentRequest && (
                                <div
                                    className="mt-4 p-3 rounded-md text-sm break-all"
                                    style={{
                                        backgroundColor: 'var(--input-bg)',
                                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                    }}
                                >
                                    <p className="font-semibold mb-1">Payment Request</p>
                                    <p style={{ fontFamily: 'monospace' }}>{latestTapInvoice.paymentRequest}</p>
                                    {latestTapInvoice.paymentHashHex ? (
                                        <>
                                            <p className="font-semibold mt-3 mb-1">Payment Hash</p>
                                            <p style={{ fontFamily: 'monospace' }}>{latestTapInvoice.paymentHashHex}</p>
                                        </>
                                    ) : null}
                                </div>
                            )}
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TaprootAssetsPage;
