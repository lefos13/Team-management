/* Reuse the product landing page for registration so account creation opens from the same public preview. */
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";

import { AuthLandingPage } from "./AuthLandingPage";
import type { RegisterFormValues } from "../components/RegisterForm";
import { useRegister } from "../hooks/use-auth";
import { getErrorMessage } from "../lib/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();

  async function handleSubmit(values: RegisterFormValues) {
    try {
      const response = await registerMutation.mutateAsync({
        email: values.email,
        password: values.password,
        acceptedTerms: true,
        legalVersion: values.legalVersion,
      });
      notifications.show({
        color: "teal",
        title: "Verification required",
        message: response.message,
      });
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Registration failed",
        message: getErrorMessage(error, "Unable to create your account."),
      });
    }
  }

  return (
    <AuthLandingPage
      mode="register"
      loginLoading={false}
      loginErrorMessage={null}
      registerLoading={registerMutation.isPending}
      registerErrorMessage={registerMutation.isError ? getErrorMessage(registerMutation.error) : null}
      onLoginSubmit={() => undefined}
      onRegisterSubmit={handleSubmit}
    />
  );
}
