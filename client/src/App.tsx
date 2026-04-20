/* Route public auth and protected manager views through one browser router to keep navigation predictable. */
import type { ReactElement } from "react";
import { Center, Loader } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Navigate, BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { AppShellLayout } from "./layouts/AppShellLayout";
import { CalendarPage } from "./pages/CalendarPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { MembersPage } from "./pages/MembersPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { TasksPage } from "./pages/TasksPage";
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
      <Routes>
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
          <Route path="members" element={<MembersPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
