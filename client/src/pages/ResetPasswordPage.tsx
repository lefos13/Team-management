/* Keep OTP submission and resend on one page so the recovery flow mirrors email verification and preserves the current email context. */
import { Anchor, Container, Grid, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ResetPasswordForm, type ResetPasswordFormValues } from "../components/ResetPasswordForm";
import { useRequestPasswordReset, useResetPassword } from "../hooks/use-auth";
import { getErrorMessage } from "../lib/api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetPasswordMutation = useResetPassword();
  const requestResetMutation = useRequestPasswordReset();
  const defaultEmail = searchParams.get("email") ?? "";

  async function handleSubmit(values: ResetPasswordFormValues) {
    try {
      const response = await resetPasswordMutation.mutateAsync(values);
      notifications.show({
        color: "teal",
        title: "Password updated",
        message: response.message,
      });
      navigate("/login");
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to reset password",
        message: getErrorMessage(error, "Unable to reset the password."),
      });
    }
  }

  async function handleResend(email: string) {
    try {
      const response = await requestResetMutation.mutateAsync({ email });
      notifications.show({
        color: "teal",
        title: "Reset code sent",
        message: response.message,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to resend code",
        message: getErrorMessage(error, "Unable to resend the reset code."),
      });
    }
  }

  return (
    <div className="login-page">
      <Container size="lg">
        <Grid align="center" gutter="xl" mih="100vh">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              <Text className="eyebrow">Reset password</Text>
              <Title order={1} className="hero-title">
                Verify the email code and set a new password.
              </Title>
              <Text size="lg" c="dimmed">
                Enter the 6-digit reset code we emailed you and choose a new password. If the email did not arrive,
                request another code without leaving this screen.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }} offset={{ md: 1 }}>
            <Stack gap="md">
              <ResetPasswordForm
                defaultEmail={defaultEmail}
                loading={resetPasswordMutation.isPending}
                resendLoading={requestResetMutation.isPending}
                errorMessage={
                  resetPasswordMutation.isError
                    ? getErrorMessage(resetPasswordMutation.error)
                    : requestResetMutation.isError
                      ? getErrorMessage(requestResetMutation.error)
                      : null
                }
                onSubmit={handleSubmit}
                onResend={handleResend}
              />
              <Text ta="center" c="dimmed">
                Need a different email?{" "}
                <Anchor component={Link} to="/forgot-password">
                  Start over
                </Anchor>
              </Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}
