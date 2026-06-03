import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

type Module = "leadqui" | "tasqui" | "teamqui" | "cashqui" | "techqui";

interface ModuleContextType {
  activeModule: Module;
  setActiveModule: (module: Module) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModuleState] = useState<Module>(() => {
    return (localStorage.getItem("pequi_active_module") as Module) || "leadqui";
  });

  const setActiveModule = (module: Module) => {
    setActiveModuleState(module);
    localStorage.setItem("pequi_active_module", module);
  };

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule }}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModule = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error("useModule must be used within a ModuleProvider");
  }
  return context;
};
