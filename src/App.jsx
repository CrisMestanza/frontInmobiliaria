import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { Suspense } from "react";
import MyMap from "./pages/mapa/Map.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import GlobalAlertOverlay from "./components/ui/GlobalAlertOverlay.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import { AdminProvider } from "./pages/admin/AdminContext.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";

const LoginLayout = React.lazy(() => import("./pages/login/LoginLayout.jsx"));
const Register = React.lazy(() => import("./pages/registro/Registro.jsx"));
const GeoHabita = React.lazy(() => import("./pages/landing/Landing.jsx"));
const GeoHabitaRecovery = React.lazy(() => import("./pages/recovery/Recovery.jsx"));
const ActivateAccount = React.lazy(() => import("./pages/activation/ActivateAccount.jsx"));
const NotFound = React.lazy(() => import("./pages/NotFound/NotFound.jsx"));
const Visor360Page = React.lazy(() => import("./pages/visor360/Visor360Page.jsx"));
const Overview = React.lazy(() => import("./pages/admin/modules/overview/Overview.jsx"));
const Projects = React.lazy(() => import("./pages/admin/modules/projects/Projects.jsx"));
const ProjectCreate = React.lazy(() => import("./pages/admin/modules/projects/ProjectCreate.jsx"));
const ProjectEdit = React.lazy(() => import("./pages/admin/modules/projects/ProjectEdit.jsx"));
const Lots = React.lazy(() => import("./pages/admin/modules/lots/Lots.jsx"));
const LotProjectList = React.lazy(() => import("./pages/admin/modules/lots/LotProjectList.jsx"));
const LotCreate = React.lazy(() => import("./pages/admin/modules/lots/LotCreate.jsx"));
const LotEdit = React.lazy(() => import("./pages/admin/modules/lots/LotEdit.jsx"));
const Planning = React.lazy(() => import("./pages/admin/modules/planning/Planning.jsx"));
const PlanningGenerate = React.lazy(() => import("./pages/admin/modules/planning/PlanningGenerate.jsx"));
const PlanningPdf = React.lazy(() => import("./pages/admin/modules/planning/PlanningPdf.jsx"));
const Spaces = React.lazy(() => import("./pages/admin/modules/spaces/Spaces.jsx"));
const Icons = React.lazy(() => import("./pages/admin/modules/icons/Icons.jsx"));
const Financing = React.lazy(() => import("./pages/admin/modules/financing/Financing.jsx"));
const Media = React.lazy(() => import("./pages/admin/modules/media/Media.jsx"));
const MediaTour = React.lazy(() => import("./pages/admin/modules/media/MediaTour.jsx"));
const Leads = React.lazy(() => import("./pages/admin/modules/leads/Leads.jsx"));
const PublicMap = React.lazy(() => import("./pages/admin/modules/publicMap/PublicMap.jsx"));
const SettingsPage = React.lazy(() => import("./pages/admin/modules/settings/Settings.jsx"));

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
