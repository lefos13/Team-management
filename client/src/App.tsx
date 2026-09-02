/* Route public auth and protected manager views through one browser router to keep navigation predictable. */
import type { ReactElement } from "react";
import { Anchor, Button, Center, Container, Group, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { CookieBanner } from "./components/CookieBanner";
import { AppShellLayout } from "./layouts/AppShellLayout";
import { CalendarPage } from "./pages/CalendarPage";
import { AcceptProjectInvitationPage } from "./pages/AcceptProjectInvitationPage";
import { AdminPage } from "./pages/AdminPage";
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
import { WhatsNewPage } from "./pages/WhatsNewPage";

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
    const isWhatsNew = location.pathname.replace(/\/$/, "") === "/whats-new";
    if (isWhatsNew) {
      return <PublicWhatsNewLayout />;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <AppShellLayout />;
}

function PublicWhatsNewLayout() {
  return (
    <main className="public-whats-new-page">
      <Container size="lg" py={{ base: "md", sm: "xl" }} px={{ base: "sm", sm: "md" }}>
        <Stack gap="xl">
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Anchor component={Link} to="/" fw={800} c="dark" className="site-brand-link" underline="never">
              <Group gap="xs" wrap="nowrap">
                <img className="site-brand-logo site-brand-logo-small" src="/logo.png" alt="MGteam logo" />
                <Text fw={900} size="md" c="dark">
                  MGteam
                </Text>
              </Group>
            </Anchor>
            <Group gap="xs">
              <Button component={Link} to="/login" variant="subtle" color="dark" size="sm">
                Sign in
              </Button>
              <Button component={Link} to="/register" color="teal" size="sm">
                Create account
              </Button>
            </Group>
          </Group>
          <Outlet />
        </Stack>
      </Container>
    </main>
  );
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
        <Route path="/admin/*" element={<AdminPage />} />
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
          <Route path="whats-new" element={<WhatsNewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
