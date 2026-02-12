import React from 'react';
import DarkModeToggle from './DarkModeToggle';
import FeedbackMessage from './FeedbackMessage';

const ConnectScreen = ({
  darkMode,
  toggleDarkMode,
  pairingPhrase,
  setPairingPhrase,
  password,
  setPassword,
  isConnecting,
  handleConnect,
  handleLogin,
  connectionError,
  isPaired
}) => {
  return (
    <div
      className="flex flex-col justify-center items-center min-h-screen p-4"
      style={{
        background: darkMode
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
          : 'linear-gradient(135deg, #c7d2fe 0%, #ede9fe 100%)',
        color: 'var(--text-primary)'
      }}
    >
      <DarkModeToggle
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        className="absolute top-4 right-4"
      />

      <img
        src="/favicon.png"
        alt="Senfina TapVolt Logo"
        className="w-24 h-24 mb-6"
      />

      <div className="text-center mb-8">
        <h1
          className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tighter"
          style={{
            color: darkMode ? '#ffffff' : '#1e293b',
            textShadow: darkMode
              ? '0 2px 10px rgba(99, 102, 241, 0.5)'
              : '0 2px 5px rgba(0, 0, 0, 0.1)'
          }}
        >
          Senfina TapVolt
        </h1>
        <p
          className="text-lg md:text-xl max-w-xl leading-relaxed mx-auto"
          style={{ color: darkMode ? '#b4b4b4' : '#4b5563' }}
        >
          {isPaired
            ? 'Login to your previously connected node.'
            : 'Connect your LNC-enabled node.'}
        </p>
      </div>

      <div
        className="bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-10 w-full max-w-md transition-all duration-300"
        style={{
          background: darkMode
            ? 'rgba(30, 30, 40, 0.7)'
            : 'rgba(255, 255, 255, 0.85)',
          boxShadow: darkMode
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: `1px solid ${
            darkMode
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.05)'
          }`
        }}
      >
        <h2
          className="text-2xl font-bold mb-6 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          {isPaired ? 'Login' : 'Connect Your Node'}
        </h2>

        <form onSubmit={isPaired ? handleLogin : handleConnect}>
          
          {/* Pairing phrase only shown first time */}
          {!isPaired && (
            <div className="mb-5">
              <label
                className="block text-sm font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
                htmlFor="pairingPhrase"
              >
                LNC Pairing Phrase
              </label>
              <textarea
                id="pairingPhrase"
                className="w-full px-4 py-3 rounded-lg transition-colors duration-200"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${
                    darkMode
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)'
                  }`,
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}
                placeholder="Enter pairing phrase..."
                value={pairingPhrase}
                onChange={(e) => setPairingPhrase(e.target.value)}
                required
                rows="4"
                disabled={isConnecting}
              />
            </div>
          )}

          {/* Password field (always required) */}
          <div className="mb-5">
            <label
              className="block text-sm font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-3 rounded-lg transition-colors duration-200"
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: `1px solid ${
                  darkMode
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.1)'
                }`,
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
              }}
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isConnecting}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg font-bold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, var(--accent-light), var(--accent-dark))`,
              boxShadow: darkMode
                ? '0 4px 12px rgba(79, 70, 229, 0.3)'
                : '0 4px 12px rgba(79, 70, 229, 0.2)'
            }}
            disabled={isConnecting}
          >
            {isConnecting
              ? 'Connecting...'
              : isPaired
                ? 'Login'
                : 'Connect & Save Session'}
          </button>
        </form>

        <FeedbackMessage
          type="error"
          message={connectionError}
          darkMode={darkMode}
        />

        <div
          className="mt-8 text-center"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p className="text-sm">
            Powered by Lightning Node Connect
          </p>
          <p className="text-xs mt-2">
            Need help?
            <a
              href="https://docs.lightning.engineering/lightning-network-tools/lightning-node-connect/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 transition-colors duration-200"
              style={{ color: 'var(--accent-light)' }}
            >
              Documentation
            </a>
          </p>
        </div>
      </div>

      <div
        className="absolute bottom-6 text-center text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        © {new Date().getFullYear()} Senfina TapVolt Demo
      </div>
    </div>
  );
};

export default ConnectScreen;
