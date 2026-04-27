/* Use one responsive shell so each account can move through its own workspace without leaking auth complexity into pages. */
import { AppShell, Avatar, Burger, Button, Group, NavLink, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendarEvent,
  IconChecklist,
  IconFolder,
  IconLayoutDashboard,
  IconLogout,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { getCurrentUser, useLogout } from "../hooks/use-auth";

const navigation = [
  { label: "Dashboard", path: "/", icon: IconLayoutDashboard },
  { label: "Projects", path: "/projects", icon: IconFolder },
  { label: "Members", path: "/members", icon: IconUsers },
  { label: "Tasks", path: "/tasks", icon: IconChecklist },
  { label: "Calendar", path: "/calendar", icon: IconCalendarEvent },
];

export function AppShellLayout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const logoutMutation = useLogout();
  const currentNavigation = navigation.find((item) => item.path === location.pathname) ?? navigation[0];

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 270, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="xl"
      className="app-shell"
    >
      <AppShell.Header className="shell-header">
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" />
            <Stack gap={0}>
              <Text className="eyebrow">Team workspace</Text>
              <Title order={3}>{currentNavigation.label}</Title>
            </Stack>
          </Group>
          <Group gap="sm">
            <Avatar radius="xl" color="teal">
              {sessionQuery.data?.email.slice(0, 1).toUpperCase() ?? "L"}
            </Avatar>
            <Stack gap={0} visibleFrom="sm">
              <Text fw={700}>{sessionQuery.data?.email ?? "Leader"}</Text>
              <Text size="sm" c="dimmed">
                Account workspace
              </Text>
            </Stack>
            <Button
              variant="light"
              color="dark"
              leftSection={<IconLogout size={16} />}
              loading={logoutMutation.isPending}
              onClick={async () => {
                await logoutMutation.mutateAsync();
                navigate("/login");
              }}
            >
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar className="shell-navbar" p="md">
        <Stack gap="lg" h="100%" justify="space-between">
          <Stack gap="lg">
            <Stack gap={2} px="sm">
              <Text fw={900} size="lg" c="white">
                Team Management
              </Text>
              <Text size="xs" c="blue.1">
                Operations workspace
              </Text>
            </Stack>
            <Stack gap="xs">
              {navigation.map((item) => (
                <NavLink
                  key={item.path}
                  active={location.pathname === item.path}
                  label={item.label}
                  leftSection={<item.icon size={18} />}
                  onClick={() => navigate(item.path)}
                  variant="filled"
                  className="shell-navlink"
                />
              ))}
            </Stack>
          </Stack>
          <Stack className="shell-upgrade" gap="xs">
            <Text fw={800} c="teal.3">
              Project focus
            </Text>
            <Text size="sm" c="blue.1">
              Review progress, deadlines, and team ownership before work becomes urgent.
            </Text>
          </Stack>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
