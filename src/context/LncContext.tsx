import React, { createContext } from 'react';
import { LncState } from '../hooks/useLnc';

export const LncContext = createContext<LncState | undefined>(undefined);
export const LncProvider   = LncContext.Provider;
export const useLncContext = () => {
  const ctx = React.useContext(LncContext);
  if (!ctx) throw new Error('useLncContext outside provider');
  return ctx;
};
