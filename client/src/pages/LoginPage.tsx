/* Reuse the product landing page for sign-in so auth starts in a modal without hiding the app value. */
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";

import { AuthLandingPage } from "./AuthLandingPage";
import type { LoginFormValues } from "../components/LoginForm";
import { useLogin } from "../hooks/use-auth";
import { getErrorMessage } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();

  async function handleSubmit(values: LoginFormValues) {
    try {
      await loginMutation.mutateAsync(values);
      navigate("/");
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Login failed",
        message: getErrorMessage(error, "Unable to sign in."),
      });
    }
  }

  return (
    <AuthLandingPage
      mode="login"
      loginLoading={loginMutation.isPending}
      loginErrorMessage={loginMutation.isError ? getErrorMessage(loginMutation.error, "Unable to sign in.") : null}
      registerLoading={false}
      registerErrorMessage={null}
      onLoginSubmit={handleSubmit}
      onRegisterSubmit={() => undefined}
    />
  );
}
