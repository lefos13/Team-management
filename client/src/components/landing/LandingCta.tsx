import {
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconCheck, IconLogin2, IconSparkles, IconUserPlus } from "@tabler/icons-react";

export type LandingCtaProps = {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
};

export function LandingCta({ onOpenLogin, onOpenRegister }: LandingCtaProps) {
  return (
    <section className="landing-cta-section">
      <Container size="xl">
        <Paper radius="xl" p={{ base: "xl", md: 54 }} className="landing-cta-banner">
          <div className="cta-banner-glow" aria-hidden="true" />
          <Stack gap="xl" align="center" ta="center" className="cta-content-stack">
            <Badge variant="light" color="teal" size="lg" radius="sm" leftSection={<IconSparkles size={14} />}>
              Ready for high-precision operations?
            </Badge>

            <Stack gap="xs" maw={680}>
              <Title order={2} className="cta-heading">
                Bring order to team execution in minutes.
              </Title>
              <Text size="lg" c="gray.4" className="cta-subheading">
                Set up your workspace today. No convoluted configurations, no enterprise clutter — just
                focused, verifiable delivery from day one.
              </Text>
            </Stack>

            {/* Dual CTAs */}
            <Group gap="md" wrap="wrap" justify="center">
              <Button
                size="lg"
                radius="md"
                color="teal"
                leftSection={<IconUserPlus size={20} />}
                onClick={onOpenRegister}
                className="cta-primary-button"
              >
                Create your workspace
              </Button>
              <Button
                size="lg"
                radius="md"
                variant="white"
                color="dark"
                leftSection={<IconLogin2 size={20} />}
                onClick={onOpenLogin}
                className="cta-secondary-button"
              >
                Sign in
              </Button>
            </Group>

            {/* Trust Chips */}
            <Group gap="lg" wrap="wrap" justify="center" mt="sm">
              {[
                "Instant team onboarding",
                "Granular permissions",
                "Client token previews",
              ].map((chip) => (
                <Group key={chip} gap={6} align="center">
                  <IconCheck size={16} color="#20c997" />
                  <Text size="xs" fw={700} c="gray.3">
                    {chip}
                  </Text>
                </Group>
              ))}
            </Group>
          </Stack>
        </Paper>
      </Container>
    </section>
  );
}
