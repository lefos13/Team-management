import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBug,
  IconCheck,
  IconChecklist,
  IconLayersLinked,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";

type LaneId = "backlog" | "in_progress" | "review_qa";

const laneConfigs: { id: LaneId; title: string; badgeColor: string }[] = [
  { id: "backlog", title: "Backlog", badgeColor: "gray" },
  { id: "in_progress", title: "In Progress", badgeColor: "blue" },
  { id: "review_qa", title: "Review & QA", badgeColor: "teal" },
];

export function WorkflowShowcase() {
  const [activeLane, setActiveLane] = useState<LaneId>("in_progress");
  const [hasDefect, setHasDefect] = useState(false);

  function advanceLane() {
    if (activeLane === "backlog") setActiveLane("in_progress");
    else if (activeLane === "in_progress") setActiveLane("review_qa");
    else setActiveLane("backlog");
  }

  function moveLane(direction: "prev" | "next") {
    if (direction === "next") {
      advanceLane();
    } else {
      if (activeLane === "review_qa") setActiveLane("in_progress");
      else if (activeLane === "in_progress") setActiveLane("backlog");
      else setActiveLane("review_qa");
    }
  }

  return (
    <section className="landing-section" id="workflow">
      <Container size="xl">
        {/* Section Header */}
        <Stack gap="xs" align="center" ta="center" mb={{ base: 36, md: 54 }}>
          <Badge variant="light" color="teal" size="lg" radius="sm">
            Kanban Execution & Defect Governance
          </Badge>
          <Title order={2} className="section-heading">
            Fluid execution that never compromises quality.
          </Title>
          <Text size="lg" c="dimmed" maw={720}>
            Visualize every deliverable in high-definition Kanban lanes. Decompose work into executable
            subtasks, assign multiple technical owners, and instantly quarantine defects before release.
          </Text>
        </Stack>

        {/* Interactive Micro-Kanban Board */}
        <Card radius="lg" p={{ base: "md", md: "xl" }} withBorder className="kanban-showcase-shell">
          <Group justify="space-between" align="center" mb="lg" wrap="wrap" gap="sm">
            <Group gap="xs">
              <ThemeIcon size={32} radius="md" color="teal" variant="light">
                <IconLayersLinked size={18} />
              </ThemeIcon>
              <Box>
                <Text fw={800} size="sm">
                  Interactive Micro-Kanban Board
                </Text>
                <Text size="11px" c="dimmed">
                  Experience dynamic lane transitions and defect flagging
                </Text>
              </Box>
            </Group>

            {/* Interactive Controls */}
            <Group gap="xs">
              <Button
                variant={hasDefect ? "filled" : "light"}
                color="red"
                size="xs"
                radius="md"
                leftSection={hasDefect ? <IconCheck size={14} /> : <IconBug size={14} />}
                onClick={() => setHasDefect((d) => !d)}
              >
                {hasDefect ? "Resolve Defect" : "Flag Defect"}
              </Button>
              <Button
                variant="light"
                color="teal"
                size="xs"
                radius="md"
                rightSection={<IconArrowRight size={14} />}
                onClick={advanceLane}
              >
                Advance Lane
              </Button>
            </Group>
          </Group>

          {/* 3 Kanban Columns */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {laneConfigs.map((lane) => {
              const isInteractiveCardHere = activeLane === lane.id;

              return (
                <Paper key={lane.id} p="md" radius="md" withBorder className="kanban-column-paper">
                  {/* Column Header */}
                  <Group justify="space-between" align="center" mb="sm">
                    <Group gap="xs">
                      <Text fw={800} size="sm">
                        {lane.title}
                      </Text>
                      <Badge size="xs" variant="light" color={lane.badgeColor}>
                        {isInteractiveCardHere ? "2" : "1"}
                      </Badge>
                    </Group>
                    {isInteractiveCardHere ? (
                      <Badge size="xs" color="teal" variant="dot">
                        Active Card
                      </Badge>
                    ) : null}
                  </Group>

                  {/* Tasks Container */}
                  <Stack gap="sm">
                    {/* The Interactive Moving Card */}
                    {isInteractiveCardHere ? (
                      <Card
                        p="sm"
                        radius="md"
                        withBorder
                        className={`kanban-task-card ${
                          hasDefect ? "kanban-card-defect" : "kanban-card-active"
                        }`}
                      >
                        {/* Defect Alert Badge */}
                        {hasDefect ? (
                          <Paper p="xs" radius="sm" mb="xs" className="defect-banner">
                            <Group gap="xs" wrap="nowrap" align="flex-start">
                              <IconAlertTriangle size={16} color="#e03131" style={{ flexShrink: 0 }} />
                              <Box>
                                <Text size="xs" fw={800} c="red">
                                  Defect: Token Race Condition
                                </Text>
                                <Text size="11px" c="red.8">
                                  Concurrent renewals trigger lease eviction. Blocked until fixed.
                                </Text>
                              </Box>
                            </Group>
                          </Paper>
                        ) : null}

                        {/* Card Title & Priority */}
                        <Group justify="space-between" align="flex-start" mb={4} wrap="nowrap">
                          <Text fw={800} size="xs" className="kanban-card-title">
                            Zero-Downtime Distributed Lock Manager
                          </Text>
                          <Badge size="xs" color="orange" variant="light">
                            High
                          </Badge>
                        </Group>

                        <Text size="11px" c="dimmed" mb="xs" lineClamp={2}>
                          Redis Redlock protocol with self-renewing lease timeouts and graceful fallback.
                        </Text>

                        {/* Subtasks & Assignees */}
                        <Group justify="space-between" align="center" mt="xs">
                          <Group gap={6}>
                            <IconChecklist size={14} color="#0b7285" />
                            <Text size="11px" fw={700} c="dimmed">
                              3/4 subtasks
                            </Text>
                          </Group>

                          {/* Multi-assignees */}
                          <Group gap={-4}>
                            <Avatar size={20} radius="xl" color="teal">
                              ER
                            </Avatar>
                            <Avatar size={20} radius="xl" color="blue">
                              MV
                            </Avatar>
                          </Group>
                        </Group>

                        {/* Micro Lane Switchers */}
                        <Box mt="xs" pt="xs" style={{ borderTop: "1px solid rgba(19, 34, 56, 0.08)" }}>
                          <Group justify="space-between" align="center">
                            <Button
                              variant="subtle"
                              size="xs"
                              p={4}
                              leftSection={<IconArrowLeft size={12} />}
                              onClick={() => moveLane("prev")}
                              styles={{ root: { height: 22, fontSize: "10px" } }}
                            >
                              Prev
                            </Button>
                            <Text size="10px" c="dimmed">
                              Move card
                            </Text>
                            <Button
                              variant="subtle"
                              size="xs"
                              p={4}
                              rightSection={<IconArrowRight size={12} />}
                              onClick={() => moveLane("next")}
                              styles={{ root: { height: 22, fontSize: "10px" } }}
                            >
                              Next
                            </Button>
                          </Group>
                        </Box>
                      </Card>
                    ) : null}

                    {/* Static Background Cards to feel authentic */}
                    {lane.id === "backlog" ? (
                      <Card p="sm" radius="md" withBorder className="kanban-task-card">
                        <Group justify="space-between" align="flex-start" mb={4} wrap="nowrap">
                          <Text fw={700} size="xs">
                            Distributed Event Sourcing Schema
                          </Text>
                          <Badge size="xs" color="gray" variant="light">
                            Medium
                          </Badge>
                        </Group>
                        <Text size="11px" c="dimmed" mb="xs">
                          Define Avro contract schema registry for transactional outbox pattern.
                        </Text>
                        <Group justify="space-between" align="center">
                          <Group gap={6}>
                            <IconChecklist size={14} color="#868e96" />
                            <Text size="11px" c="dimmed">
                              0/3 subtasks
                            </Text>
                          </Group>
                          <Avatar size={20} radius="xl" color="cyan">
                            SC
                          </Avatar>
                        </Group>
                      </Card>
                    ) : null}

                    {lane.id === "in_progress" && !isInteractiveCardHere ? (
                      <Card p="sm" radius="md" withBorder className="kanban-task-card">
                        <Group justify="space-between" align="flex-start" mb={4} wrap="nowrap">
                          <Text fw={700} size="xs">
                            Rate Limiter Token Bucket Filter
                          </Text>
                          <Badge size="xs" color="blue" variant="light">
                            High
                          </Badge>
                        </Group>
                        <Text size="11px" c="dimmed" mb="xs">
                          Redis sliding window counter with millisecond burst allowances.
                        </Text>
                        <Group justify="space-between" align="center">
                          <Group gap={6}>
                            <IconChecklist size={14} color="#0b7285" />
                            <Text size="11px" c="dimmed">
                              2/3 subtasks
                            </Text>
                          </Group>
                          <Avatar size={20} radius="xl" color="blue">
                            MV
                          </Avatar>
                        </Group>
                      </Card>
                    ) : null}

                    {lane.id === "review_qa" && !isInteractiveCardHere ? (
                      <Card p="sm" radius="md" withBorder className="kanban-task-card">
                        <Group justify="space-between" align="flex-start" mb={4} wrap="nowrap">
                          <Text fw={700} size="xs">
                            Audit Trail Log Compaction Worker
                          </Text>
                          <Badge size="xs" color="teal" variant="light">
                            Low
                          </Badge>
                        </Group>
                        <Text size="11px" c="dimmed" mb="xs">
                          Nightly batch job archiving tamper-evident immutable access traces.
                        </Text>
                        <Group justify="space-between" align="center">
                          <Group gap={6}>
                            <IconChecklist size={14} color="#12b886" />
                            <Text size="11px" c="dimmed">
                              4/4 subtasks
                            </Text>
                          </Group>
                          <Avatar size={20} radius="xl" color="teal">
                            ER
                          </Avatar>
                        </Group>
                      </Card>
                    ) : null}
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Card>

        {/* 3 Value Pillars */}
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="xl">
          <Paper p="lg" radius="md" withBorder className="workflow-value-card">
            <ThemeIcon size={38} radius="md" color="teal" variant="light" mb="sm">
              <IconUsers size={20} />
            </ThemeIcon>
            <Text fw={800} size="md" mb={4}>
              Multi-Assignee Ownership
            </Text>
            <Text size="sm" c="dimmed">
              Complex architecture rarely belongs to a single engineer. Attach lead architects, code
              reviewers, and QA specialists to the same observable card.
            </Text>
          </Paper>

          <Paper p="lg" radius="md" withBorder className="workflow-value-card">
            <ThemeIcon size={38} radius="md" color="red" variant="light" mb="sm">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
            <Text fw={800} size="md" mb={4}>
              Defect Governance
            </Text>
            <Text size="sm" c="dimmed">
              Flag anomalies with one click. Defect badges alert the entire engineering pod and prevent
              premature promotion to production environments.
            </Text>
          </Paper>

          <Paper p="lg" radius="md" withBorder className="workflow-value-card">
            <ThemeIcon size={38} radius="md" color="blue" variant="light" mb="sm">
              <IconChecklist size={20} />
            </ThemeIcon>
            <Text fw={800} size="md" mb={4}>
              Subtask Granularity
            </Text>
            <Text size="sm" c="dimmed">
              Deconstruct broad tasks into verifiable check items. Track fractional velocity as subtasks
              are closed, keeping project progress transparent.
            </Text>
          </Paper>
        </SimpleGrid>
      </Container>
    </section>
  );
}
