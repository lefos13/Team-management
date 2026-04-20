/* Convert the richer task form into the API payload shape so scheduling stays valid and reusable. */
import type { ProjectSummaryDTO, TaskDTO, TaskInput, TeamMemberDTO } from "@team-management/shared";
import { taskStatusValues } from "@team-management/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Modal, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";

import { toDateTimeLocalValue, toIsoFromLocal } from "../../lib/dates";

const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().optional(),
    status: z.enum(taskStatusValues),
    deadline: z.string().min(1, "Deadline is required."),
    startDate: z.string().optional(),
    projectId: z.string().min(1, "Project is required."),
    assigneeId: z.string().min(1, "Assignee is required."),
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
  onClose: () => void;
  onSubmit: (values: TaskInput) => void;
};

export function TaskFormModal({
  projects,
  members,
  opened,
  pending,
  task,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      deadline: "",
      startDate: "",
      projectId: "",
      assigneeId: "",
    },
  });

  useEffect(() => {
    form.reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "todo",
      deadline: toDateTimeLocalValue(task?.deadline ?? null),
      startDate: toDateTimeLocalValue(task?.startDate ?? null),
      projectId: task?.projectId ?? "",
      assigneeId: task?.assigneeId ?? "",
    });
  }, [form, task]);

  const selectedProjectId = form.watch("projectId");
  const assignableMembers = members.filter(
    (member) => member.active && member.projectIds.includes(selectedProjectId),
  );

  return (
    <Modal opened={opened} onClose={onClose} title={task ? "Edit task" : "New task"} centered size="lg" radius="lg">
      <form
        onSubmit={form.handleSubmit((values) => {
          onSubmit({
            title: values.title,
            description: values.description ?? "",
            status: values.status,
            deadline: toIsoFromLocal(values.deadline),
            startDate: values.startDate ? toIsoFromLocal(values.startDate) : "",
            projectId: values.projectId,
            assigneeId: values.assigneeId,
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
                data={taskStatusValues.map((status) => ({ value: status, label: status.replace("_", " ") }))}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "todo")}
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
            name="assigneeId"
            render={({ field }) => (
              <Select
                label="Assignee"
                data={assignableMembers.map((member) => ({ value: member.id, label: member.name }))}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "")}
                error={form.formState.errors.assigneeId?.message}
                disabled={!selectedProjectId}
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
