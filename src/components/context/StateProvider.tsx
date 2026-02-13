import { createContext, useContext, useState, type ReactNode } from "react";

type AppName = "home" | "app2";

type StateContextValue = {
  currentApp: AppName;
  setCurrentApp: React.Dispatch<React.SetStateAction<AppName>>;
};

const StateContext = createContext<StateContextValue | null>(null);

export function useStateContext() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error("useStateContext must be used within a StateProvider");
  }
  return context;
}

export default function StateProvider({ children }: { children: ReactNode }) {
  const [currentApp, setCurrentApp] = useState<AppName>("home");
  return (
    <StateContext.Provider value={{ currentApp, setCurrentApp }}>
      {children}
    </StateContext.Provider>
  );
}
