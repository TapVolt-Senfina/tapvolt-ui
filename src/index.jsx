import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Buffer } from 'buffer';

window.Buffer = Buffer;

if (typeof window !== 'undefined') {
  window.process = {
    ...window.process,
    env: { ...(window.process?.env || {}) },
    getuid: () => 0,
    getgid: () => 0,
    cwd: () => '/',
  };
}
const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
