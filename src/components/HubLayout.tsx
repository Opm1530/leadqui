import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";

// Cabeçalho padrão para páginas fora do AppLayout (DashQui, Clientes, etc.)
const HubLayout = () => {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <Outlet />
    </div>
  );
};

export default HubLayout;
