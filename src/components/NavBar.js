import React from 'react';
import { NavLink } from 'react-router-dom';

const NavBar = ({ darkMode }) => {
  const linkBase = `
    relative px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
    flex items-center gap-2
  `;

  const activeCls = `${linkBase}`;

  return (
    <nav
      className="flex items-center gap-2 px-6 py-3 border-b transition-colors duration-300"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
    >
      <NavLink
        to="/routing"
        className={({ isActive }) =>
          isActive
            ? `${activeCls} text-white`
            : `${activeCls} hover:opacity-80`
        }
        style={({ isActive }) =>
          isActive
            ? {
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              boxShadow: darkMode
                ? '0 4px 14px rgba(99,102,241,0.4)'
                : '0 4px 14px rgba(79,70,229,0.25)',
            }
            : { color: 'var(--text-secondary)', background: 'transparent' }
        }
      >
        {/* Route icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M3 6h18M3 18h12" />
        </svg>
        Routing
      </NavLink>

      <NavLink
        to="/taproot-assets"
        className={({ isActive }) =>
          isActive
            ? `${activeCls} text-white`
            : `${activeCls} hover:opacity-80`
        }
        style={({ isActive }) =>
          isActive
            ? {
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#ffffff',
              boxShadow: darkMode
                ? '0 4px 14px rgba(245,158,11,0.4)'
                : '0 4px 14px rgba(217,119,6,0.25)',
            }
            : { color: 'var(--text-secondary)', background: 'transparent' }
        }
      >
        {/* Asset icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        Taproot Assets
      </NavLink>

      <NavLink
        to="/channels"
        className={({ isActive }) =>
          isActive
            ? `${activeCls} text-white`
            : `${activeCls} hover:opacity-80`
        }
        style={({ isActive }) =>
          isActive
            ? {
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              boxShadow: darkMode
                ? '0 4px 14px rgba(16,185,129,0.4)'
                : '0 4px 14px rgba(5,150,105,0.25)',
            }
            : { color: 'var(--text-secondary)', background: 'transparent' }
        }
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
        Channels
      </NavLink>
    </nav>
  );
};

export default NavBar;
