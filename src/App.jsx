import { BrowserRouter, Routes, Route } from "react-router-dom";
import MyMap from "./pages/mapa/Map.jsx";
import LoginLayout from "./pages/login/LoginLayout.jsx";
import Register from "./pages/registro/Registro.jsx";
import PanelInmo from "./pages/panel/PanelInmo.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import GeoHabita from "./pages/landing/Landing.jsx";
import GeoHabitaRecovery from "./pages/recovery/Recovery.jsx";
import ActivateAccount from "./pages/activation/ActivateAccount.jsx";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* <Route path="/agregar" element={<InmobiliariaForm />} /> */}
        {/* <Route path="/lotes/:idproyecto" element={<LotesList />} />
        <Route path="/proyectos/:idinmobiliaria" element={<ProyectoList />} /> */}
        <Route path="/mapa/:inmoId" element={<MyMap />} />
        <Route path="/login" element={<LoginLayout />} />
        <Route path="/register" element={<Register />} />
        <Route path="/inicio" element={<GeoHabita />} />
        <Route path="/recovery" element={<GeoHabitaRecovery />} />
        <Route path="/activar-cuenta" element={<ActivateAccount />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <PanelInmo />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<MyMap />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
