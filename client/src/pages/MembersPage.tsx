import { ActionIcon, Button, Card, Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { CompactPagination } from "../components/CompactPagination";
import { MemberFormModal } from "../components/forms/MemberFormModal";
import { useCreateMember, useDeleteMember, useMembers, useProjects, useUpdateMember } from "../hooks/use-app-data";
import { getErrorMessage } from "../lib/api";
import { usePagination } from "../hooks/use-pagination";

export function MembersPage() {
  const [opened, setOpened] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const projectsQuery = useProjects();
  const membersQuery = useMembers();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();

  const editingMember = useMemo(
    () => membersQuery.data?.find((member) => member.id === editingMemberId) ?? null,
    [editingMemberId, membersQuery.data],
  );

  const projects = projectsQuery.data?.ownedProjects ?? [];
  const members = membersQuery.data ?? [];
  const { page, setPage, totalPages, paginatedItems: paginatedMembers } = usePagination(members, 6);

  if (projectsQuery.isLoading || membersQuery.isLoading) {
    return <Loader />;
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Members"
        description="Store team member profiles, project assignments, and open-work counts without needing member logins."
        action={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditingMemberId(null);
              setOpened(true);
            }}
          >
            New member
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} className="paginated-card-grid">
        {paginatedMembers.map((member) => (
          <Card key={member.id} radius="xl" withBorder className="content-card member-card">
            <Stack gap="md">
              <Group justify="space-between" align="start" className="member-card-header">
                <Stack gap={4} className="member-card-copy">
                  <Text fw={800} fz="lg">{member.name}</Text>
                  <Text c="dimmed">{member.role} · {member.email}</Text>
                </Stack>
                <Group gap="xs" className="member-card-actions">
                  <ActionIcon
                    variant="light"
                    onClick={() => {
                      setEditingMemberId(member.id);
                      setOpened(true);
                    }}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    loading={deleteMember.isPending}
                    onClick={async () => {
                      try {
                        await deleteMember.mutateAsync(member.id);
                      } catch (error) {
                        notifications.show({
                          color: "red",
                          title: "Unable to delete member",
                          message: getErrorMessage(error),
                        });
                      }
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
              <Group justify="space-between" className="member-card-stats">
                <Text size="sm">{member.active ? "Active" : "Archived"}</Text>
                <Text size="sm" c="dimmed">
                  {member.openTaskCount} open · {member.completedTaskCount} completed
                </Text>
              </Group>
              <Text size="sm" className="member-card-projects">
                Projects:{" "}
                {projects
                  .filter((project) => member.projectIds.includes(project.id))
                  .map((project) => project.name)
                  .join(", ") || "No project assignment"}
              </Text>
              <Text size="sm" c="dimmed" className="member-card-notes">{member.notes || "No notes added."}</Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <Group className="page-pagination-slot" justify="center">
        {totalPages > 1 ? <CompactPagination total={totalPages} value={page} onChange={setPage} /> : null}
      </Group>

      <MemberFormModal
        projects={projects}
        member={editingMember}
        opened={opened}
        pending={createMember.isPending || updateMember.isPending}
        onClose={() => setOpened(false)}
        onSubmit={async (values) => {
          try {
            if (editingMemberId) {
              await updateMember.mutateAsync({ id: editingMemberId, payload: values });
            } else {
              await createMember.mutateAsync(values);
            }
            setOpened(false);
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to save member",
              message: getErrorMessage(error),
            });
          }
        }}
      />
    </Stack>
  );
}
