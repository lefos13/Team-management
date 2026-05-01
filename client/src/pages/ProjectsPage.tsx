/*
Split owned and shared projects so users can distinguish master-owner control
from invited access and understand permission scope before taking actions.
*/
import { ActionIcon, Badge, Button, Card, Group, Loader, Modal, Select, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconMail, IconPlus, IconTrash } from "@tabler/icons-react";
import { projectPermissionValues, type ProjectInvitationDTO, type ProjectPermission } from "@team-management/shared";
import { useMemo, useState } from "react";

import { CompactPagination } from "../components/CompactPagination";
import { PageHeader } from "../components/PageHeader";
import { ProjectStatusBadge } from "../components/StatusBadge";
import { ProjectFormModal } from "../components/forms/ProjectFormModal";
import {
  useCreateProject,
  useDeleteProject,
  useMembers,
  useProjectDetail,
  useProjectInvitations,
  useProjects,
  useRevokeProjectInvitation,
  useSendProjectInvitation,
  useUpdateProject,
} from "../hooks/use-app-data";
import { usePagination } from "../hooks/use-pagination";
import { getErrorMessage } from "../lib/api";

export function ProjectsPage() {
  const [opened, setOpened] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [invitationProjectId, setInvitationProjectId] = useState<string | null>(null);
  const [permissionByMember, setPermissionByMember] = useState<Record<string, ProjectPermission>>({});
  const projectsQuery = useProjects();
  const membersQuery = useMembers();
  const projectDetailQuery = useProjectDetail(editingProjectId);
  const invitationsQuery = useProjectInvitations(invitationProjectId);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const sendInvitation = useSendProjectInvitation();
  const revokeInvitation = useRevokeProjectInvitation();

  const ownedProjects = projectsQuery.data?.ownedProjects ?? [];
  const sharedProjects = projectsQuery.data?.sharedProjects ?? [];

  const editableProject = useMemo(() => {
    const project = ownedProjects.find((item) => item.id === editingProjectId) ?? null;
    if (!project) {
      return null;
    }

    return {
      ...project,
      aiContext: projectDetailQuery.data?.aiContext ?? project.aiContext,
      memberIds: projectDetailQuery.data?.memberIds ?? [],
    };
  }, [editingProjectId, ownedProjects, projectDetailQuery.data?.aiContext, projectDetailQuery.data?.memberIds]);

  const members = membersQuery.data ?? [];
  const invitationProjectMembers = members.filter((member) => invitationProjectId ? member.projectIds.includes(invitationProjectId) : false);
  const invitationProject = ownedProjects.find((project) => project.id === invitationProjectId) ?? null;
  const invitationByMember = useMemo(() => {
    const map = new Map<string, ProjectInvitationDTO>();
    for (const invitation of invitationsQuery.data ?? []) {
      if (!map.has(invitation.memberId)) {
        map.set(invitation.memberId, invitation);
      }
    }
    return map;
  }, [invitationsQuery.data]);
  const { page, setPage, totalPages, paginatedItems: paginatedOwned } = usePagination(ownedProjects, 6);

  if (projectsQuery.isLoading || membersQuery.isLoading) {
    return <Loader />;
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Projects"
        description="Your owned portfolio and shared projects are separated so access context stays explicit."
        action={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditingProjectId(null);
              setOpened(true);
            }}
          >
            New project
          </Button>
        }
      />

      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={800}>My Projects (Master Owner)</Text>
          <Badge color="teal" variant="light">Full control</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} className="paginated-card-grid">
          {paginatedOwned.map((project) => {
            const memberNames = members
              .filter((member) => member.projectIds.includes(project.id))
              .map((member) => member.name)
              .slice(0, 4)
              .join(", ");

            return (
              <Card key={project.id} radius="xl" withBorder className="content-card">
                <Stack gap="md">
                  <Group justify="space-between" align="start">
                    <Stack gap={6}>
                      <Group gap="sm">
                        <div className="project-swatch" style={{ background: project.color ?? "#16A98B" }} />
                        <Text fw={800} fz="lg">{project.name}</Text>
                      </Group>
                      <Text c="dimmed">{project.description || "No description provided."}</Text>
                    </Stack>
                    <Group gap="xs">
                      <ActionIcon variant="light" onClick={() => { setEditingProjectId(project.id); setOpened(true); }}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => {
                          setInvitationProjectId(project.id);
                          setPermissionByMember({});
                        }}
                      >
                        <IconMail size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="light"
                        loading={deleteProject.isPending}
                        onClick={async () => {
                          try {
                            await deleteProject.mutateAsync(project.id);
                          } catch (error) {
                            notifications.show({ color: "red", title: "Unable to delete project", message: getErrorMessage(error) });
                          }
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>

                  <Group justify="space-between">
                    <ProjectStatusBadge status={project.status} />
                    <Text size="sm" c="dimmed">{project.taskCount} tasks · {project.memberCount} members</Text>
                  </Group>
                  <Text size="sm">Members: {memberNames || "No members assigned yet."}</Text>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
        <Group className="page-pagination-slot" justify="center">
          {totalPages > 1 ? <CompactPagination total={totalPages} value={page} onChange={setPage} /> : null}
        </Group>
      </Stack>

      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={800}>Shared With Me (Invited Member)</Text>
          <Badge color="blue" variant="light">Permission based</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} className="paginated-card-grid">
          {sharedProjects.map((project) => (
            <Card key={project.id} radius="xl" withBorder className="content-card">
              <Stack gap="md">
                <Group justify="space-between" align="start">
                  <Stack gap={6}>
                    <Group gap="sm">
                      <div className="project-swatch" style={{ background: project.color ?? "#16A98B" }} />
                      <Text fw={800} fz="lg">{project.name}</Text>
                    </Group>
                    <Text c="dimmed">{project.description || "No description provided."}</Text>
                  </Stack>
                  <Badge color="blue" variant="light">Invited: {project.permission}</Badge>
                </Group>
                <Group justify="space-between">
                  <ProjectStatusBadge status={project.status} />
                  <Text size="sm" c="dimmed">{project.taskCount} tasks · {project.memberCount} members</Text>
                </Group>
                <Text size="sm">Master Owner: {project.masterOwnerEmail}</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      <ProjectFormModal
        members={members}
        opened={opened}
        pending={createProject.isPending || updateProject.isPending || projectDetailQuery.isFetching}
        project={editableProject}
        onClose={() => setOpened(false)}
        onSubmit={async (values) => {
          try {
            if (editingProjectId) {
              await updateProject.mutateAsync({ id: editingProjectId, payload: values });
            } else {
              await createProject.mutateAsync(values);
            }
            setOpened(false);
          } catch (error) {
            notifications.show({ color: "red", title: "Unable to save project", message: getErrorMessage(error) });
          }
        }}
      />

      {/*
      Keep invitation controls scoped by project so owners can manage per-member
      access permissions, re-send invites, and revoke pending invitations.
      */}
      <Modal
        opened={Boolean(invitationProjectId)}
        onClose={() => setInvitationProjectId(null)}
        title={invitationProject ? `Manage invitations · ${invitationProject.name}` : "Manage invitations"}
        size="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Send project access invitations with explicit permissions. Members must accept using the same invited email.
          </Text>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Permission</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invitationProjectMembers.map((member) => {
                const invitation = invitationByMember.get(member.id);
                const isAccepted = Boolean(invitation?.acceptedAt);
                const isRevoked = Boolean(invitation?.revokedAt);
                const permission = permissionByMember[member.id] ?? invitation?.permission ?? "preview_own_tasks";
                const statusLabel = isAccepted ? "Accepted" : isRevoked ? "Revoked" : invitation ? "Pending" : "Not invited";
                return (
                  <Table.Tr key={member.id}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={600}>{member.name}</Text>
                        <Text size="xs" c="dimmed">{member.email}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{statusLabel}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Select
                        value={permission}
                        data={projectPermissionValues.map((value) => ({ value, label: value }))}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }
                          setPermissionByMember((current) => ({ ...current, [member.id]: value as ProjectPermission }));
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group justify="end">
                        <Button
                          size="xs"
                          loading={sendInvitation.isPending}
                          onClick={async () => {
                            if (!invitationProjectId) {
                              return;
                            }
                            try {
                              await sendInvitation.mutateAsync({ projectId: invitationProjectId, memberId: member.id, permission });
                              notifications.show({ color: "teal", title: "Invitation sent", message: `Invitation sent to ${member.email}.` });
                            } catch (error) {
                              notifications.show({ color: "red", title: "Unable to send invitation", message: getErrorMessage(error) });
                            }
                          }}
                        >
                          {invitation && !isAccepted && !isRevoked ? "Resend" : "Send"}
                        </Button>
                        {invitation && !isAccepted && !isRevoked ? (
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            loading={revokeInvitation.isPending}
                            onClick={async () => {
                              if (!invitationProjectId) {
                                return;
                              }
                              try {
                                await revokeInvitation.mutateAsync({ projectId: invitationProjectId, invitationId: invitation.id });
                                notifications.show({ color: "teal", title: "Invitation revoked", message: `${member.email} invitation was revoked.` });
                              } catch (error) {
                                notifications.show({ color: "red", title: "Unable to revoke invitation", message: getErrorMessage(error) });
                              }
                            }}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      </Modal>
    </Stack>
  );
}
