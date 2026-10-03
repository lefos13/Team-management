import {
  Anchor,
  Box,
  Container,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="landing-footer-container">
      <Container size="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            {/* Brand and Tagline */}
            <Group gap="sm" className="site-brand-link">
              <img className="site-brand-logo-small" src="/logo.png" alt="MGteam logo" />
              <Box>
                <Text fw={800} size="sm">
                  MGteam
                </Text>
                <Text size="11px" c="dimmed">
                  High-precision engineering workspace
                </Text>
              </Box>
            </Group>

            {/* System Status Pill */}
            <Group gap="xs" className="system-status-pill">
              <span className="status-pulse-dot" />
              <Text size="xs" fw={700} c="dimmed">
                All Systems Operational • 99.99% SLA
              </Text>
            </Group>

            {/* Legal Links and What's New */}
            <Group gap="lg" className="footer-legal-links">
              <Anchor href="#support" size="sm" c="dimmed">
                Support
              </Anchor>
              <Anchor component={Link} to="/whats-new" size="sm" c="dimmed">
                What&apos;s New
              </Anchor>
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
          </Group>

          <Box className="footer-copyright-divider">
            <Text size="xs" c="dimmed" ta="center">
              © {new Date().getFullYear()} MGteam. Tactical Studio. All rights reserved.
            </Text>
          </Box>
        </Stack>
      </Container>
    </footer>
  );
}
