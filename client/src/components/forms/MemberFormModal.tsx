/* Keep member editing lightweight while preserving project assignment and active state in one form. */
import type { MemberInput, ProjectSummaryDTO, TeamMemberDTO } from "@team-management/shared";
import { memberInputSchema } from "@team-management/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Modal, MultiSelect, Stack, Textarea, TextInput } from "@mantine/core";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";

type MemberFormValues = z.input<typeof memberInputSchema>;

type MemberFormModalProps = {
  projects: ProjectSummaryDTO[];
  member: TeamMemberDTO | null;
  opened: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: MemberInput) => void;
};

export function MemberFormModal({
  projects,
  member,
  opened,
  pending,
  onClose,
  onSubmit,
}: MemberFormModalProps) {
  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberInputSchema),
    defaultValues: {
      name: "",
      role: "",
      email: "",
      notes: "",
      active: true,
      projectIds: [],
    },
  });

  useEffect(() => {
    form.reset({
      name: member?.name ?? "",
      role: member?.role ?? "",
      email: member?.email ?? "",
      notes: member?.notes ?? "",
      active: member?.active ?? true,
      projectIds: member?.projectIds ?? [],
    });
  }, [form, member]);

  return (
    <Modal opened={opened} onClose={onClose} title={member ? "Edit member" : "New member"} centered radius="lg">
      <form onSubmit={form.handleSubmit((values) => onSubmit(memberInputSchema.parse(values) as MemberInput))}>
        <Stack>
          <TextInput label="Name" {...form.register("name")} error={form.formState.errors.name?.message} />
          <TextInput label="Role" {...form.register("role")} error={form.formState.errors.role?.message} />
          <TextInput label="Email" {...form.register("email")} error={form.formState.errors.email?.message} />
          <Textarea label="Notes" minRows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
          <Controller
            control={form.control}
            name="projectIds"
            render={({ field }) => (
              <MultiSelect
                label="Projects"
                searchable
                data={projects.map((project) => ({ value: project.id, label: project.name }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <Checkbox
                label="Available for assignment"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button type="submit" loading={pending}>
            Save member
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
