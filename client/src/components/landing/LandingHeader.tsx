import {
  Anchor,
  Box,
  Burger,
  Button,
  Container,
  Drawer,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { IconLogin2, IconUserPlus } from "@tabler/icons-react";
import { ThemeToggle } from "../ThemeToggle";
import { useState } from "react";

export type LandingHeaderProps = {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
};

export function LandingHeader({ onOpenLogin, onOpenRegister }: LandingHeaderProps) {
  const [drawerOpened, setDrawerOpened] = useState(false);

  function handleNavClick(hash: string) {
    setDrawerOpened(false);
    const element = document.querySelector(hash);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <header className="landing-sticky-header">
      <Container size="xl" className="landing-header-container">
        <Group justify="space-between" align="center" wrap="nowrap">
          {/* Brand */}
          <a
            href="#top"
            className="site-brand-link"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Group gap="sm" wrap="nowrap">
              <img className="site-brand-logo" src="/logo.png" alt="MGteam logo" />
              <Box>
                <Text fw={900} size="md" className="landing-brand-text">
                  MGteam
                </Text>
                <Text size="10px" c="dimmed" fw={700} style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Tactical Studio
                </Text>
              </Box>
            </Group>
          </a>

          {/* Desktop Navigation Links */}
          <Group gap="xl" visibleFrom="md" className="landing-nav-links">
            <Anchor
              href="#workflow"
              className="landing-nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("#workflow");
              }}
            >
              Workflow
            </Anchor>
            <Anchor
              href="#visibility"
              className="landing-nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("#visibility");
              }}
            >
              Visibility
            </Anchor>
            <Anchor
              href="#collaboration"
              className="landing-nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("#collaboration");
              }}
            >
              Collaboration
            </Anchor>
          </Group>

          {/* Desktop Action CTAs */}
          <Group gap="sm" visibleFrom="sm">
            <ThemeToggle />
            <Button
              variant="subtle"
              color="dark"
              radius="md"
              size="sm"
              leftSection={<IconLogin2 size={16} />}
              onClick={onOpenLogin}
            >
              Sign in
            </Button>
            <Button
              color="teal"
              radius="md"
              size="sm"
              leftSection={<IconUserPlus size={16} />}
              onClick={onOpenRegister}
            >
              Create account
            </Button>
          </Group>

          {/* Mobile Burger Menu Button */}
          <Group hiddenFrom="md" gap="xs">
            <Button
              variant="subtle"
              color="dark"
              radius="md"
              size="xs"
              onClick={onOpenLogin}
              hiddenFrom="sm"
            >
              Sign in
            </Button>
            <Burger
              opened={drawerOpened}
              onClick={() => setDrawerOpened((o) => !o)}
              size="sm"
              aria-label="Toggle navigation"
            />
          </Group>
        </Group>
      </Container>

      {/* Mobile Drawer */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title={
          <Group gap="xs">
            <img className="site-brand-logo-small" src="/logo.png" alt="MGteam logo" />
            <Text fw={800} size="sm">
              MGteam
            </Text>
          </Group>
        }
        padding="md"
        size="xs"
        position="right"
      >
        <Stack gap="md" mt="sm">
          <Button
            variant="light"
            color="gray"
            justify="flex-start"
            radius="md"
            onClick={() => handleNavClick("#workflow")}
          >
            Kanban Workflow
          </Button>
          <Button
            variant="light"
            color="gray"
            justify="flex-start"
            radius="md"
            onClick={() => handleNavClick("#visibility")}
          >
            Team Visibility
          </Button>
          <Button
            variant="light"
            color="gray"
            justify="flex-start"
            radius="md"
            onClick={() => handleNavClick("#collaboration")}
          >
            Calendar & Client Sharing
          </Button>

          <Box mt="md" className="landing-drawer-divider" style={{ borderTop: "1px solid rgba(19, 34, 56, 0.08)", paddingTop: "16px" }}>
            <Stack gap="sm">
              <Group justify="space-between" align="center" px="xs" pb="xs">
                <Text size="sm" fw={600}>Theme</Text>
                <ThemeToggle />
              </Group>
              <Button
                variant="default"
                radius="md"
                fullWidth
                leftSection={<IconLogin2 size={16} />}
                onClick={() => {
                  setDrawerOpened(false);
                  onOpenLogin();
                }}
              >
                Sign in
              </Button>
              <Button
                color="teal"
                radius="md"
                fullWidth
                leftSection={<IconUserPlus size={16} />}
                onClick={() => {
                  setDrawerOpened(false);
                  onOpenRegister();
                }}
              >
                Create account
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Drawer>
    </header>
  );
}
