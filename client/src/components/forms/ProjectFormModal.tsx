/* Wrap project creation and editing in one validated modal so list interactions stay compact. */
import type { ProjectInput, ProjectSummaryDTO, TeamMemberDTO } from "@team-management/shared";
import { projectInputSchema, projectStatusValues } from "@team-management/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, ColorInput, Modal, MultiSelect, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";

type ProjectFormValues = z.input<typeof projectInputSchema>;

type ProjectFormModalProps = {
  members: TeamMemberDTO[];
  opened: boolean;
  pending: boolean;
  project: (ProjectSummaryDTO & { memberIds?: string[] }) | null;
  onClose: () => void;
  onSubmit: (values: ProjectInput) => void;
};

export function ProjectFormModal({
  members,
  opened,
  pending,
  project,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectInputSchema),
    defaultValues: {
      name: "",
      description: "",
      aiContext: "",
      status: "active",
      color: "#16A98B",
      memberIds: [],
    },
  });

  useEffect(() => {
    form.reset({
      name: project?.name ?? "",
      description: project?.description ?? "",
      aiContext: project?.aiContext ?? "",
      status: project?.status ?? "active",
      color: project?.color ?? "#16A98B",
      memberIds: project?.memberIds ?? [],
    });
  }, [form, project]);

  return (
    <Modal opened={opened} onClose={onClose} title={project ? "Edit project" : "New project"} centered radius="lg">
      <form onSubmit={form.handleSubmit((values) => onSubmit(projectInputSchema.parse(values) as ProjectInput))}>
        <Stack>
          <TextInput label="Name" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Textarea
            label="Description"
            minRows={3}
            {...form.register("description")}
            error={form.formState.errors.description?.message}
          />
          <Textarea
            label="AI context"
            description="Extra project context included when exporting a task as an agent prompt."
            minRows={5}
            {...form.register("aiContext")}
            error={form.formState.errors.aiContext?.message}
          />
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                label="Status"
                data={projectStatusValues.map((status) => ({ value: status, label: status.replace("_", " ") }))}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "active")}
              />
            )}
          />
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => (
              <ColorInput
                label="Accent color"
                value={field.value ?? ""}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={form.control}
            name="memberIds"
            render={({ field }) => (
              <MultiSelect
                label="Team members"
                data={members.filter((member) => member.active).map((member) => ({ value: member.id, label: member.name }))}
                value={field.value}
                onChange={field.onChange}
                searchable
              />
            )}
          />
          <Button type="submit" loading={pending}>
            Save project
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
