import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { Suspense } from "react";
import MyMap from "./pages/mapa/Map.jsx";
import LoginLayout from "./pages/login/LoginLayout.jsx";
import Register from "./pages/registro/Registro.jsx";
import PanelInmo from "./pages/panel/PanelInmo.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import GeoHabita from "./pages/landing/Landing.jsx";
import GeoHabitaRecovery from "./pages/recovery/Recovery.jsx";
import ActivateAccount from "./pages/activation/ActivateAccount.jsx";
import GlobalAlertOverlay from "./components/ui/GlobalAlertOverlay.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
const NotFound = React.lazy(() => import("./pages/NotFound/NotFound.jsx"));

function App() {
  return (
    <BrowserRouter>
      <GlobalAlertOverlay />
      <OfflineBanner />
      <Suspense fallback={null}>
        <Routes>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
