import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconBrandGithub, IconCoffee, IconHeart } from "@tabler/icons-react";
import { supportLinks } from "../../data/support-links";

export function SupportSection() {
  return (
    <section className="landing-section landing-support-section" id="support">
      <Container size="xl">
        {/* Section Header */}
        <Stack gap="xs" align="center" ta="center" mb={{ base: 36, md: 48 }}>
          <Badge variant="light" color="teal" size="lg" radius="sm" leftSection={<IconHeart size={14} />}>
            Community supported
          </Badge>
          <Title order={2} className="section-heading">
            Support MGteam development
          </Title>
          <Text size="lg" c="dimmed" maw={720}>
            MGteam is free to use for your team. Your support keeps development active, covers hosting and
            infrastructure, and funds the next round of planning, Kanban, and reporting features.
          </Text>
        </Stack>

        {/* Support Cards */}
        <div className="support-cards-wrapper">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: "lg", md: "xl" }}>
            {supportLinks.map((link) => {
              const isGithub = link.id === "github-sponsors";
              return (
                <Card
                  key={link.id}
                  radius="xl"
                  p={{ base: "xl", md: 32 }}
                  withBorder
                  className="support-card"
                >
                  <Stack justify="space-between" h="100%" gap="xl">
                    <Stack gap="md">
                      <Group justify="space-between" align="center">
                        <ThemeIcon
                          size={48}
                          radius="md"
                          className={isGithub ? "support-icon-github" : "support-icon-coffee"}
                        >
                          {isGithub ? <IconBrandGithub size={26} /> : <IconCoffee size={26} />}
                        </ThemeIcon>
                        <Badge variant="light" color={isGithub ? "gray" : "orange"} size="md" radius="sm">
                          {link.tagline}
                        </Badge>
                      </Group>

                      <Stack gap="xs">
                        <Title order={3} size="h3" className="support-card-title">
                          {link.label}
                        </Title>
                        <Text size="sm" c="dimmed" className="support-card-description">
                          {link.description}
                        </Text>
                      </Stack>
                    </Stack>

                    <Button
                      component="a"
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="md"
                      radius="md"
                      leftSection={isGithub ? <IconBrandGithub size={18} /> : <IconCoffee size={18} />}
                      className={isGithub ? "support-cta-github" : "support-cta-coffee"}
                    >
                      {link.cta}
                    </Button>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </div>

        {/* Pledge Line */}
        <Group justify="center" mt={{ base: "xl", md: 36 }} className="support-pledge-container">
          <div className="support-pledge">
            <IconHeart size={16} className="support-pledge-icon" />
            <Text size="sm" c="dimmed" ta="center">
              Core team features will always stay free — no ads, no paywalled essentials.
            </Text>
          </div>
        </Group>
      </Container>
    </section>
  );
}
