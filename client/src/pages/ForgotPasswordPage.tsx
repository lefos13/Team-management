/* Keep recovery entry separate from login so users can request a reset code without mixing login errors and reset-state messaging. */
import { Anchor, Container, Grid, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ForgotPasswordForm, type ForgotPasswordFormValues } from "../components/ForgotPasswordForm";
import { useRequestPasswordReset } from "../hooks/use-auth";
import { getErrorMessage } from "../lib/api";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestResetMutation = useRequestPasswordReset();
  const defaultEmail = searchParams.get("email") ?? "";

  async function handleSubmit(values: ForgotPasswordFormValues) {
    try {
      const response = await requestResetMutation.mutateAsync(values);
      notifications.show({
        color: "teal",
        title: "Reset code sent",
        message: response.message,
      });
      navigate(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to send reset code",
        message: getErrorMessage(error, "Unable to start the password reset flow."),
      });
    }
  }

  return (
    <div className="login-page">
      <Container size="lg">
        <Grid align="center" gutter="xl" mih="100vh">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              <Text className="eyebrow">Password recovery</Text>
              <Title order={1} className="hero-title">
                Recover access with a reset code sent to your email.
              </Title>
              <Text size="lg" c="dimmed">
                Enter the email you use for Team Management and we will send a 6-digit code if the account is ready
                for password recovery.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }} offset={{ md: 1 }}>
            <Stack gap="md">
              <ForgotPasswordForm
                defaultEmail={defaultEmail}
                loading={requestResetMutation.isPending}
                errorMessage={
                  requestResetMutation.isError ? getErrorMessage(requestResetMutation.error, "Unable to send code.") : null
                }
                onSubmit={handleSubmit}
              />
              <Text ta="center" c="dimmed">
                Remembered it?{" "}
                <Anchor component={Link} to="/login">
                  Sign in
                </Anchor>
              </Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}
