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

  return (
    <AppShell
      header={{ height: 84 }}
      navbar={{ width: 290, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
      className="app-shell"
    >
      <AppShell.Header className="shell-header">
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" />
            <Stack gap={0}>
              <Text className="eyebrow">Cloud Team Workspace</Text>
              <Title order={3}>Team Management</Title>
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
        <Stack gap="xs">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              active={location.pathname === item.path}
              label={item.label}
              leftSection={<item.icon size={18} />}
              onClick={() => navigate(item.path)}
              variant="light"
              className="shell-navlink"
            />
          ))}
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
