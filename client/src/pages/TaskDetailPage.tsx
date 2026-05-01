/* Present one read-focused task screen so description, notes, and attachments
live outside the busy /tasks table while preserving the archive-only behavior
for done work and keeping notes out of list views.
*/
import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconDownload, IconEye, IconFileText, IconNotes } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { DefectBadge, TaskStatusBadge } from "../components/StatusBadge";
import {
  downloadTaskAttachment,
  downloadTaskAttachmentArchive,
  previewTaskAttachment,
  useTaskDetail,
  useUpdateTask,
} from "../hooks/use-app-data";
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

async function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const taskQuery = useTaskDetail(taskId ?? null);
  const updateTask = useUpdateTask();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(taskQuery.data?.notes ?? "");
  }, [taskQuery.data?.notes]);

  if (taskQuery.isLoading) {
    return <Loader />;
  }

  const task = taskQuery.data;

  if (!task) {
    return (
      <Stack gap="xl">
        <PageHeader title="Task" description="The requested task could not be loaded." />
        <Alert color="red" variant="light">Task not found.</Alert>
      </Stack>
    );
  }

  const currentTask = task;

  async function handleSaveNotes() {
    try {
      await updateTask.mutateAsync({
        id: currentTask.id,
        payload: {
          title: currentTask.title,
          description: currentTask.description ?? "",
          notes,
          status: currentTask.status,
          isDefect: currentTask.isDefect,
          deadline: currentTask.deadline ?? "",
          startDate: currentTask.startDate ?? "",
          projectId: currentTask.projectId,
          assigneeId: currentTask.assigneeId,
          assigneeIds: currentTask.assigneeIds,
          parentTaskId: currentTask.parentTaskId,
        },
      });
      notifications.show({
        color: "teal",
        title: "Notes saved",
        message: "Task notes were updated.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to save notes",
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title={task.title}
        description="Review task details, notes, and attachments without the list view noise."
        action={
          <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/tasks")}>
            Back to tasks
          </Button>
        }
      />

      <Paper radius="xl" p="lg" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <TaskStatusBadge status={task.status} />
            {task.isDefect ? <DefectBadge /> : null}
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Project</Text>
              <Text size="sm" c="dimmed">{task.projectName}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Assignees</Text>
              <Text size="sm" c="dimmed">{task.assigneeNames.join(", ")}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Start date</Text>
              <Text size="sm" c="dimmed">{task.startDate ? formatDateTime(task.startDate) : "No start date"}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Deadline</Text>
              <Text size="sm" c="dimmed">{task.deadline ? formatDateTime(task.deadline) : "No deadline"}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Created</Text>
              <Text size="sm" c="dimmed">{formatDateTime(task.createdAt)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Updated</Text>
              <Text size="sm" c="dimmed">{formatDateTime(task.updatedAt)}</Text>
            </Stack>
          </SimpleGrid>
          {task.parentTaskId && task.parentTaskTitle ? (
            <Text size="sm" c="dimmed">
              Parent task: <Anchor component={Link} to={`/tasks/${task.parentTaskId}`}>{task.parentTaskTitle}</Anchor>
            </Text>
          ) : null}
        </Stack>
      </Paper>

      <Paper radius="xl" p="lg" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <IconFileText size={18} />
            <Text fw={800}>Description</Text>
          </Group>
          <Text c="dimmed">{task.description || "No description added."}</Text>
        </Stack>
      </Paper>

      <Paper radius="xl" p="lg" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <IconNotes size={18} />
            <Text fw={800}>Notes</Text>
          </Group>
          <Textarea
            minRows={6}
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            placeholder="Add internal notes for this task."
          />
          <Group justify="end">
            <Button
              loading={updateTask.isPending}
              disabled={notes === (task.notes ?? "")}
              onClick={() => void handleSaveNotes()}
            >
              Save notes
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper radius="xl" p="lg" withBorder>
        <Stack gap="sm">
          <Text fw={800}>Attachments</Text>
          {task.status === "done" ? (
            <>
              <Text size="sm" c="dimmed">
                Preview is disabled for done tasks. Download the archive to inspect the compressed files.
              </Text>
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                disabled={!task.attachmentArchive}
                onClick={async () => {
                  try {
                    const blob = await downloadTaskAttachmentArchive(task.id);
                    await saveBlob(blob, `task-${task.id}-attachments.zip`);
                  } catch (error) {
                    notifications.show({
                      color: "red",
                      title: "Unable to download archive",
                      message: getErrorMessage(error),
                    });
                  }
                }}
              >
                Download archive
              </Button>
            </>
          ) : task.attachments.length === 0 ? (
            <Text size="sm" c="dimmed">No attachments added.</Text>
          ) : (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {task.attachments.filter((attachment) => isImageAttachment(attachment.mimeType)).map((attachment) => (
                  <Paper key={attachment.id} withBorder radius="md" p="sm">
                    <Stack gap="xs">
                      <Text size="sm" fw={700}>{attachment.filename}</Text>
                      <img
                        src={buildApiUrl(`/tasks/${task.id}/attachments/${attachment.id}/preview`)}
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
                  <Group key={attachment.id} justify="space-between" wrap="nowrap">
                    <Stack gap={0} style={{ flex: 1 }}>
                      <Text size="sm" fw={600}>{attachment.filename}</Text>
                      <Text size="xs" c="dimmed">
                        {formatAttachmentSize(attachment.sizeBytes)} • {attachment.mimeType}
                      </Text>
                    </Stack>
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconDownload size={14} />}
                        onClick={async () => {
                          try {
                            const blob = await downloadTaskAttachment(task.id, attachment.id);
                            await saveBlob(blob, attachment.filename);
                          } catch (error) {
                            notifications.show({
                              color: "red",
                              title: "Unable to download attachment",
                              message: getErrorMessage(error),
                            });
                          }
                        }}
                      >
                        Download
                      </Button>
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconEye size={14} />}
                        disabled={!isPreviewableAttachment(attachment.mimeType)}
                        onClick={async () => {
                          try {
                            const blob = await previewTaskAttachment(task.id, attachment.id);
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
