import React, { createContext, useContext, useState } from 'react';

export type AppName =
  | 'home'
  | 'rag-chatbot'
  | 'summarizer'
  | 'web-scraper'
  | 'email-assistant'
  | 'recipe-generator';

interface AppState {
  currentApp: AppName;
  setCurrentApp: (app: AppName) => void;
}

const AppStateContext = createContext<AppState>({
  currentApp: 'home',
  setCurrentApp: () => {},
});

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [currentApp, setCurrentApp] = useState<AppName>('home');
  return (
    <AppStateContext.Provider value={{ currentApp, setCurrentApp }}>
      {children}
    </AppStateContext.Provider>
  );
}

export const useAppState = () => useContext(AppStateContext);
