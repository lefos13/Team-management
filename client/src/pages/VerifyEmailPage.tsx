/* Keep verification and resend flows in one page so users can complete signup without losing their email context. */
import { Anchor, Container, Grid, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { VerifyEmailForm, type VerifyEmailFormValues } from "../components/VerifyEmailForm";
import { useResendVerification, useVerifyEmail } from "../hooks/use-auth";
import { getErrorMessage } from "../lib/api";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();
  const defaultEmail = searchParams.get("email") ?? "";

  async function handleSubmit(values: VerifyEmailFormValues) {
    try {
      const response = await verifyMutation.mutateAsync(values);
      notifications.show({
        color: "teal",
        title: "Email verified",
        message: response.message,
      });
      navigate("/login");
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Verification failed",
        message: getErrorMessage(error, "Unable to verify the email."),
      });
    }
  }

  async function handleResend(email: string) {
    try {
      const response = await resendMutation.mutateAsync({ email });
      notifications.show({
        color: "teal",
        title: "Verification code sent",
        message: response.message,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to resend code",
        message: getErrorMessage(error, "Unable to resend the verification code."),
      });
    }
  }

  return (
    <div className="login-page">
      <Container size="lg">
        <Grid align="center" gutter="xl" mih="100vh">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              <Text className="eyebrow">Email verification</Text>
              <Title order={1} className="hero-title">
                Confirm your email before the workspace unlocks.
              </Title>
              <Text size="lg" c="dimmed">
                Enter the 6-digit code we emailed you. If the message did not arrive, request a new one from here
                without starting over.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }} offset={{ md: 1 }}>
            <Stack gap="md">
              <VerifyEmailForm
                defaultEmail={defaultEmail}
                loading={verifyMutation.isPending}
                resendLoading={resendMutation.isPending}
                errorMessage={
                  verifyMutation.isError
                    ? getErrorMessage(verifyMutation.error)
                    : resendMutation.isError
                      ? getErrorMessage(resendMutation.error)
                      : null
                }
                onSubmit={handleSubmit}
                onResend={handleResend}
              />
              <Text ta="center" c="dimmed">
                Already verified?{" "}
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
