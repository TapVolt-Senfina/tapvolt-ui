import React from 'react';
import FeedbackMessage from './FeedbackMessage';

const MintAssetForm = ({
  mintAssetName, setMintAssetName,
  mintAssetAmount, setMintAssetAmount,
  mintAssetType, // Current type
  onAssetTypeChange, // Handler for type change from App.js
  mintAssetFilePreview, // Preview URL from App.js
  onFileChange, // Handler for file input change from App.js
  mintAssetMeta, setMintAssetMeta,
  isMinting,
  mintAssetError,
  mintAssetSuccess,
  darkMode,
  onSubmit // This is handleMintAssetSubmit from App.js
}) => {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Mint New Asset</h2>
      <form onSubmit={onSubmit} className="rounded-xl transition-colors duration-300 p-6" style={{ backgroundColor: 'var(--form-bg)', border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`, boxShadow: darkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
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
                onChange={onAssetTypeChange} // Use handler from App.js
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
                    onChange={onFileChange} // Use handler from App.js
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
        <FeedbackMessage type="error" message={mintAssetError} darkMode={darkMode} />
        <FeedbackMessage type="success" message={mintAssetSuccess} darkMode={darkMode} />
      </form>
    </section>
  );
};

export default MintAssetForm;