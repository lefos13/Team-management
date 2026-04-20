/* Keep registration focused on account creation and defer verification to the dedicated OTP step. */
import { Anchor, Container, Grid, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate } from "react-router-dom";

import { RegisterForm, type RegisterFormValues } from "../components/RegisterForm";
import { useRegister } from "../hooks/use-auth";
import { getErrorMessage } from "../lib/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();

  async function handleSubmit(values: RegisterFormValues) {
    try {
      const response = await registerMutation.mutateAsync(values);
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
    <div className="login-page">
      <Container size="lg">
        <Grid align="center" gutter="xl" mih="100vh">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              <Text className="eyebrow">Verified account setup</Text>
              <Title order={1} className="hero-title">
                Create a private workspace for your team operations.
              </Title>
              <Text size="lg" c="dimmed">
                Each account owns a separate workspace. Your projects, members, tasks, and deadlines stay isolated from
                every other account on the server.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }} offset={{ md: 1 }}>
            <Stack gap="md">
              <RegisterForm
                loading={registerMutation.isPending}
                errorMessage={registerMutation.isError ? getErrorMessage(registerMutation.error) : null}
                onSubmit={handleSubmit}
              />
              <Text ta="center" c="dimmed">
                Already registered?{" "}
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
