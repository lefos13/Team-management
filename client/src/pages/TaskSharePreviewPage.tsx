/*
Public task shares render the same preview-oriented task data without the app
shell because guests are intentionally allowed to view only this one task.
*/
import type { TaskDTO } from "@team-management/shared";
import { Alert, Anchor, Button, Container, Group, Loader, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEye, IconFileText, IconNotes } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";

import { ThemeToggle } from "../components/ThemeToggle";

import { DefectBadge, TaskStatusBadge } from "../components/StatusBadge";
import { previewSharedTaskAttachment, useTaskSharePreview } from "../hooks/use-app-data";
import { buildApiUrl, getErrorMessage } from "../lib/api";
import { formatDateTime } from "../lib/dates";

function isImageAttachment(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isPreviewableAttachment(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function TaskMeta({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={700}>{label}</Text>
      <Text size="sm" c="dimmed">{value}</Text>
    </Stack>
  );
}

function TaskShareContent({ task, token }: { task: TaskDTO; token: string }) {
  return (
    <Stack gap="lg">
      <Paper radius="md" p="lg" withBorder className="task-share-panel">
        <Stack gap="md">
          <Group gap="sm" wrap="wrap">
            <TaskStatusBadge status={task.status} />
            {task.isDefect ? <DefectBadge /> : null}
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TaskMeta label="Project" value={task.projectName} />
            <TaskMeta label="Assignees" value={task.assigneeNames.length > 0 ? task.assigneeNames.join(", ") : "Unassigned"} />
            <TaskMeta label="Start date" value={task.startDate ? formatDateTime(task.startDate) : "No start date"} />
            <TaskMeta label="Deadline" value={task.deadline ? formatDateTime(task.deadline) : "No deadline"} />
            <TaskMeta label="Created" value={formatDateTime(task.createdAt)} />
            <TaskMeta label="Updated" value={formatDateTime(task.updatedAt)} />
          </SimpleGrid>
        </Stack>
      </Paper>

      <Paper radius="md" p="lg" withBorder className="task-share-panel">
        <Stack gap="sm">
          <Group gap="xs">
            <IconFileText size={18} />
            <Text fw={800}>Description</Text>
          </Group>
          <Text c="dimmed">{task.description || "No description added."}</Text>
        </Stack>
      </Paper>

      <Paper radius="md" p="lg" withBorder className="task-share-panel">
        <Stack gap="sm">
          <Group gap="xs">
            <IconNotes size={18} />
            <Text fw={800}>Notes</Text>
          </Group>
          <Text c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{task.notes || "No notes added."}</Text>
        </Stack>
      </Paper>

      <Paper radius="md" p="lg" withBorder className="task-share-panel">
        <Stack gap="sm">
          <Text fw={800}>Attachments</Text>
          {task.status === "done" ? (
            <Text size="sm" c="dimmed">Attachment preview is disabled for done tasks.</Text>
          ) : task.attachments.length === 0 ? (
            <Text size="sm" c="dimmed">No attachments added.</Text>
          ) : (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {task.attachments.filter((attachment) => isImageAttachment(attachment.mimeType)).map((attachment) => (
                  <Paper key={attachment.id} withBorder radius="md" p="sm" className="task-share-panel">
                    <Stack gap="xs">
                      <Text size="sm" fw={700}>{attachment.filename}</Text>
                      <img
                        src={buildApiUrl(`/task-shares/${token}/attachments/${attachment.id}/preview`)}
                        alt={attachment.filename}
                        style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 8 }}
                      />
                      <Text size="xs" c="dimmed">{formatAttachmentSize(attachment.sizeBytes)}</Text>
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
              <Stack gap="xs">
                {task.attachments.map((attachment) => (
                  <Group key={attachment.id} justify="space-between" wrap="nowrap" className="task-attachment-row">
                    <Stack gap={0} style={{ flex: 1 }}>
                      <Text size="sm" fw={600} className="task-attachment-name">{attachment.filename}</Text>
                      <Text size="xs" c="dimmed">
                        {formatAttachmentSize(attachment.sizeBytes)} • {attachment.mimeType}
                      </Text>
                    </Stack>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconEye size={14} />}
                      disabled={!isPreviewableAttachment(attachment.mimeType)}
                      onClick={async () => {
                        try {
                          const blob = await previewSharedTaskAttachment(token, attachment.id);
                          await openBlob(blob);
                        } catch (error) {
                          notifications.show({
                            color: "red",
                            title: "Unable to preview attachment",
                            message: getErrorMessage(error),
                          });
                        }
                      }}
                    >
                      Preview
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

export function TaskSharePreviewPage() {
  const { token } = useParams();
  const taskQuery = useTaskSharePreview(token ?? null);

  return (
    <main className="task-share-page">
      <Container size="lg" py={{ base: "xl", md: 48 }}>
        <Stack gap="xl">
          <Group justify="space-between" align="center" className="landing-nav">
            <Group gap="sm" className="site-brand" wrap="nowrap">
              <img className="site-brand-logo-small" src="/logo.png" alt="MGteam logo" />
              <Text fw={800} c="inherit">MGteam</Text>
            </Group>
            <Group gap="sm" align="center">
              <ThemeToggle />
              <Anchor component={Link} to="/login">Sign in</Anchor>
            </Group>
          </Group>
          {taskQuery.isLoading ? (
            <Loader />
          ) : taskQuery.data && token ? (
            <>
              <Stack gap={6}>
                <Text className="eyebrow" fw={800}>Shared task preview</Text>
                <Title order={1} className="task-share-title">{taskQuery.data.title}</Title>
                <Text c="dimmed">This read-only preview is available through a task share link.</Text>
              </Stack>
              <TaskShareContent task={taskQuery.data} token={encodeURIComponent(token)} />
            </>
          ) : (
            <Alert color="red" variant="light">This task share link is invalid or no longer available.</Alert>
          )}
        </Stack>
      </Container>
    </main>
  );
}
