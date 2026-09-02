import {
  Avatar,
  Badge,
  Box,
  Card,
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
  IconArrowUpRight,
  IconChecklist,
  IconFolderCheck,
  IconShieldCheck,
  IconTarget,
  IconTrendingUp,
  IconUserCheck,
} from "@tabler/icons-react";
import { useState } from "react";

type MemberDeliverable = {
  id: string;
  title: string;
  status: "In Progress" | "Review" | "Completed" | "Backlog";
  statusColor: string;
  project: string;
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  initials: string;
  avatarColor: string;
  capacity: number;
  capacityLevel: "Optimal" | "High Bandwidth" | "Available";
  capacityColor: string;
  currentFocus: string;
  activeProjects: string[];
  deliverables: MemberDeliverable[];
};

const teamMembers: TeamMember[] = [
  {
    id: "elena",
    name: "Elena Rostova",
    role: "Lead Architect",
    initials: "ER",
    avatarColor: "teal",
    capacity: 85,
    capacityLevel: "High Bandwidth",
    capacityColor: "orange",
    currentFocus: "Distributed lock manager, Redis Redlock leasing & idempotency keys",
    activeProjects: ["Payment Gateway v2", "Core Infrastructure"],
    deliverables: [
      {
        id: "d1",
        title: "Zero-downtime database failover protocol",
        status: "Review",
        statusColor: "blue",
        project: "Core Infrastructure",
      },
      {
        id: "d2",
        title: "Kafka consumer rebalancing optimization",
        status: "In Progress",
        statusColor: "teal",
        project: "Payment Gateway v2",
      },
      {
        id: "d3",
        title: "Security architecture review: Auth token rotation",
        status: "Completed",
        statusColor: "gray",
        project: "Core Infrastructure",
      },
    ],
  },
  {
    id: "marcus",
    name: "Marcus Vance",
    role: "Backend Systems",
    initials: "MV",
    avatarColor: "blue",
    capacity: 68,
    capacityLevel: "Optimal",
    capacityColor: "teal",
    currentFocus: "Database query optimization, replica failover & connection pooling",
    activeProjects: ["Payment Gateway v2", "Data Pipeline"],
    deliverables: [
      {
        id: "d4",
        title: "Read-replica connection pooling with PgBouncer",
        status: "In Progress",
        statusColor: "teal",
        project: "Payment Gateway v2",
      },
      {
        id: "d5",
        title: "GraphQL query depth and rate limiter middleware",
        status: "In Progress",
        statusColor: "teal",
        project: "Payment Gateway v2",
      },
      {
        id: "d6",
        title: "Audit log compaction background worker",
        status: "Backlog",
        statusColor: "gray",
        project: "Data Pipeline",
      },
    ],
  },
  {
    id: "sofia",
    name: "Sofia Chen",
    role: "QA Engineer",
    initials: "SC",
    avatarColor: "violet",
    capacity: 52,
    capacityLevel: "Available",
    capacityColor: "cyan",
    currentFocus: "Automated end-to-end regression test suite & chaos testing",
    activeProjects: ["Payment Gateway v2", "Test Automation"],
    deliverables: [
      {
        id: "d7",
        title: "Playwright E2E checkout journey tests",
        status: "In Progress",
        statusColor: "teal",
        project: "Test Automation",
      },
      {
        id: "d8",
        title: "Load testing: 50k concurrent webhook events",
        status: "In Progress",
        statusColor: "teal",
        project: "Payment Gateway v2",
      },
      {
        id: "d9",
        title: "Chaos engineering: simulated network partitions",
        status: "Backlog",
        statusColor: "gray",
        project: "Test Automation",
      },
    ],
  },
];

export function VisibilityShowcase() {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("elena");

  const selectedMember = teamMembers.find((m) => m.id === selectedMemberId) ?? teamMembers[0]!;

  return (
    <section className="landing-section landing-section-alt" id="visibility">
      <Container size="xl">
        {/* Section Header */}
        <Stack gap="xs" align="center" ta="center" mb={{ base: 36, md: 54 }}>
          <Badge variant="light" color="cyan" size="lg" radius="sm">
            Operational Visibility & Workload
          </Badge>
          <Title order={2} className="section-heading">
            Total team visibility without micromanagement.
          </Title>
          <Text size="lg" c="dimmed" maw={720}>
            Inspect engineering bandwidth in real time. Rebalance deliverables before overload becomes
            burnout, and track project health metrics with surgical accuracy.
          </Text>
        </Stack>

        {/* Top Metric Tiles */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
          <Paper p="lg" radius="md" withBorder className="visibility-metric-tile">
            <Group justify="space-between" align="flex-start" mb="xs">
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                On-Time Milestones
              </Text>
              <ThemeIcon size={30} radius="md" color="teal" variant="light">
                <IconTrendingUp size={16} />
              </ThemeIcon>
            </Group>
            <Group align="baseline" gap="xs">
              <Text fw={900} size="2rem" className="metric-number">
                98.4%
              </Text>
              <Badge color="teal" variant="light" size="sm" leftSection={<IconArrowUpRight size={12} />}>
                +4.2%
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Sprints delivered on schedule across all squads
            </Text>
          </Paper>

          <Paper p="lg" radius="md" withBorder className="visibility-metric-tile">
            <Group justify="space-between" align="flex-start" mb="xs">
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Active Projects
              </Text>
              <ThemeIcon size={30} radius="md" color="cyan" variant="light">
                <IconFolderCheck size={16} />
              </ThemeIcon>
            </Group>
            <Group align="baseline" gap="xs">
              <Text fw={900} size="2rem" className="metric-number">
                14
              </Text>
              <Badge color="cyan" variant="light" size="sm">
                In Production
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Across 3 cross-functional squads with zero collisions
            </Text>
          </Paper>

          <Paper p="lg" radius="md" withBorder className="visibility-metric-tile">
            <Group justify="space-between" align="flex-start" mb="xs">
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Stalled Blockers
              </Text>
              <ThemeIcon size={30} radius="md" color="teal" variant="light">
                <IconShieldCheck size={16} />
              </ThemeIcon>
            </Group>
            <Group align="baseline" gap="xs">
              <Text fw={900} size="2rem" className="metric-number" c="teal">
                0
              </Text>
              <Badge color="teal" variant="filled" size="sm">
                SLA Maintained
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Average blocker resolution turnaround under 3.5h
            </Text>
          </Paper>
        </SimpleGrid>

        {/* Interactive Team Member Capacity Inspector */}
        <Card radius="lg" p={{ base: "md", md: "xl" }} withBorder className="capacity-inspector-card">
          <Group justify="space-between" align="center" mb="lg" wrap="wrap" gap="sm">
            <Group gap="xs">
              <ThemeIcon size={32} radius="md" color="teal" variant="light">
                <IconUserCheck size={18} />
              </ThemeIcon>
              <Box>
                <Text fw={800} size="sm">
                  Team Member Capacity Inspector
                </Text>
                <Text size="11px" c="dimmed">
                  Select an engineer to inspect allocated bandwidth and current deliverables
                </Text>
              </Box>
            </Group>
            <Badge variant="outline" color="teal" size="sm">
              Live Workload Balance
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 12 }} spacing="lg">
            {/* Left Member Selector (5 cols) */}
            <Stack gap="sm" style={{ gridColumn: "span 5" }}>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Select Team Member
              </Text>
              {teamMembers.map((member) => {
                const isSelected = member.id === selectedMemberId;

                return (
                  <Paper
                    key={member.id}
                    p="sm"
                    radius="md"
                    withBorder
                    className={`member-select-card ${isSelected ? "member-card-selected" : ""}`}
                    onClick={() => setSelectedMemberId(member.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedMemberId(member.id);
                      }
                    }}
                    aria-label={`Select ${member.name}`}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <Avatar size={38} radius="xl" color={member.avatarColor}>
                          {member.initials}
                        </Avatar>
                        <Box>
                          <Text fw={800} size="sm">
                            {member.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {member.role}
                          </Text>
                        </Box>
                      </Group>

                      <Badge
                        size="sm"
                        variant={isSelected ? "filled" : "light"}
                        color={member.capacityColor}
                      >
                        {member.capacity}%
                      </Badge>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>

            {/* Right Member Detail Panel (7 cols) */}
            <Paper p="lg" radius="md" withBorder className="member-detail-panel" style={{ gridColumn: "span 7" }}>
              {/* Selected Member Header */}
              <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
                <Group gap="sm">
                  <Avatar size={48} radius="xl" color={selectedMember.avatarColor}>
                    {selectedMember.initials}
                  </Avatar>
                  <Box>
                    <Text fw={900} size="md">
                      {selectedMember.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {selectedMember.role} • {selectedMember.activeProjects.join(", ")}
                    </Text>
                  </Box>
                </Group>
                <Badge color={selectedMember.capacityColor} variant="light" size="sm">
                  {selectedMember.capacityLevel}
                </Badge>
              </Group>

              {/* Capacity Progress Bar */}
              <Box mb="md">
                <Group justify="space-between" mb={4}>
                  <Text size="xs" fw={700} c="dimmed">
                    Capacity Utilization
                  </Text>
                  <Text size="xs" fw={900} c={selectedMember.capacityColor}>
                    {selectedMember.capacity}% allocated
                  </Text>
                </Group>
                <Progress
                  value={selectedMember.capacity}
                  color={selectedMember.capacityColor}
                  size="sm"
                  radius="xl"
                />
              </Box>

              {/* Current Focus Box */}
              <Paper p="xs" radius="sm" className="focus-callout" mb="md">
                <Group gap={6} align="flex-start" wrap="nowrap">
                  <IconTarget size={15} color="#0b7285" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Box>
                    <Text size="11px" fw={800} c="teal">
                      CURRENT ARCHITECTURAL FOCUS
                    </Text>
                    <Text size="xs" fw={600}>
                      {selectedMember.currentFocus}
                    </Text>
                  </Box>
                </Group>
              </Paper>

              {/* Assigned Deliverables List */}
              <Stack gap="xs">
                <Text size="xs" fw={800} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Active Deliverables ({selectedMember.deliverables.length})
                </Text>
                {selectedMember.deliverables.map((item) => (
                  <Paper key={item.id} p="xs" radius="sm" withBorder className="deliverable-item-row">
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <IconChecklist size={15} color="#868e96" />
                        <Box>
                          <Text size="xs" fw={700}>
                            {item.title}
                          </Text>
                          <Text size="10px" c="dimmed">
                            {item.project}
                          </Text>
                        </Box>
                      </Group>
                      <Badge size="xs" variant="light" color={item.statusColor}>
                        {item.status}
                      </Badge>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </SimpleGrid>
        </Card>
      </Container>
    </section>
  );
}
