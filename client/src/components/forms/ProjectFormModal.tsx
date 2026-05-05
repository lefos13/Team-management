/* Wrap project creation and editing in one validated modal so list interactions stay compact. */
import type { ProjectInput, ProjectSummaryDTO, TeamMemberDTO } from "@team-management/shared";
import { projectInputSchema, projectStatusValues } from "@team-management/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { ActionIcon, Button, ColorInput, Group, Modal, MultiSelect, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";

import { toDateTimeLocalValue, toIsoFromLocal } from "../../lib/dates";

const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(2000).optional(),
  aiContext: z.string().trim().max(1_000_000).optional(),
  goLiveDate: z.string().optional(),
  phaseDates: z.array(
    z.object({
      name: z.string().trim().min(1, "Phase name is required.").max(120),
      date: z.string().min(1, "Phase date is required."),
    }),
  ),
  status: z.enum(projectStatusValues),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, "Use a valid hex color.").optional().or(z.literal("")),
  memberIds: z.array(z.string()),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

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
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      aiContext: "",
      goLiveDate: "",
      phaseDates: [],
      status: "active",
      color: "#16A98B",
      memberIds: [],
    },
  });
  const phaseDateFields = useFieldArray({
    control: form.control,
    name: "phaseDates",
  });

  useEffect(() => {
    form.reset({
      name: project?.name ?? "",
      description: project?.description ?? "",
      aiContext: project?.aiContext ?? "",
      goLiveDate: toDateTimeLocalValue(project?.goLiveDate ?? null),
      phaseDates: project?.phaseDates.map((phaseDate) => ({
        name: phaseDate.name,
        date: toDateTimeLocalValue(phaseDate.date),
      })) ?? [],
      status: project?.status ?? "active",
      color: project?.color ?? "#16A98B",
      memberIds: project?.memberIds ?? [],
    });
  }, [form, project]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      centered
      radius="lg"
      classNames={{ content: "project-form-modal", body: "project-form-modal-body" }}
    >
      <form
        onSubmit={form.handleSubmit((values) => {
          /*
          The browser uses local datetime strings, while the shared API contract
          carries ISO datetimes so calendar markers stay timezone-stable.
          */
          const payload = projectInputSchema.parse({
            ...values,
            goLiveDate: values.goLiveDate ? toIsoFromLocal(values.goLiveDate) : "",
            phaseDates: values.phaseDates.map((phaseDate) => ({
              name: phaseDate.name,
              date: toIsoFromLocal(phaseDate.date),
            })),
          }) as ProjectInput;
          onSubmit(payload);
        })}
      >
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
          <TextInput
            label="Go-live date"
            type="datetime-local"
            {...form.register("goLiveDate")}
            error={form.formState.errors.goLiveDate?.message}
          />
          <Stack gap="xs" className="project-phase-date-section">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={700}>Phase dates</Text>
              <Button
                type="button"
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => phaseDateFields.append({ name: "", date: "" })}
              >
                Add phase
              </Button>
            </Group>
            {phaseDateFields.fields.length === 0 ? (
              <Text size="sm" c="dimmed">No phase markers added.</Text>
            ) : (
              <Stack gap="xs">
                {phaseDateFields.fields.map((field, index) => (
                  <Group key={field.id} gap="xs" align="flex-start" wrap="nowrap" className="project-phase-date-row">
                    <TextInput
                      label="Phase"
                      className="project-phase-name-input"
                      {...form.register(`phaseDates.${index}.name`)}
                      error={form.formState.errors.phaseDates?.[index]?.name?.message}
                    />
                    <TextInput
                      label="Date"
                      type="datetime-local"
                      className="project-phase-date-input"
                      {...form.register(`phaseDates.${index}.date`)}
                      error={form.formState.errors.phaseDates?.[index]?.date?.message}
                    />
                    <ActionIcon
                      type="button"
                      variant="light"
                      color="red"
                      mt={26}
                      aria-label={`Remove phase ${index + 1}`}
                      onClick={() => phaseDateFields.remove(index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>
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
