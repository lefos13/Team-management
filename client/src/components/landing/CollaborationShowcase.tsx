import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCalendar,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconCopy,
  IconEdit,
  IconEye,
  IconLock,
  IconNotes,
  IconShare,
  IconShieldLock,
  IconTrash,
  IconUserCheck,
} from "@tabler/icons-react";
import { useState } from "react";

type CalendarDay = {
  id: string;
  dayLabel: string;
  dateNumber: string;
  month: string;
  theme: string;
  deliverables: {
    time: string;
    title: string;
    owner: string;
    ownerInitials: string;
    status: string;
    statusColor: string;
  }[];
};

const calendarDays: CalendarDay[] = [
  {
    id: "mon",
    dayLabel: "Mon",
    dateNumber: "07",
    month: "Sep",
    theme: "Architecture Sign-off",
    deliverables: [
      {
        time: "10:00 AM",
        title: "System RFC Architectural Sign-off",
        owner: "Elena Rostova",
        ownerInitials: "ER",
        status: "Completed",
        statusColor: "teal",
      },
      {
        time: "02:30 PM",
        title: "Threat Modeling & Attack Surface Review",
        owner: "Security Pod",
        ownerInitials: "SP",
        status: "Completed",
        statusColor: "teal",
      },
    ],
  },
  {
    id: "tue",
    dayLabel: "Tue",
    dateNumber: "08",
    month: "Sep",
    theme: "API Integration",
    deliverables: [
      {
        time: "11:00 AM",
        title: "Stripe Webhook Receiver v2 implementation",
        owner: "Marcus Vance",
        ownerInitials: "MV",
        status: "In Progress",
        statusColor: "blue",
      },
      {
        time: "04:00 PM",
        title: "Idempotency Key validation test harness",
        owner: "Elena Rostova",
        ownerInitials: "ER",
        status: "In Progress",
        statusColor: "blue",
      },
    ],
  },
  {
    id: "wed",
    dayLabel: "Wed",
    dateNumber: "09",
    month: "Sep",
    theme: "Load & Chaos",
    deliverables: [
      {
        time: "01:00 PM",
        title: "50,000 req/s load test execution",
        owner: "Sofia Chen",
        ownerInitials: "SC",
        status: "Scheduled",
        statusColor: "cyan",
      },
      {
        time: "03:30 PM",
        title: "Simulated network partition failover drill",
        owner: "Marcus Vance",
        ownerInitials: "MV",
        status: "Scheduled",
        statusColor: "cyan",
      },
    ],
  },
  {
    id: "thu",
    dayLabel: "Thu",
    dateNumber: "10",
    month: "Sep",
    theme: "Client UAT Demo",
    deliverables: [
      {
        time: "02:00 PM",
        title: "Sandbox checkout flow stakeholder walkthrough",
        owner: "Elena & Sofia",
        ownerInitials: "ES",
        status: "Upcoming",
        statusColor: "orange",
      },
      {
        time: "04:30 PM",
        title: "Client read-only verification token issuance",
        owner: "Elena Rostova",
        ownerInitials: "ER",
        status: "Upcoming",
        statusColor: "orange",
      },
    ],
  },
  {
    id: "fri",
    dayLabel: "Fri",
    dateNumber: "11",
    month: "Sep",
    theme: "Production Cutover",
    deliverables: [
      {
        time: "09:00 AM",
        title: "Canary rollout to 5% production traffic",
        owner: "DevOps Squad",
        ownerInitials: "DO",
        status: "Planned",
        statusColor: "gray",
      },
      {
        time: "03:00 PM",
        title: "Full traffic cutover & cluster health monitor",
        owner: "Full Team",
        ownerInitials: "TM",
        status: "Planned",
        statusColor: "gray",
      },
    ],
  },
];

export function CollaborationShowcase() {
  const [selectedDayId, setSelectedDayId] = useState<string>("thu");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"manager" | "client">("client");

  const selectedDay = calendarDays.find((d) => d.id === selectedDayId) ?? calendarDays[3]!;
  const simulatedTokenUrl = "https://app.team-management.local/share/tasks/sec_tok_994a82f";

  function handleCopy() {
    navigator.clipboard?.writeText?.(simulatedTokenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="landing-section" id="collaboration">
      <Container size="xl">
        {/* Section Header */}
        <Stack gap="xs" align="center" ta="center" mb={{ base: 36, md: 54 }}>
          <Badge variant="light" color="teal" size="lg" radius="sm">
            Calendar & Client Sharing
          </Badge>
          <Title order={2} className="section-heading">
            Align internal schedules with client certainty.
          </Title>
          <Text size="lg" c="dimmed" maw={720}>
            Plan milestone dates across your delivery calendar, then generate cryptographically secure,
            read-only preview links for external stakeholders without exposing sensitive controls.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
          {/* Left Card: Interactive 5-Day Milestone Calendar Strip */}
          <Card radius="lg" p={{ base: "md", md: "xl" }} withBorder className="collaboration-card">
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <Group gap="xs">
                <ThemeIcon size={32} radius="md" color="teal" variant="light">
                  <IconCalendarEvent size={18} />
                </ThemeIcon>
                <Box>
                  <Text fw={800} size="sm">
                    Milestone Calendar Strip
                  </Text>
                  <Text size="11px" c="dimmed">
                    Click any day to inspect scheduled delivery items
                  </Text>
                </Box>
              </Group>
              <Badge variant="outline" color="teal" size="sm">
                Sprint 14 Timeline
              </Badge>
            </Group>

            {/* 5-Day Strip */}
            <SimpleGrid cols={5} spacing={6} mb="lg">
              {calendarDays.map((day) => {
                const isSelected = day.id === selectedDayId;

                return (
                  <Paper
                    key={day.id}
                    p="xs"
                    radius="md"
                    withBorder
                    className={`calendar-day-btn ${isSelected ? "calendar-day-selected" : ""}`}
                    onClick={() => setSelectedDayId(day.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDayId(day.id);
                      }
                    }}
                    aria-label={`Select ${day.dayLabel} ${day.month} ${day.dateNumber}`}
                  >
                    <Stack gap={2} align="center">
                      <Text size="10px" fw={700} c="dimmed" style={{ textTransform: "uppercase" }}>
                        {day.dayLabel}
                      </Text>
                      <Text fw={900} size="md" className="calendar-date-text">
                        {day.dateNumber}
                      </Text>
                      <Text size="9px" c={isSelected ? "teal" : "dimmed"} fw={700}>
                        {day.month}
                      </Text>
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>

            {/* Selected Day Deliverables Header */}
            <Paper p="sm" radius="md" className="calendar-selected-summary" mb="md">
              <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="xs">
                  <IconCalendar size={16} color="#0b7285" />
                  <Text size="xs" fw={800}>
                    {selectedDay.dayLabel}, {selectedDay.month} {selectedDay.dateNumber} • {selectedDay.theme}
                  </Text>
                </Group>
                <Badge size="xs" color="teal" variant="light">
                  {selectedDay.deliverables.length} Deliverables
                </Badge>
              </Group>
            </Paper>

            {/* Deliverables List for Selected Day */}
            <Stack gap="xs">
              {selectedDay.deliverables.map((item, idx) => (
                <Paper key={idx} p="sm" radius="md" withBorder className="calendar-deliverable-row">
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <Avatar size={28} radius="xl" color="teal">
                        {item.ownerInitials}
                      </Avatar>
                      <Box>
                        <Text size="xs" fw={700}>
                          {item.title}
                        </Text>
                        <Group gap={6} mt={2}>
                          <IconClock size={12} color="#868e96" />
                          <Text size="10px" c="dimmed">
                            {item.time} • Owner: {item.owner}
                          </Text>
                        </Group>
                      </Box>
                    </Group>
                    <Badge size="xs" variant="light" color={item.statusColor}>
                      {item.status}
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Card>

          {/* Right Card: Client Share Preview Simulation */}
          <Card radius="lg" p={{ base: "md", md: "xl" }} withBorder className="collaboration-card">
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <Group gap="xs">
                <ThemeIcon size={32} radius="md" color="teal" variant="light">
                  <IconShare size={18} />
                </ThemeIcon>
                <Box>
                  <Text fw={800} size="sm">
                    Client Share Preview Simulation
                  </Text>
                  <Text size="11px" c="dimmed">
                    Simulate /share/tasks/:token with role isolation
                  </Text>
                </Box>
              </Group>

              {/* View Switcher Segmented Control */}
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={(value) => setViewMode(value as "manager" | "client")}
                data={[
                  { label: "Manager View", value: "manager" },
                  { label: "Client Preview", value: "client" },
                ]}
                className="view-mode-switch"
              />
            </Group>

            {/* Share URL Box */}
            <Paper p="xs" radius="md" withBorder className="share-url-box" mb="md">
              <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ overflow: "hidden", minWidth: 0 }}>
                  <IconLock size={15} color="#0b7285" style={{ flexShrink: 0 }} />
                  <Text size="xs" fw={600} className="share-url-text" truncate>
                    {simulatedTokenUrl}
                  </Text>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? "teal" : "gray"}
                  radius="sm"
                  leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  onClick={handleCopy}
                  style={{ flexShrink: 0 }}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </Group>
            </Paper>

            {/* Dynamic View Mode Content */}
            {viewMode === "client" ? (
              /* Client Read-Only Mode */
              <Stack gap="sm">
                <Paper p="xs" radius="sm" className="client-verified-banner">
                  <Group gap="xs" wrap="nowrap">
                    <IconShieldLock size={18} color="#099268" style={{ flexShrink: 0 }} />
                    <Box>
                      <Text size="xs" fw={800} c="teal">
                        VERIFIED CLIENT ACCESS • READ-ONLY TOKEN
                      </Text>
                      <Text size="11px" c="dimmed">
                        Internal administrative controls, staff reassignments, and internal cost metrics are hidden.
                      </Text>
                    </Box>
                  </Group>
                </Paper>

                <Paper p="md" radius="md" withBorder className="client-preview-body">
                  <Group justify="space-between" align="flex-start" mb="xs">
                    <Box>
                      <Text size="xs" c="dimmed" fw={700}>
                        PROJECT DELIVERABLE
                      </Text>
                      <Text fw={800} size="sm">
                        Payment Gateway & Mobile API v2
                      </Text>
                    </Box>
                    <Badge color="teal" variant="filled" size="sm">
                      Verified Progress: 92%
                    </Badge>
                  </Group>

                  <Progress value={92} color="teal" size="sm" radius="xl" mb="md" />

                  <Stack gap="xs">
                    <Text size="11px" fw={800} c="dimmed" style={{ textTransform: "uppercase" }}>
                      Delivered Sign-offs
                    </Text>
                    {[
                      "PCI-DSS Level 1 Compliance Certification",
                      "Multi-Currency Settlement Engine",
                      "Automated Chargeback Dispute Hooks",
                    ].map((item, idx) => (
                      <Group key={idx} gap="xs" wrap="nowrap">
                        <ThemeIcon size={18} radius="xl" color="teal" variant="light">
                          <IconCheck size={12} />
                        </ThemeIcon>
                        <Text size="xs" fw={600}>
                          {item}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              </Stack>
            ) : (
              /* Manager Internal View Mode */
              <Stack gap="sm">
                <Paper p="xs" radius="sm" className="manager-internal-banner">
                  <Group gap="xs" wrap="nowrap">
                    <IconEye size={18} color="#0b7285" style={{ flexShrink: 0 }} />
                    <Box>
                      <Text size="xs" fw={800} c="blue">
                        INTERNAL MANAGER CONTROLS ACTIVE
                      </Text>
                      <Text size="11px" c="dimmed">
                        Full operational rights: reassign engineers, adjust sprint velocity, edit sensitive notes.
                      </Text>
                    </Box>
                  </Group>
                </Paper>

                <Paper p="md" radius="md" withBorder className="manager-preview-body">
                  <Group justify="space-between" align="flex-start" mb="sm">
                    <Box>
                      <Text size="xs" c="dimmed" fw={700}>
                        INTERNAL SPRINT BUDGET
                      </Text>
                      <Text fw={800} size="sm">
                        $14,200 allocated • 42 Story Points
                      </Text>
                    </Box>
                    <Badge color="blue" variant="light" size="sm">
                      Manager Privileges
                    </Badge>
                  </Group>

                  {/* Manager Control Buttons */}
                  <Group gap="xs" mt="md" wrap="wrap">
                    <Button size="xs" variant="light" color="blue" leftSection={<IconEdit size={12} />}>
                      Edit Scope
                    </Button>
                    <Button size="xs" variant="light" color="teal" leftSection={<IconUserCheck size={12} />}>
                      Reassign Owner
                    </Button>
                    <Button size="xs" variant="light" color="gray" leftSection={<IconNotes size={12} />}>
                      Internal Notes
                    </Button>
                    <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={12} />}>
                      Archive
                    </Button>
                  </Group>
                </Paper>
              </Stack>
            )}
          </Card>
        </SimpleGrid>
      </Container>
    </section>
  );
}
