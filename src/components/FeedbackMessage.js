import React from 'react';

const FeedbackMessage = ({ type, message, darkMode }) => {
  if (!message) return null;

  const baseStyle = "mt-4 p-3 rounded-md text-sm";
  let style = {};

  if (type === 'error') {
    style = {
      backgroundColor: 'var(--error-bg)',
      color: 'var(--error-text)',
      border: `1px solid ${darkMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)'}`
    };
  } else if (type === 'success') {
    style = {
      backgroundColor: 'var(--success-bg)',
      color: 'var(--success-text)',
      border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`
    };
  } else { // Default or info
     style = {
      backgroundColor: 'var(--info-bg, var(--input-bg))', // Add --info-bg to your theme or fallback
      color: 'var(--info-text, var(--text-primary))',
      border: `1px solid ${darkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`
    };
  }

  return (
    <div className={baseStyle} style={style}>
      {message}
    </div>
  );
};

export default FeedbackMessage;