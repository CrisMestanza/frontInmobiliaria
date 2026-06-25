import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { Suspense } from "react";
import MyMap from "./pages/mapa/Map.jsx";
import LoginLayout from "./pages/login/LoginLayout.jsx";
import Register from "./pages/registro/Registro.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import GeoHabita from "./pages/landing/Landing.jsx";
import GeoHabitaRecovery from "./pages/recovery/Recovery.jsx";
import ActivateAccount from "./pages/activation/ActivateAccount.jsx";
import GlobalAlertOverlay from "./components/ui/GlobalAlertOverlay.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import { AdminProvider } from "./pages/admin/AdminContext.jsx";
import Overview from "./pages/admin/modules/overview/Overview.jsx";
import Projects from "./pages/admin/modules/projects/Projects.jsx";
import ProjectCreate from "./pages/admin/modules/projects/ProjectCreate.jsx";
import ProjectEdit from "./pages/admin/modules/projects/ProjectEdit.jsx";
import Lots from "./pages/admin/modules/lots/Lots.jsx";
import LotProjectList from "./pages/admin/modules/lots/LotProjectList.jsx";
import LotCreate from "./pages/admin/modules/lots/LotCreate.jsx";
import LotEdit from "./pages/admin/modules/lots/LotEdit.jsx";
import Planning from "./pages/admin/modules/planning/Planning.jsx";
import PlanningGenerate from "./pages/admin/modules/planning/PlanningGenerate.jsx";
import PlanningPdf from "./pages/admin/modules/planning/PlanningPdf.jsx";
import Spaces from "./pages/admin/modules/spaces/Spaces.jsx";
import Icons from "./pages/admin/modules/icons/Icons.jsx";
import Financing from "./pages/admin/modules/financing/Financing.jsx";
import Media from "./pages/admin/modules/media/Media.jsx";
import MediaTour from "./pages/admin/modules/media/MediaTour.jsx";
import Leads from "./pages/admin/modules/leads/Leads.jsx";
import PublicMap from "./pages/admin/modules/publicMap/PublicMap.jsx";
import SettingsPage from "./pages/admin/modules/settings/Settings.jsx";
const NotFound = React.lazy(() => import("./pages/NotFound/NotFound.jsx"));
const Visor360Page = React.lazy(() => import("./pages/visor360/Visor360Page.jsx"));

function AdminShell({ setAppLoading }) {
  return (
    <AdminProvider>
      <AdminLayout setAppLoading={setAppLoading} />
    </AdminProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <GlobalAlertOverlay />
      <OfflineBanner />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/mapa/:inmoId" element={<MyMap />} />
          <Route path="/visor360/:projectId" element={<Visor360Page />} />
          <Route path="/login" element={<LoginLayout />} />
          <Route path="/register" element={<Register />} />
          <Route path="/inicio" element={<GeoHabita />} />
          <Route path="/recovery" element={<GeoHabitaRecovery />} />
          <Route path="/activar-cuenta" element={<ActivateAccount />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <AdminShell />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="resumen" replace />} />
            <Route path="resumen" element={<Overview />} />
            <Route path="proyectos" element={<Projects />} />
            <Route path="proyectos/agregar" element={<ProjectCreate />} />
            <Route path="proyectos/:projectId/editar" element={<ProjectEdit />} />
            <Route path="lotes" element={<Lots />} />
            <Route path="lotes/:projectId" element={<LotProjectList />} />
            <Route path="lotes/:projectId/nuevo" element={<LotCreate />} />
            <Route path="lotes/:projectId/:loteId/editar" element={<LotEdit />} />
            <Route path="plano" element={<Planning />} />
            <Route path="plano/:projectId" element={<Planning />} />
            <Route path="plano/:projectId/generar" element={<PlanningGenerate />} />
            <Route path="plano/:projectId/pdf" element={<PlanningPdf />} />
            <Route path="espacios" element={<Spaces />} />
            <Route path="espacios/:projectId" element={<Spaces />} />
            <Route path="iconos" element={<Icons />} />
            <Route path="iconos/:projectId" element={<Icons />} />
            <Route path="financiamiento" element={<Financing />} />
            <Route path="financiamiento/:projectId" element={<Financing />} />
            <Route path="media" element={<Media />} />
            <Route path="media/:projectId" element={<Media />} />
            <Route path="media/:projectId/tour360" element={<MediaTour />} />
            <Route path="leads" element={<Leads />} />
            <Route path="mapa-publico" element={<PublicMap />} />
            <Route path="configuracion" element={<SettingsPage />} />
          </Route>
          <Route path="/" element={<MyMap />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
