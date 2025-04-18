import React from 'react';
import { root, RootStore } from '../stores/RootStore';

export const StoreContext = React.createContext<RootStore>(root);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StoreContext.Provider value={root}>{children}</StoreContext.Provider>
);
