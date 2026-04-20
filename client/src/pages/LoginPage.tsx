/* Give each account a clean sign-in entry point now that the app supports verified cloud workspaces. */
import { Anchor, Container, Grid, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate } from "react-router-dom";

import { LoginForm, type LoginFormValues } from "../components/LoginForm";
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
    <div className="login-page">
      <Container size="lg">
        <Grid align="center" gutter="xl" mih="100vh">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              <Text className="eyebrow">Verified account access</Text>
              <Title order={1} className="hero-title">
                Run your own team workspace from anywhere.
              </Title>
              <Text size="lg" c="dimmed">
                Create an account, verify your email, and manage your own projects, team members, tasks, and calendar
                from a cloud-hosted workspace.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }} offset={{ md: 1 }}>
            <Stack gap="md">
              <LoginForm
                loading={loginMutation.isPending}
                errorMessage={loginMutation.isError ? getErrorMessage(loginMutation.error, "Unable to sign in.") : null}
                onSubmit={handleSubmit}
              />
              <Text ta="center" c="dimmed">
                New here?{" "}
                <Anchor component={Link} to="/register">
                  Create an account
                </Anchor>
              </Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}
