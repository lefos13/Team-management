/*
Convert the task form into the API payload shape, including the compatibility
primary assignee and the complete multi-assignee member set.
*/
import type { ProjectSummaryDTO, TaskDTO, TaskInput, TeamMemberDTO } from "@team-management/shared";
import { taskStatusLabels, taskStatusValues } from "@team-management/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { IconDownload, IconEye, IconTrash, IconUpload } from "@tabler/icons-react";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { z } from "zod";

import { toDateTimeLocalValue, toIsoFromLocal } from "../../lib/dates";

const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().optional(),
    status: z.enum(taskStatusValues),
    isDefect: z.boolean(),
    deadline: z.string().optional(),
    startDate: z.string().optional(),
    projectId: z.string().min(1, "Project is required."),
    assigneeIds: z.array(z.string()).min(1, "At least one assignee is required."),
    parentTaskId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.deadline && new Date(value.startDate) > new Date(value.deadline)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date must be before deadline.",
        path: ["startDate"],
      });
    }
  });

type TaskFormValues = z.infer<typeof taskFormSchema>;

type TaskFormModalProps = {
  projects: ProjectSummaryDTO[];
  members: TeamMemberDTO[];
  opened: boolean;
  pending: boolean;
  attachmentPending: boolean;
  task: TaskDTO | null;
  tasks: TaskDTO[];
  onDeleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  onClose: () => void;
  onDownloadAttachment: (taskId: string, attachmentId: string, filename: string) => Promise<void>;
  onDownloadAttachmentArchive: (taskId: string) => Promise<void>;
  onPreviewAttachment: (taskId: string, attachmentId: string, filename: string, mimeType: string) => Promise<void>;
  onSubmit: (values: TaskInput) => void;
  onUploadAttachments: (taskId: string, files: File[]) => Promise<void>;
};

const maxAttachmentBytes = 10 * 1024 * 1024;

export function validateAttachmentFiles(files: File[]) {
  const oversized = files.find((file) => file.size > maxAttachmentBytes);
  return oversized ? `${oversized.name} exceeds the 10 MB limit.` : null;
}

function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewableAttachment(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

export function TaskFormModal({
  projects,
  members,
  opened,
  pending,
  attachmentPending,
  task,
  tasks,
  onDeleteAttachment,
  onClose,
  onDownloadAttachment,
  onDownloadAttachmentArchive,
  onPreviewAttachment,
  onSubmit,
  onUploadAttachments,
}: TaskFormModalProps) {
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      isDefect: false,
      deadline: "",
      startDate: "",
      projectId: "",
      assigneeIds: [],
      parentTaskId: "",
    },
  });

  useEffect(() => {
    form.reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "todo",
      isDefect: task?.isDefect ?? false,
      deadline: toDateTimeLocalValue(task?.deadline ?? null),
      startDate: toDateTimeLocalValue(task?.startDate ?? null),
      projectId: task?.projectId ?? "",
      assigneeIds: task?.assigneeIds?.length ? task.assigneeIds : task?.assigneeId ? [task.assigneeId] : [],
      parentTaskId: task?.parentTaskId ?? "",
    });
    setAttachmentFiles([]);
    setAttachmentError(null);
  }, [form, task]);

  const selectedProjectId = form.watch("projectId");
  const selectedAssigneeIds = form.watch("assigneeIds");
  const selectedParentTaskId = form.watch("parentTaskId");
  const canManageAssignees = !task || task.canManageAssignees;
  const currentAssigneeOptions = (task?.assigneeIds ?? []).map((memberId, index) => ({
    id: memberId,
    name: task?.assigneeNames[index] ?? task?.assigneeName ?? memberId,
    active: true,
    projectIds: [task?.projectId ?? selectedProjectId],
  }));
  const assignableMembers = [
    ...members.filter((member) => member.active && member.projectIds.includes(selectedProjectId)),
    ...currentAssigneeOptions.filter((assignee) => !members.some((member) => member.id === assignee.id)),
  ];
  const taskHasSubtasks = Boolean(task && tasks.some((candidate) => candidate.parentTaskId === task.id));
  const parentOptions = tasks
    .filter((candidate) => candidate.projectId === selectedProjectId && !candidate.parentTaskId && candidate.id !== task?.id)
    .map((candidate) => ({ value: candidate.id, label: candidate.title }));

  useEffect(() => {
    if (!canManageAssignees) {
      return;
    }

    const assignableIds = new Set(assignableMembers.map((member) => member.id));
    const nextAssigneeIds = selectedAssigneeIds.filter((memberId) => assignableIds.has(memberId));

    if (nextAssigneeIds.length !== selectedAssigneeIds.length) {
      form.setValue("assigneeIds", nextAssigneeIds, { shouldValidate: true });
    }
  }, [assignableMembers, canManageAssignees, form, selectedAssigneeIds]);

  useEffect(() => {
    const parentIds = new Set(parentOptions.map((option) => option.value));

    if (selectedParentTaskId && (!parentIds.has(selectedParentTaskId) || taskHasSubtasks)) {
      form.setValue("parentTaskId", "", { shouldValidate: true });
    }
  }, [form, parentOptions, selectedParentTaskId, taskHasSubtasks]);

  const previewableAttachmentCount = useMemo(
    () => task?.attachments.filter((attachment) => isPreviewableAttachment(attachment.mimeType)).length ?? 0,
    [task],
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      centered
      size="lg"
      radius="lg"
      classNames={{ content: "task-form-modal", body: "task-form-modal-body" }}
    >
      <form
        onSubmit={form.handleSubmit((values) => {
          onSubmit({
            title: values.title,
            description: values.description ?? "",
            status: values.status,
            isDefect: values.isDefect,
            deadline: values.deadline ? toIsoFromLocal(values.deadline) : "",
            startDate: values.startDate ? toIsoFromLocal(values.startDate) : "",
            projectId: values.projectId,
            assigneeId: values.assigneeIds[0],
            assigneeIds: values.assigneeIds,
            parentTaskId: values.parentTaskId || null,
          });
        })}
      >
        <Stack>
          <TextInput label="Title" {...form.register("title")} error={form.formState.errors.title?.message} />
          <Textarea
            label="Description"
            minRows={3}
            {...form.register("description")}
            error={form.formState.errors.description?.message}
          />
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                label="Status"
                data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "todo")}
              />
            )}
          />
          <Controller
            control={form.control}
            name="isDefect"
            render={({ field }) => (
              <Checkbox
                label="Mark as defect"
                checked={field.value}
                onChange={(event: ChangeEvent<HTMLInputElement>) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <Select
                label="Project"
                data={projects.map((project) => ({ value: project.id, label: project.name }))}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "")}
                error={form.formState.errors.projectId?.message}
                disabled={Boolean(task && !task.canManageAssignees)}
              />
            )}
          />
          <Controller
            control={form.control}
            name="assigneeIds"
            render={({ field }) => (
              <MultiSelect
                label="Assignees"
                data={assignableMembers.map((member) => ({ value: member.id, label: member.name }))}
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.assigneeIds?.message}
                disabled={!selectedProjectId || !canManageAssignees}
                searchable
              />
            )}
          />
          {taskHasSubtasks ? (
            <Alert color="yellow" variant="light">
              Tasks with subtasks cannot be moved under another parent.
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="parentTaskId"
            render={({ field }) => (
              <Select
                label="Parent task"
                description="Leave empty for a top-level task."
                clearable
                data={parentOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                disabled={!selectedProjectId || taskHasSubtasks}
                searchable
              />
            )}
          />
          <TextInput
            label="Start date"
            type="datetime-local"
            {...form.register("startDate")}
            error={form.formState.errors.startDate?.message}
          />
          <TextInput
            label="Deadline"
            type="datetime-local"
            {...form.register("deadline")}
            error={form.formState.errors.deadline?.message}
          />
          <Paper withBorder radius="md" p="md">
            {task ? (
              <Stack gap="sm">
                <Text fw={600}>Attachments</Text>
                {task.status === "done" ? (
                  <>
                    <Text size="sm" c="dimmed">
                      Preview is disabled for done tasks. Download the archive to inspect the compressed files.
                    </Text>
                    <Text size="sm" c="dimmed">
                      {task.attachments.length} files archived{task.attachmentArchive ? ` • ${formatAttachmentSize(task.attachmentArchive.sizeBytes)}` : ""}
                    </Text>
                    <Group justify="flex-start">
                      <Button
                        variant="light"
                        leftSection={<IconDownload size={16} />}
                        disabled={!task.attachmentArchive}
                        loading={attachmentPending}
                        onClick={() => void onDownloadAttachmentArchive(task.id)}
                      >
                        Download archive
                      </Button>
                    </Group>
                  </>
                ) : (
                  <>
                    <Text size="sm" c="dimmed">
                      {task.attachments.length} files attached{previewableAttachmentCount > 0 ? ` • ${previewableAttachmentCount} previewable` : ""}
                    </Text>
                    <FileInput
                      label="Add files"
                      placeholder="Upload task files or images"
                      value={attachmentFiles}
                      onChange={(files) => {
                        const nextFiles = Array.isArray(files) ? files.filter(Boolean) : [];
                        const nextError = validateAttachmentFiles(nextFiles);

                        if (nextError) {
                          setAttachmentError(nextError);
                          setAttachmentFiles([]);
                          return;
                        }

                        setAttachmentFiles(nextFiles);
                        setAttachmentError(null);
                      }}
                      multiple
                    />
                    {attachmentError ? <Alert color="red" variant="light">{attachmentError}</Alert> : null}
                    <Group justify="flex-start">
                      <Button
                        variant="light"
                        leftSection={<IconUpload size={16} />}
                        disabled={attachmentFiles.length === 0}
                        loading={attachmentPending}
                        onClick={async () => {
                          if (attachmentFiles.length === 0) {
                            return;
                          }

                          await onUploadAttachments(task.id, attachmentFiles);
                          setAttachmentFiles([]);
                        }}
                      >
                        Upload files
                      </Button>
                    </Group>
                    <Stack gap="xs">
                      {task.attachments.length === 0 ? (
                        <Text size="sm" c="dimmed">No files attached yet.</Text>
                      ) : (
                        task.attachments.map((attachment) => (
                          <Group key={attachment.id} justify="space-between" wrap="nowrap" className="task-form-attachment-row">
                            <Stack gap={0} style={{ flex: 1 }}>
                              <Text size="sm" fw={500} className="task-attachment-name">{attachment.filename}</Text>
                              <Text size="xs" c="dimmed">
                                {formatAttachmentSize(attachment.sizeBytes)} • {attachment.mimeType}
                              </Text>
                            </Stack>
                            <Group gap="xs" wrap="nowrap" className="task-form-attachment-actions">
                              <ActionIcon
                                variant="light"
                                aria-label={`Download ${attachment.filename}`}
                                onClick={() => void onDownloadAttachment(task.id, attachment.id, attachment.filename)}
                              >
                                <IconDownload size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="light"
                                aria-label={`Preview ${attachment.filename}`}
                                disabled={!isPreviewableAttachment(attachment.mimeType)}
                                onClick={() => void onPreviewAttachment(task.id, attachment.id, attachment.filename, attachment.mimeType)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                              <ActionIcon
                                color="red"
                                variant="light"
                                aria-label={`Delete ${attachment.filename}`}
                                loading={attachmentPending}
                                onClick={() => void onDeleteAttachment(task.id, attachment.id)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
                          </Group>
                        ))
                      )}
                    </Stack>
                  </>
                )}
              </Stack>
            ) : (
              <Stack gap="xs">
                <Text fw={600}>Attachments</Text>
                <Text size="sm" c="dimmed">
                  Save the task first, then upload files from this same modal.
                </Text>
              </Stack>
            )}
          </Paper>
          <Button type="submit" loading={pending}>
            Save task
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
