/*
Public & authenticated What's New changelog view showing latest enhancements,
optimizations, and fixes across the platform.
*/
import {
  Badge,
  Box,
  Card,
  Container,
  Group,
  List,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconCalendar, IconCheck, IconSparkles } from "@tabler/icons-react";

import { whatsNewEntries, type WhatsNewCategory, type WhatsNewEntry } from "../data/whats-new";
import { formatDate } from "../lib/dates";

const CATEGORY_COLORS: Record<WhatsNewCategory, string> = {
  feature: "teal",
  improvement: "blue",
  fix: "orange",
};

const CATEGORY_LABELS: Record<WhatsNewCategory, string> = {
  feature: "Feature",
  improvement: "Improvement",
  fix: "Fix",
};

export interface WhatsNewPageProps {
  entries?: WhatsNewEntry[];
}

export function WhatsNewPage({ entries = whatsNewEntries }: WhatsNewPageProps) {
  return (
    <Container size="md" py={{ base: "md", sm: "xl" }} px={{ base: "sm", sm: "md" }}>
      <Stack gap="xl">
        {/* Header banner */}
        <Stack gap={6}>
          <Group gap="xs">
            <ThemeIcon size="md" radius="md" color="teal" variant="light">
              <IconSparkles size={18} />
            </ThemeIcon>
            <Text size="xs" fw={800} c="teal" tt="uppercase" style={{ letterSpacing: "0.08em" }}>
              Changelog
            </Text>
          </Group>
          <Title order={1} size="h2" fw={800}>
            What&apos;s New
          </Title>
          <Text c="dimmed" size="sm">
            Explore the latest features, workflow improvements, and fixes across MGteam.
          </Text>
        </Stack>

        {/* Entries list or empty state */}
        {entries.length === 0 ? (
          <Paper
            withBorder
            radius="md"
            p={{ base: "xl", sm: 48 }}
            ta="center"
            className="whats-new-empty-state"
          >
            <Stack align="center" gap="sm">
              <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                <IconSparkles size={24} />
              </ThemeIcon>
              <Title order={3} size="h4">
                No updates yet
              </Title>
              <Text c="dimmed" size="sm" maw={400}>
                We have not posted any release notes yet. Check back soon for new features,
                improvements, and fixes!
              </Text>
            </Stack>
          </Paper>
        ) : (
          <Stack gap="lg">
            {entries.map((entry) => (
              <Card
                key={entry.id}
                withBorder
                radius="md"
                p={{ base: "md", sm: "xl" }}
                shadow="xs"
                className="whats-new-card"
              >
                <Stack gap="sm">
                  {/* Category, Version, and Date header */}
                  <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                    <Group gap="xs" wrap="wrap">
                      <Badge
                        color={CATEGORY_COLORS[entry.category]}
                        variant="light"
                        radius="xl"
                        size="sm"
                      >
                        {CATEGORY_LABELS[entry.category]}
                      </Badge>
                      {entry.version && (
                        <Badge variant="outline" color="gray" radius="xl" size="sm">
                          {entry.version}
                        </Badge>
                      )}
                    </Group>
                    <Group gap={6} align="center">
                      <IconCalendar size={14} style={{ opacity: 0.6 }} />
                      <Text size="xs" c="dimmed" fw={600}>
                        {formatDate(entry.date)}
                      </Text>
                    </Group>
                  </Group>

                  {/* Title & Summary */}
                  <Title order={2} size="h4" fw={700}>
                    {entry.title}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {entry.summary}
                  </Text>

                  {/* Highlights */}
                  {entry.highlights.length > 0 && (
                    <Box mt="xs">
                      <List
                        spacing="xs"
                        size="sm"
                        icon={
                          <ThemeIcon
                            size={18}
                            radius="xl"
                            color={CATEGORY_COLORS[entry.category]}
                            variant="light"
                          >
                            <IconCheck size={12} stroke={2.5} />
                          </ThemeIcon>
                        }
                      >
                        {entry.highlights.map((highlight, index) => (
                          <List.Item key={index}>{highlight}</List.Item>
                        ))}
                      </List>
                    </Box>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
