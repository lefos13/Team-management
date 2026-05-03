/*
Keep cookie notice handling client-side because v1 only uses essential session
and preference storage, with no optional tracking scripts to coordinate.
*/
import { useEffect, useState } from "react";
import { Anchor, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";

export const cookiePreferenceStorageKey = "team-management-essential-cookies-accepted";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(cookiePreferenceStorageKey) !== "true");
  }, []);

  function acceptEssentialCookies() {
    window.localStorage.setItem(cookiePreferenceStorageKey, "true");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <Paper className="cookie-banner" radius="md" p="md" shadow="lg" withBorder role="region" aria-label="Cookie notice">
      <Stack gap="sm">
        <Text fw={800}>Essential cookies</Text>
        <Text size="sm" c="dimmed">
          Team Management uses only necessary cookies and local storage for sign-in sessions, security, and remembering
          this notice. We do not load analytics, marketing, or third-party tracking cookies.
        </Text>
        <Group justify="space-between" gap="sm" align="center">
          <Group gap="sm">
            <Anchor component={Link} to="/cookies" size="sm">
              Cookie Policy
            </Anchor>
            <Anchor component={Link} to="/privacy" size="sm">
              Privacy Policy
            </Anchor>
          </Group>
          <Button radius="md" size="sm" onClick={acceptEssentialCookies}>
            Accept essential cookies
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
