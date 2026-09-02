/* Public showcase and control room preview for the Team Management workspace. */
import { Anchor, Modal, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { LoginForm, type LoginFormValues } from "../components/LoginForm";
import { RegisterForm, type RegisterFormValues } from "../components/RegisterForm";
import {
  CollaborationShowcase,
  LandingCta,
  LandingFooter,
  LandingHeader,
  LandingHero,
  VisibilityShowcase,
  WorkflowShowcase,
} from "../components/landing";

type AuthMode = "login" | "register";

type AuthLandingPageProps = {
  mode: AuthMode;
  loginLoading: boolean;
  loginErrorMessage: string | null;
  registerLoading: boolean;
  registerErrorMessage: string | null;
  onLoginSubmit: (values: LoginFormValues) => void;
  onRegisterSubmit: (values: RegisterFormValues) => void;
};

export function AuthLandingPage({
  mode,
  loginLoading,
  loginErrorMessage,
  registerLoading,
  registerErrorMessage,
  onLoginSubmit,
  onRegisterSubmit,
}: AuthLandingPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldOpenModal = mode === "register" || Boolean(location.state?.openAuthModal);
  const [modalOpened, setModalOpened] = useState(shouldOpenModal);
  const modalTitle = mode === "login" ? "Sign in to your workspace" : "Create your workspace";

  useEffect(() => {
    setModalOpened(shouldOpenModal);
  }, [shouldOpenModal]);

  function switchMode(nextMode: AuthMode) {
    if (nextMode === mode) {
      setModalOpened(true);
      return;
    }

    navigate(nextMode === "login" ? "/login" : "/register", {
      state: { openAuthModal: true, from: location.state?.from },
    });
  }

  return (
    <div className="landing-page-root">
      {/* Sticky Top Navigation */}
      <LandingHeader
        onOpenLogin={() => switchMode("login")}
        onOpenRegister={() => switchMode("register")}
      />

      {/* Main Content Sections */}
      <main>
        <LandingHero
          onOpenLogin={() => switchMode("login")}
          onOpenRegister={() => switchMode("register")}
        />

        <WorkflowShowcase />

        <VisibilityShowcase />

        <CollaborationShowcase />

        <LandingCta
          onOpenLogin={() => switchMode("login")}
          onOpenRegister={() => switchMode("register")}
        />
      </main>

      {/* Global Footer */}
      <LandingFooter />

      {/* Auth Modal (Login / Register) */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={modalTitle}
        centered
        radius="md"
        size="md"
        overlayProps={{ backgroundOpacity: 0.42, blur: 6 }}
      >
        <Stack gap="md">
          {mode === "login" ? (
            <>
              <LoginForm
                framed={false}
                loading={loginLoading}
                errorMessage={loginErrorMessage}
                onSubmit={onLoginSubmit}
              />
              <Text ta="center" c="dimmed" size="sm">
                New here?{" "}
                <Anchor component="button" type="button" onClick={() => switchMode("register")}>
                  Create an account
                </Anchor>
              </Text>
            </>
          ) : (
            <>
              <RegisterForm
                framed={false}
                loading={registerLoading}
                errorMessage={registerErrorMessage}
                onSubmit={onRegisterSubmit}
              />
              <Text ta="center" c="dimmed" size="sm">
                Already registered?{" "}
                <Anchor component="button" type="button" onClick={() => switchMode("login")}>
                  Sign in
                </Anchor>
              </Text>
            </>
          )}
          {mode === "login" ? (
            <Anchor component={Link} to="/forgot-password" size="sm" ta="center">
              Forgot password?
            </Anchor>
          ) : null}
        </Stack>
      </Modal>
    </div>
  );
}
