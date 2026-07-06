/* Build one public product preview for auth routes so sign-in and registration
stay focused in modals while visitors can understand the workspace value first. */
import {
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconChartBar,
  IconChecklist,
  IconFolder,
  IconLogin2,
  IconUsers,
  IconUserPlus,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { LoginForm, type LoginFormValues } from "../components/LoginForm";
import { RegisterForm, type RegisterFormValues } from "../components/RegisterForm";

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

const features = [
  {
    icon: IconFolder,
    title: "Plan projects clearly",
    description: "Keep active work, owners, and status in one organized workspace.",
  },
  {
    icon: IconUsers,
    title: "Know who owns what",
    description: "Track team members, roles, workload, and assigned tasks without spreadsheets.",
  },
  {
    icon: IconChecklist,
    title: "Move tasks forward",
    description: "Follow open, blocked, and completed work with deadlines that stay visible.",
  },
  {
    icon: IconCalendarEvent,
    title: "See dates early",
    description: "Use the calendar to spot upcoming delivery dates before they become urgent.",
  },
];

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
    <main className="landing-page">
      <Container size="xl" py={{ base: "xl", md: 48 }}>
        <Group justify="space-between" align="center" className="landing-nav">
          <Group gap="sm" className="site-brand" wrap="nowrap">
            <img className="site-brand-logo" src="/logo.png" alt="Team Management logo" />
            <Text fw={800} size="lg">
              Team Management
            </Text>
          </Group>
          <Group gap="sm">
            <Button variant="subtle" color="dark" radius="md" onClick={() => switchMode("login")}>
              Sign in
            </Button>
            <Button radius="md" leftSection={<IconUserPlus size={18} />} onClick={() => switchMode("register")}>
              Create account
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={{ base: 36, lg: 56 }} className="landing-hero">
          <Stack gap="xl" justify="center">
            <Stack gap="md">
              <Badge className="eyebrow" variant="light" color="teal">
                Project work, people, tasks, and dates
              </Badge>
              <Title order={1} className="landing-title">
                A simple control room for team work.
              </Title>
              <Text size="xl" c="dimmed" maw={640}>
                Team Management helps you organize projects, assign people, follow deadlines, and see what needs
                attention before work gets lost.
              </Text>
            </Stack>

            <Group gap="md">
              <Button size="lg" radius="md" leftSection={<IconLogin2 size={20} />} onClick={() => switchMode("login")}>
                Sign in
              </Button>
              <Button size="lg" radius="md" variant="light" onClick={() => switchMode("register")}>
                Start with an account
              </Button>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {features.map((feature) => (
                <Paper key={feature.title} className="feature-card" radius="md" p="md" withBorder>
                  <Group align="flex-start" gap="sm" wrap="nowrap">
                    <ThemeIcon radius="md" variant="light" color="teal" size={38}>
                      <feature.icon size={20} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={800}>{feature.title}</Text>
                      <Text size="sm" c="dimmed">
                        {feature.description}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          </Stack>

          <Box className="product-preview" aria-label="Team workspace preview">
            <Paper className="preview-shell" radius="md" p={{ base: "md", sm: "lg" }} withBorder>
              <Group justify="space-between" mb="lg">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Workspace overview
                  </Text>
                  <Text fw={900} size="xl">
                    Operations board
                  </Text>
                </Stack>
                <Badge color="teal" variant="filled">
                  Live
                </Badge>
              </Group>

              <SimpleGrid cols={3} spacing="sm" mb="lg">
                {[
                  ["12", "Projects"],
                  ["48", "Tasks"],
                  ["9", "Due soon"],
                ].map(([value, label]) => (
                  <Paper key={label} className="metric-tile" radius="md" p="sm">
                    <Text fw={900} size="xl">
                      {value}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {label}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>

              <Paper className="preview-panel" radius="md" p="md" mb="md">
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <ThemeIcon size={30} radius="md" color="teal" variant="light">
                      <IconChartBar size={17} />
                    </ThemeIcon>
                    <Text fw={800}>Website launch</Text>
                  </Group>
                  <Text size="sm" fw={700} c="teal">
                    72%
                  </Text>
                </Group>
                <Progress value={72} radius="xl" color="teal" />
              </Paper>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap="sm">
                  {["Design review", "API handoff", "QA fixes"].map((task, index) => (
                    <Paper key={task} className="task-row" radius="md" p="sm">
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" fw={700}>
                          {task}
                        </Text>
                        <Badge size="sm" color={index === 2 ? "orange" : "teal"} variant="light">
                          {index === 2 ? "Today" : "Open"}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
                <Paper className="calendar-card" radius="md" p="md">
                  <Text size="sm" fw={800} mb="sm">
                    Deadline map
                  </Text>
                  <SimpleGrid cols={5} spacing={6}>
                    {Array.from({ length: 15 }, (_, index) => (
                      <Box
                        key={index}
                        className={
                          index === 6 || index === 12 ? "calendar-dot calendar-dot-hot" : "calendar-dot"
                        }
                      />
                    ))}
                  </SimpleGrid>
                </Paper>
              </SimpleGrid>
            </Paper>
          </Box>
        </SimpleGrid>

        <Group justify="center" gap="lg" className="legal-footer">
          <Anchor component={Link} to="/terms" size="sm" c="dimmed">
            Terms
          </Anchor>
          <Anchor component={Link} to="/privacy" size="sm" c="dimmed">
            Privacy
          </Anchor>
          <Anchor component={Link} to="/cookies" size="sm" c="dimmed">
            Cookies
          </Anchor>
        </Group>
      </Container>

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
    </main>
  );
}
