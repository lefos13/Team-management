/* Route public auth and protected manager views through one browser router to keep navigation predictable. */
import type { ReactElement } from "react";
import { Center, Loader } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Navigate, BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { CookieBanner } from "./components/CookieBanner";
import { AppShellLayout } from "./layouts/AppShellLayout";
import { CalendarPage } from "./pages/CalendarPage";
import { AcceptProjectInvitationPage } from "./pages/AcceptProjectInvitationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LegalPage } from "./pages/LegalPage";
import { LoginPage } from "./pages/LoginPage";
import { MembersPage } from "./pages/MembersPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { TasksPage } from "./pages/TasksPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { TaskSharePreviewPage } from "./pages/TaskSharePreviewPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { getCurrentUser } from "./hooks/use-auth";

const routerBase = import.meta.env.BASE_URL === "/" ? "/" : import.meta.env.BASE_URL.replace(/\/$/, "");

function FullScreenLoader() {
  return (
    <Center mih="100vh">
      <Loader color="teal" size="lg" />
    </Center>
  );
}

function RequireAuth() {
  const location = useLocation();
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: getCurrentUser,
    retry: false,
  });

  if (sessionQuery.isLoading) {
    return <FullScreenLoader />;
  }

  if (!sessionQuery.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <AppShellLayout />;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: getCurrentUser,
    retry: false,
  });

  if (sessionQuery.isLoading) {
    return <FullScreenLoader />;
  }

  if (sessionQuery.data) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export function App() {
  return (
    <BrowserRouter basename={routerBase}>
      <CookieBanner />
      <Routes>
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/cookies" element={<LegalPage kind="cookies" />} />
        <Route path="/share/tasks/:token" element={<TaskSharePreviewPage />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/verify-email"
          element={
            <PublicOnlyRoute>
              <VerifyEmailPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicOnlyRoute>
              <ResetPasswordPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/" element={<RequireAuth />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/invitations/accept" element={<AcceptProjectInvitationPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
