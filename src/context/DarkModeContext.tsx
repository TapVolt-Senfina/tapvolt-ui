import React, { createContext, useState, useEffect, useContext } from 'react';

interface Ctx { dark: boolean; toggle(): void }
const DarkCtx = createContext<Ctx | undefined>(undefined);

export const DarkModeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : prefers;
  });

  const toggle = () => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem('darkMode', JSON.stringify(next));
      return next;
    });
  };

  /* apply CSS vars */
  useEffect(() => { document.body.classList.toggle('dark-mode', dark); }, [dark]);

  return <DarkCtx.Provider value={{ dark, toggle }}>{children}</DarkCtx.Provider>;
};

export const useDarkMode = () => {
  const ctx = useContext(DarkCtx);
  if (!ctx) throw new Error('useDarkMode outside provider');
  return ctx;
};
