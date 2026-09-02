import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconChecklist,
  IconClock,
  IconFlame,
  IconLayersLinked,
  IconLock,
  IconLogin2,
  IconShieldCheck,
  IconSparkles,
  IconUserPlus,
} from "@tabler/icons-react";
import { useState } from "react";

export type LandingHeroProps = {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
};

type SubtaskItem = {
  id: string;
  label: string;
  completed: boolean;
  tag: string;
};

export function LandingHero({ onOpenLogin, onOpenRegister }: LandingHeroProps) {
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([
    {
      id: "pci",
      label: "PCI-DSS compliance verification",
      completed: true,
      tag: "Security",
    },
    {
      id: "webhook",
      label: "Webhook idempotency keys & retry queue",
      completed: true,
      tag: "Architecture",
    },
    {
      id: "tokens",
      label: "Apple Pay & Google Pay direct checkout tokens",
      completed: false,
      tag: "Payments",
    },
  ]);

  const totalSubtasks = subtasks.length;
  const completedCount = subtasks.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / totalSubtasks) * 100);
  const isComplete = progressPercent === 100;

  function toggleSubtask(id: string) {
    setSubtasks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    );
  }

  return (
    <section className="landing-hero-section" id="top">
      <Container size="xl">
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={{ base: 40, lg: 64 }}>
          {/* Left Column: Core Value Proposition */}
          <Stack gap="xl" className="hero-left-column" justify="center">
            <Stack gap="md">
              <Group gap="xs" wrap="wrap">
                <Badge
                  variant="outline"
                  color="teal"
                  size="lg"
                  radius="sm"
                  leftSection={<IconSparkles size={14} />}
                  className="hero-badge"
                >
                  Tactical Engineering Control Room
                </Badge>
                <Badge variant="dot" color="teal" size="lg" radius="sm">
                  v2.4 Live
                </Badge>
              </Group>

              <Title order={1} className="landing-hero-title">
                Bring order to complex team execution.
              </Title>

              <Text size="xl" c="dimmed" className="landing-hero-subtitle">
                Coordinate cross-functional projects, balance individual capacity, enforce defect
                governance, and share tamper-proof progress with clients — without the spreadsheet drag.
              </Text>
            </Stack>

            {/* CTA Group */}
            <Stack gap="sm">
              <Group gap="md" wrap="wrap">
                <Button
                  size="lg"
                  radius="md"
                  color="teal"
                  leftSection={<IconUserPlus size={20} />}
                  onClick={onOpenRegister}
                  className="hero-primary-cta"
                >
                  Create your workspace
                </Button>
                <Button
                  size="lg"
                  radius="md"
                  variant="default"
                  leftSection={<IconLogin2 size={20} />}
                  onClick={onOpenLogin}
                  className="hero-secondary-cta"
                >
                  Sign in
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                No credit card required • Instant setup in under 60 seconds
              </Text>
            </Stack>

            {/* Value Proposition Highlights */}
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" className="hero-trust-grid">
              <Paper p="sm" radius="md" withBorder className="hero-trust-card">
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <ThemeIcon size={26} radius="sm" color="teal" variant="light">
                    <IconLayersLinked size={15} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" fw={800}>
                      Kanban Flow
                    </Text>
                    <Text size="11px" c="dimmed">
                      Multi-assignees & defect alerts
                    </Text>
                  </Box>
                </Group>
              </Paper>

              <Paper p="sm" radius="md" withBorder className="hero-trust-card">
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <ThemeIcon size={26} radius="sm" color="cyan" variant="light">
                    <IconShieldCheck size={15} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" fw={800}>
                      Capacity View
                    </Text>
                    <Text size="11px" c="dimmed">
                      Bandwidth inspector & SLAs
                    </Text>
                  </Box>
                </Group>
              </Paper>

              <Paper p="sm" radius="md" withBorder className="hero-trust-card">
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <ThemeIcon size={26} radius="sm" color="blue" variant="light">
                    <IconLock size={15} />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" fw={800}>
                      Client Tokens
                    </Text>
                    <Text size="11px" c="dimmed">
                      Read-only external previews
                    </Text>
                  </Box>
                </Group>
              </Paper>
            </SimpleGrid>
          </Stack>

          {/* Right Column: Signature Workspace Pulse Preview */}
          <Box className="workspace-pulse-wrapper">
            <div className="workspace-pulse-glow" aria-hidden="true" />
            <Card radius="lg" p="lg" withBorder className="workspace-pulse-card">
              {/* Header Bar */}
              <Group justify="space-between" align="center" mb="md">
                <Group gap="xs">
                  <div className="pulse-indicator-dot" />
                  <Text size="xs" fw={800} c="dimmed" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    WORKSPACE PULSE • LIVE CONSOLE
                  </Text>
                </Group>
                <Badge
                  color={isComplete ? "teal" : "cyan"}
                  variant={isComplete ? "filled" : "light"}
                  size="sm"
                  radius="sm"
                  className="pulse-status-badge"
                >
                  {isComplete ? "Milestone Complete" : "In Flight"}
                </Badge>
              </Group>

              {/* Project Card Header */}
              <Stack gap="xs" mb="lg">
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Text size="xs" fw={700} c="teal">
                      ACTIVE SPRINT 14 • RELEASE CANDIDATE
                    </Text>
                    <Title order={3} className="pulse-project-title">
                      Payment Gateway & Mobile API v2
                    </Title>
                  </Box>
                  <Badge color="orange" variant="outline" size="sm">
                    Priority: High
                  </Badge>
                </Group>

                {/* Progress Bar with Dynamic Value */}
                <Box mt="xs">
                  <Group justify="space-between" mb={6}>
                    <Text size="xs" fw={700} c="dimmed">
                      Deliverable Milestone Progress
                    </Text>
                    <Text size="sm" fw={900} c={isComplete ? "teal" : "cyan"}>
                      {progressPercent}%
                    </Text>
                  </Group>
                  <Progress
                    value={progressPercent}
                    color={isComplete ? "teal" : "cyan"}
                    size="md"
                    radius="xl"
                    animated={progressPercent > 0 && progressPercent < 100}
                    className="pulse-progress-bar"
                  />
                  <Group justify="space-between" mt={6}>
                    <Text size="xs" c="dimmed">
                      {completedCount} of {totalSubtasks} subtasks verified
                    </Text>
                    <Text size="xs" c="dimmed">
                      Target: Oct 15, 2026
                    </Text>
                  </Group>
                </Box>
              </Stack>

              {/* Interactive Subtasks Simulation */}
              <Paper p="sm" radius="md" withBorder className="pulse-subtasks-container" mb="md">
                <Group justify="space-between" align="center" mb="xs">
                  <Group gap={6}>
                    <IconChecklist size={16} color="#0b7285" />
                    <Text size="xs" fw={800} style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Executable Subtask Checklist
                    </Text>
                  </Group>
                  <Badge size="xs" color="gray" variant="subtle">
                    Interactive simulation
                  </Badge>
                </Group>

                <Stack gap="xs">
                  {subtasks.map((task) => (
                    <Box
                      key={task.id}
                      className={`pulse-subtask-row ${task.completed ? "subtask-completed" : "subtask-pending"}`}
                      onClick={() => toggleSubtask(task.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSubtask(task.id);
                        }
                      }}
                      aria-label={`Toggle ${task.label}`}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                          <Checkbox
                            checked={task.completed}
                            onChange={() => toggleSubtask(task.id)}
                            color="teal"
                            size="xs"
                            styles={{ input: { cursor: "pointer" } }}
                            aria-label={task.label}
                          />
                          <Text
                            size="xs"
                            fw={task.completed ? 600 : 700}
                            className={task.completed ? "subtask-label-checked" : "subtask-label"}
                          >
                            {task.label}
                          </Text>
                        </Group>
                        <Badge size="xs" variant="light" color={task.completed ? "teal" : "gray"}>
                          {task.tag}
                        </Badge>
                      </Group>
                    </Box>
                  ))}
                </Stack>
                <Text size="11px" c="dimmed" ta="center" mt="xs">
                  💡 Click any subtask to dynamically recalculate sprint progress
                </Text>
              </Paper>

              {/* Quick Metrics Footer inside card */}
              <SimpleGrid cols={3} spacing="xs">
                <Paper p="xs" radius="sm" className="pulse-mini-stat">
                  <Group gap={4} mb={2}>
                    <IconFlame size={13} color="#f08c00" />
                    <Text size="10px" c="dimmed" fw={700}>
                      VELOCITY
                    </Text>
                  </Group>
                  <Text size="sm" fw={800}>
                    94.2 pts
                  </Text>
                </Paper>

                <Paper p="xs" radius="sm" className="pulse-mini-stat">
                  <Group gap={4} mb={2}>
                    <IconClock size={13} color="#0b7285" />
                    <Text size="10px" c="dimmed" fw={700}>
                      ASSIGNEES
                    </Text>
                  </Group>
                  <Group gap={4}>
                    <Avatar size={18} radius="xl" color="teal">
                      ER
                    </Avatar>
                    <Avatar size={18} radius="xl" color="blue">
                      MV
                    </Avatar>
                    <Text size="xs" fw={700}>
                      +2
                    </Text>
                  </Group>
                </Paper>

                <Paper p="xs" radius="sm" className="pulse-mini-stat">
                  <Group gap={4} mb={2}>
                    <IconShieldCheck size={13} color="#12b886" />
                    <Text size="10px" c="dimmed" fw={700}>
                      DEFECTS
                    </Text>
                  </Group>
                  <Text size="sm" fw={800} c="teal">
                    0 Blockers
                  </Text>
                </Paper>
              </SimpleGrid>
            </Card>
          </Box>
        </SimpleGrid>
      </Container>
    </section>
  );
}
