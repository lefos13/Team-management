/*
Convert the task form into the API payload shape, including the compatibility
primary assignee and the complete multi-assignee member set.
*/
import type { ProjectSummaryDTO, TaskDTO, TaskInput, TeamMemberDTO } from "@team-management/shared";
import { taskStatusLabels, taskStatusValues } from "@team-management/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Checkbox, Modal, MultiSelect, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";

import { toDateTimeLocalValue, toIsoFromLocal } from "../../lib/dates";

const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().optional(),
    status: z.enum(taskStatusValues),
    isDefect: z.boolean(),
    deadline: z.string().min(1, "Deadline is required."),
    startDate: z.string().optional(),
    projectId: z.string().min(1, "Project is required."),
    assigneeIds: z.array(z.string()).min(1, "At least one assignee is required."),
    parentTaskId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && new Date(value.startDate) > new Date(value.deadline)) {
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
  task: TaskDTO | null;
  tasks: TaskDTO[];
  onClose: () => void;
  onSubmit: (values: TaskInput) => void;
};

export function TaskFormModal({
  projects,
  members,
  opened,
  pending,
  task,
  tasks,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
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
  }, [form, task]);

  const selectedProjectId = form.watch("projectId");
  const selectedAssigneeIds = form.watch("assigneeIds");
  const selectedParentTaskId = form.watch("parentTaskId");
  const assignableMembers = members.filter(
    (member) => member.active && member.projectIds.includes(selectedProjectId),
  );
  const taskHasSubtasks = Boolean(task && tasks.some((candidate) => candidate.parentTaskId === task.id));
  const parentOptions = tasks
    .filter((candidate) => candidate.projectId === selectedProjectId && !candidate.parentTaskId && candidate.id !== task?.id)
    .map((candidate) => ({ value: candidate.id, label: candidate.title }));

  useEffect(() => {
    const assignableIds = new Set(assignableMembers.map((member) => member.id));
    const nextAssigneeIds = selectedAssigneeIds.filter((memberId) => assignableIds.has(memberId));

    if (nextAssigneeIds.length !== selectedAssigneeIds.length) {
      form.setValue("assigneeIds", nextAssigneeIds, { shouldValidate: true });
    }
  }, [assignableMembers, form, selectedAssigneeIds]);

  useEffect(() => {
    const parentIds = new Set(parentOptions.map((option) => option.value));

    if (selectedParentTaskId && (!parentIds.has(selectedParentTaskId) || taskHasSubtasks)) {
      form.setValue("parentTaskId", "", { shouldValidate: true });
    }
  }, [form, parentOptions, selectedParentTaskId, taskHasSubtasks]);

  return (
    <Modal opened={opened} onClose={onClose} title={task ? "Edit task" : "New task"} centered size="lg" radius="lg">
      <form
        onSubmit={form.handleSubmit((values) => {
          onSubmit({
            title: values.title,
            description: values.description ?? "",
            status: values.status,
            isDefect: values.isDefect,
            deadline: toIsoFromLocal(values.deadline),
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
                onChange={(event) => field.onChange(event.currentTarget.checked)}
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
                disabled={!selectedProjectId}
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
          <Button type="submit" loading={pending}>
            Save task
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
