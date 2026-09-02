/* Present one read-focused task screen so description, notes, and attachments
live outside the busy /tasks table while preserving the archive-only behavior
for done work and keeping notes out of list views.
*/
import type { ProjectDetailDTO, TaskDTO } from "@team-management/shared";
import { Alert, Anchor, Button, Group, Loader, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconDownload, IconEye, IconFileText, IconNotes, IconShare } from "@tabler/icons-react";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RichTextEditor } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import '@mantine/tiptap/styles.css';

import { PageHeader } from "../components/PageHeader";
import { DefectBadge, TaskStatusBadge } from "../components/StatusBadge";
import {
  downloadTaskAttachment,
  downloadTaskAttachmentArchive,
  previewTaskAttachment,
  useCreateTaskShareLink,
  useProjectDetail,
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

/*
Serialize the task and its parent project into a stable prompt so copying from
the detail page gives agents both execution instructions and project context.
*/
function buildTaskAgentPrompt(task: TaskDTO, project: Pick<ProjectDetailDTO, "name" | "status" | "description" | "aiContext">) {
  const sections: string[] = [];
  const projectLines = [
    ...(project.description ? [`Description:\n${project.description}`] : []),
    ...(project.aiContext ? [`AI Context:\n${project.aiContext}`] : []),
  ];
  const taskLines = [
    `Title: ${task.title}`,
    ...(task.description ? [`Description:\n${task.description}`] : []),
    ...(task.notes ? [`Notes:\n${task.notes}`] : []),
  ];

  sections.push(`Project Context\n${projectLines.join("\n\n")}`);
  sections.push(`Task\n${taskLines.join("\n\n")}`);

  return sections.join("\n\n");
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const taskQuery = useTaskDetail(taskId ?? null);
  const projectDetailQuery = useProjectDetail(taskQuery.data?.projectId ?? null);
  const updateTask = useUpdateTask();
  const createTaskShareLink = useCreateTaskShareLink();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TiptapLink,
    ],
    content: taskQuery.data?.notes ?? '',
    editable: taskQuery.data?.canEdit ?? false,
  });

  // Sync editor content when task data changes
  useEffect(() => {
    if (editor && taskQuery.data?.notes !== undefined) {
      const currentContent = editor.getHTML();
      const newContent = taskQuery.data.notes ?? '';
      if (currentContent !== newContent) {
        editor.commands.setContent(newContent);
      }
    }
  }, [editor, taskQuery.data?.notes]);

  // Update editable state when task changes
  useEffect(() => {
    if (editor && taskQuery.data) {
      editor.setEditable(taskQuery.data.canEdit ?? false);
    }
  }, [editor, taskQuery.data?.canEdit]);

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
          notes: editor?.getHTML() ?? '',
          status: currentTask.status,
          isDefect: currentTask.isDefect,
          deadline: currentTask.deadline ?? "",
          startDate: currentTask.startDate ?? "",
          projectId: currentTask.projectId,
          assigneeId: currentTask.assigneeId ?? undefined,
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

  async function handleCopyAgentPrompt() {
    const project = projectDetailQuery.data;

    if (!project) {
      notifications.show({
        color: "red",
        title: "Unable to copy AI prompt",
        message: "Project context is still loading.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(buildTaskAgentPrompt(currentTask, project));
      notifications.show({
        color: "teal",
        title: "AI prompt copied",
        message: "The task prompt was copied with project context.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to copy AI prompt",
        message: getErrorMessage(error, "Clipboard access failed."),
      });
    }
  }

  async function handleCreateShareLink() {
    try {
      const shareLink = await createTaskShareLink.mutateAsync(currentTask.id);
      await navigator.clipboard.writeText(shareLink.url);
      notifications.show({
        color: "teal",
        title: "Share link copied",
        message: "Anyone with the link can preview this task without signing in.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to create share link",
        message: getErrorMessage(error, "Share link creation failed."),
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

      <Paper radius="xl" p="lg" withBorder className="task-detail-panel">
        <Stack gap="md">
          <Group gap="sm" className="task-detail-badges">
            <TaskStatusBadge status={task.status} />
            {task.isDefect ? <DefectBadge /> : null}
          </Group>
          <Group className="task-detail-actions">
            <Button variant="light" leftSection={<IconFileText size={16} />} onClick={() => void handleCopyAgentPrompt()}>
              Copy AI prompt
            </Button>
            {task.canEdit ? (
              <Button
                variant="light"
                leftSection={<IconShare size={16} />}
                loading={createTaskShareLink.isPending}
                onClick={() => void handleCreateShareLink()}
              >
                Share preview
              </Button>
            ) : null}
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Project</Text>
              <Text size="sm" c="dimmed">{task.projectName}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={700}>Assignees</Text>
              <Text size="sm" c="dimmed">{task.assigneeNames.length > 0 ? task.assigneeNames.join(", ") : "Unassigned"}</Text>
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

      <Paper radius="xl" p="lg" withBorder className="task-detail-panel">
        <Stack gap="sm">
          <Group gap="xs">
            <IconFileText size={18} />
            <Text fw={800}>Description</Text>
          </Group>
          <Text c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{task.description || "No description added."}</Text>
        </Stack>
      </Paper>

      <Paper radius="xl" p="lg" withBorder className="task-detail-panel">
        <Stack gap="sm">
          <Group gap="xs">
            <IconNotes size={18} />
            <Text fw={800}>Notes</Text>
          </Group>
          <RichTextEditor editor={editor} className="task-detail-notes-editor">
            <RichTextEditor.Toolbar sticky stickyOffset={0}>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Underline />
                <RichTextEditor.Strikethrough />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.H3 />
                <RichTextEditor.H4 />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.BulletList />
                <RichTextEditor.OrderedList />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Link />
                <RichTextEditor.Unlink />
              </RichTextEditor.ControlsGroup>
            </RichTextEditor.Toolbar>
            <RichTextEditor.Content />
          </RichTextEditor>
          {task.canEdit ? (
            <Group justify="end">
              <Button
                loading={updateTask.isPending}
                disabled={editor?.getHTML() === (task.notes ?? '')}
                onClick={() => void handleSaveNotes()}
              >
                Save notes
              </Button>
            </Group>
          ) : null}
        </Stack>
      </Paper>

      <Paper radius="xl" p="lg" withBorder className="task-detail-panel task-attachments-panel">
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
                  <Group key={attachment.id} justify="space-between" wrap="nowrap" className="task-attachment-row">
                    <Stack gap={0} style={{ flex: 1 }}>
                      <Text size="sm" fw={600} className="task-attachment-name">{attachment.filename}</Text>
                      <Text size="xs" c="dimmed">
                        {formatAttachmentSize(attachment.sizeBytes)} • {attachment.mimeType}
                      </Text>
                    </Stack>
                    <Group gap="xs" wrap="nowrap" className="task-attachment-actions">
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
