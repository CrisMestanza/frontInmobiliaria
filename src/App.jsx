import { BrowserRouter, Routes, Route } from "react-router-dom";
import InmobiliariaForm from "./pages/inmobiliaria/agregarInmo.jsx";
import LotesList from "./pages/inmobiliaria/lote/LotesList.jsx";
import ProyectoList from "./pages/inmobiliaria/proyecto/ProyectoList.jsx";
import MyMap from "./pages/mapa/Map.jsx";
import LoginLayout from "./pages/login/LoginLayout.jsx";
import Register from "./pages/registro/Registro.jsx";
import PanelInmo from "./pages/panel/PanelInmo.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";

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
