/*
Split owned and shared projects into a visual portfolio view while keeping
permission management scoped to the selected owned project.
*/
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCalendarEvent,
  IconClipboardList,
  IconEdit,
  IconMail,
  IconPlus,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import {
  projectPermissionLabels,
  projectPermissionValues,
  type ProjectInvitationDTO,
  type ProjectPermission,
} from "@team-management/shared";
import { useMemo, useState } from "react";

import { CompactPagination } from "../components/CompactPagination";
import { ProjectStatusBadge } from "../components/StatusBadge";
import { ProjectFormModal } from "../components/forms/ProjectFormModal";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import {
  useCreateProject,
  useDeleteProject,
  useMembers,
  useProjectDetail,
  useProjectInvitations,
  useProjects,
  useRevokeProjectAccess,
  useRevokeProjectInvitation,
  useSendProjectInvitation,
  useUpdateProjectAccessPermission,
  useUpdateProject,
} from "../hooks/use-app-data";
import { usePagination } from "../hooks/use-pagination";
import { getErrorMessage } from "../lib/api";
import { formatDate } from "../lib/dates";

const avatarColors = ["teal", "grape", "blue", "orange", "gray"];

function getInitials(name: string, email?: string) {
  const source = name.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getInvitationStatusColor(status: string) {
  if (status === "Accepted") {
    return "teal";
  }
  if (status === "Pending") {
    return "yellow";
  }
  if (status === "Revoked") {
    return "red";
  }
  return "gray";
}

export function ProjectsPage() {
  const [opened, setOpened] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [invitationProjectId, setInvitationProjectId] = useState<string | null>(
    null,
  );
  const [permissionByMember, setPermissionByMember] = useState<
    Record<string, ProjectPermission>
  >({});
  const projectsQuery = useProjects();
  const membersQuery = useMembers();
  const projectDetailQuery = useProjectDetail(editingProjectId);
  const invitationsQuery = useProjectInvitations(invitationProjectId);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const sendInvitation = useSendProjectInvitation();
  const revokeInvitation = useRevokeProjectInvitation();
  const updateProjectAccessPermission = useUpdateProjectAccessPermission();
  const revokeProjectAccess = useRevokeProjectAccess();

  const ownedProjects = projectsQuery.data?.ownedProjects ?? [];
  const sharedProjects = projectsQuery.data?.sharedProjects ?? [];

  const editableProject = useMemo(() => {
    const project =
      ownedProjects.find((item) => item.id === editingProjectId) ?? null;
    if (!project) {
      return null;
    }

    return {
      ...project,
      aiContext: projectDetailQuery.data?.aiContext ?? project.aiContext,
      goLiveDate: projectDetailQuery.data?.goLiveDate ?? project.goLiveDate,
      phaseDates: projectDetailQuery.data?.phaseDates ?? project.phaseDates,
      memberIds: projectDetailQuery.data?.memberIds ?? [],
    };
  }, [
    editingProjectId,
    ownedProjects,
    projectDetailQuery.data?.aiContext,
    projectDetailQuery.data?.goLiveDate,
    projectDetailQuery.data?.phaseDates,
    projectDetailQuery.data?.memberIds,
  ]);

  const members = membersQuery.data ?? [];
  const invitationProjectMembers = members.filter((member) =>
    invitationProjectId
      ? member.projectIds.includes(invitationProjectId)
      : false,
  );
  const invitationProject =
    ownedProjects.find((project) => project.id === invitationProjectId) ?? null;
  const invitationByMember = useMemo(() => {
    const map = new Map<string, ProjectInvitationDTO>();
    for (const invitation of invitationsQuery.data ?? []) {
      if (!map.has(invitation.memberId)) {
        map.set(invitation.memberId, invitation);
      }
    }
    return map;
  }, [invitationsQuery.data]);
  const {
    page,
    setPage,
    totalPages,
    paginatedItems: paginatedOwned,
  } = usePagination(ownedProjects, 6);

  if (projectsQuery.isLoading || membersQuery.isLoading) {
    return <Loader />;
  }

  return (
    <Stack gap={34} className="projects-page">
      <Group
        justify="space-between"
        align="start"
        className="projects-page-header"
      >
        <Stack gap={6}>
          <Title order={1} className="projects-page-title">
            Projects
          </Title>
          <Text className="projects-page-description">
            Owned portfolio projects and shared projects are separated for clear
            access context.
          </Text>
        </Stack>
        <div className="projects-page-action">
          <Button
            className="projects-new-button"
            leftSection={<IconPlus size={20} />}
            onClick={() => {
              setEditingProjectId(null);
              setOpened(true);
            }}
          >
            New project
          </Button>
        </div>
      </Group>

      <Divider className="projects-section-divider" />

      <Stack gap={18} className="projects-section">
        <Group gap="sm" align="center">
          <Title order={2} className="projects-section-title">
            My Projects (Master Owner)
          </Title>
          <Badge color="teal" variant="light">
            Full control
          </Badge>
        </Group>
        <SimpleGrid
          cols={{ base: 1, sm: 2, lg: 3, xl: 4 }}
          className="paginated-card-grid projects-card-grid"
        >
          {paginatedOwned.map((project) => {
            const projectMembers = members.filter((member) =>
              member.projectIds.includes(project.id),
            );
            const visibleMembers = projectMembers.slice(0, 3);
            const hiddenMemberCount = Math.max(
              project.memberCount - visibleMembers.length,
              0,
            );

            return (
              <Card
                key={project.id}
                withBorder
                className="content-card projects-card projects-owned-card"
              >
                <Stack gap={14} className="projects-card-body">
                  <Group gap="sm" align="center" wrap="nowrap">
                    <div
                      className="project-swatch projects-card-swatch"
                      style={{ background: project.color ?? "#16A98B" }}
                    />
                    <Text fw={800} className="projects-card-title">
                      {project.name}
                    </Text>
                  </Group>
                  <Text className="projects-card-description">
                    {project.description || "No description provided."}
                  </Text>
                  <Stack gap={20} mt="auto">
                    <ProjectStatusBadge status={project.status} />
                    {project.goLiveDate || project.phaseDates.length > 0 ? (
                      <Stack gap={6} className="projects-card-markers">
                        {project.goLiveDate ? (
                          <Group gap={8} wrap="nowrap">
                            <IconCalendarEvent size={17} />
                            <Text>Go-live {formatDate(project.goLiveDate)}</Text>
                          </Group>
                        ) : null}
                        {project.phaseDates[0] ? (
                          <Group gap={8} wrap="nowrap">
                            <IconCalendarEvent size={17} />
                            <Text>{project.phaseDates[0].name} {formatDate(project.phaseDates[0].date)}</Text>
                          </Group>
                        ) : null}
                      </Stack>
                    ) : null}
                    <Group gap={26} className="projects-card-metrics">
                      <Group gap={8} wrap="nowrap">
                        <IconClipboardList size={19} />
                        <Text>{project.taskCount} tasks</Text>
                      </Group>
                      <Group gap={8} wrap="nowrap">
                        <IconUsers size={20} />
                        <Text>{project.memberCount} members</Text>
                      </Group>
                    </Group>
                  </Stack>
                </Stack>
                <Group justify="space-between" className="projects-card-footer">
                  <Avatar.Group spacing="xs">
                    {visibleMembers.map((member, index) => (
                      <Avatar
                        key={member.id}
                        size={32}
                        color={avatarColors[index % avatarColors.length]}
                        radius="xl"
                      >
                        {getInitials(member.name, member.email)}
                      </Avatar>
                    ))}
                    {hiddenMemberCount > 0 ? (
                      <Avatar size={32} color="gray" radius="xl">
                        +{hiddenMemberCount}
                      </Avatar>
                    ) : null}
                  </Avatar.Group>
                  <Group gap={16} className="projects-card-actions">
                    <Tooltip label="Edit project" withArrow openDelay={300}>
                      <ActionIcon
                        variant="subtle"
                        color="dark"
                        aria-label={`Edit ${project.name}`}
                        onClick={() => {
                          setEditingProjectId(project.id);
                          setOpened(true);
                        }}
                      >
                        <IconEdit size={24} stroke={1.8} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Manage invitations" withArrow openDelay={300}>
                      <ActionIcon
                        variant="subtle"
                        color="dark"
                        aria-label={`Manage invitations for ${project.name}`}
                        onClick={() => {
                          setInvitationProjectId(project.id);
                          setPermissionByMember({});
                        }}
                      >
                        <IconMail size={25} stroke={1.8} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete project" withArrow openDelay={300}>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                      >
                        <IconTrash size={24} stroke={1.8} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
        <Group className="page-pagination-slot" justify="center">
          {totalPages > 1 ? (
            <CompactPagination
              total={totalPages}
              value={page}
              onChange={setPage}
            />
          ) : null}
        </Group>
      </Stack>

      <Divider className="projects-section-divider" />

      <Stack gap={18} className="projects-section">
        <Group gap="sm" align="center">
          <Title order={2} className="projects-section-title">
            Shared With Me (Invited Member)
          </Title>
          <Badge color="blue" variant="light">
            Permission based
          </Badge>
        </Group>
        <SimpleGrid
          cols={{ base: 1, sm: 2, lg: 3, xl: 4 }}
          className="paginated-card-grid projects-card-grid"
        >
          {sharedProjects.map((project) => (
            <Card
              key={project.id}
              withBorder
              className="content-card projects-card projects-shared-card"
            >
              <Stack gap={14} className="projects-card-body">
                <Group gap="sm" align="center" wrap="nowrap">
                  <div
                    className="project-swatch projects-card-swatch"
                    style={{ background: project.color ?? "#16A98B" }}
                  />
                  <Text fw={800} className="projects-card-title">
                    {project.name}
                  </Text>
                </Group>
                <Text className="projects-card-description">
                  {project.description || "No description provided."}
                </Text>
                <Stack gap={20} mt="auto">
                  <ProjectStatusBadge status={project.status} />
                  {project.goLiveDate || project.phaseDates.length > 0 ? (
                    <Stack gap={6} className="projects-card-markers">
                      {project.goLiveDate ? (
                        <Group gap={8} wrap="nowrap">
                          <IconCalendarEvent size={17} />
                          <Text>Go-live {formatDate(project.goLiveDate)}</Text>
                        </Group>
                      ) : null}
                      {project.phaseDates[0] ? (
                        <Group gap={8} wrap="nowrap">
                          <IconCalendarEvent size={17} />
                          <Text>{project.phaseDates[0].name} {formatDate(project.phaseDates[0].date)}</Text>
                        </Group>
                      ) : null}
                    </Stack>
                  ) : null}
                  <Group gap={26} className="projects-card-metrics">
                    <Group gap={8} wrap="nowrap">
                      <IconClipboardList size={19} />
                      <Text>{project.taskCount} tasks</Text>
                    </Group>
                    <Group gap={8} wrap="nowrap">
                      <IconUsers size={20} />
                      <Text>{project.memberCount} members</Text>
                    </Group>
                  </Group>
                </Stack>
              </Stack>
              <Stack gap={8} className="projects-shared-footer">
                <Group
                  justify="space-between"
                  gap="sm"
                  wrap="nowrap"
                  className="projects-shared-permission-row"
                >
                  <Text>Your permission</Text>
                  <Badge
                    color="blue"
                    variant="filled"
                    className="projects-shared-permission-badge"
                  >
                    {projectPermissionLabels[project.permission]}
                  </Badge>
                </Group>
                <Stack gap={2}>
                  <Text>Master Owner</Text>
                  <Text fw={700}>{project.masterOwnerEmail}</Text>
                </Stack>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      <ProjectFormModal
        members={members}
        opened={opened}
        pending={
          createProject.isPending ||
          updateProject.isPending ||
          projectDetailQuery.isFetching
        }
        project={editableProject}
        onClose={() => setOpened(false)}
        onSubmit={async (values) => {
          try {
            if (editingProjectId) {
              await updateProject.mutateAsync({
                id: editingProjectId,
                payload: values,
              });
            } else {
              await createProject.mutateAsync(values);
            }
            setOpened(false);
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to save project",
              message: getErrorMessage(error),
            });
          }
        }}
      />

      {/*
      Keep invitation controls scoped by project so owners can review each
      member, change the explicit permission, and trigger the correct invite or
      revoke mutation from one table.
      */}
      <Modal
        opened={Boolean(invitationProjectId)}
        onClose={() => setInvitationProjectId(null)}
        title="Manage invitations"
        size={1180}
        centered
        classNames={{
          content: "projects-invitations-modal",
          header: "projects-invitations-modal-header",
          title: "projects-invitations-modal-title",
          body: "projects-invitations-modal-body",
          close: "projects-invitations-modal-close",
        }}
      >
        <Stack gap={24}>
          <Text className="projects-modal-description">
            Project access invitations can be sent with explicit permissions and
            managed here.
          </Text>
          <Text className="projects-modal-project">
            Project:{" "}
            <span>{invitationProject?.name ?? "Selected project"}</span>
          </Text>
          <div className="projects-invitations-table-shell">
            <Table verticalSpacing={0} className="projects-invitations-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Permission</Table.Th>
                  <Table.Th className="projects-invitations-actions-heading">
                    Actions
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invitationProjectMembers.map((member, index) => {
                  const invitation = invitationByMember.get(member.id);
                  const isAccessRevoked =
                    invitation?.accessStatus === "revoked";
                  const isAccepted = Boolean(
                    invitation?.acceptedAt &&
                    invitation?.accessStatus === "active",
                  );
                  const isRevoked = Boolean(invitation?.revokedAt);
                  const permission =
                    permissionByMember[member.id] ??
                    invitation?.permission ??
                    "preview_own_tasks";
                  const statusLabel = isAccepted
                    ? "Accepted"
                    : isAccessRevoked || isRevoked
                      ? "Revoked"
                      : invitation
                        ? "Pending"
                        : "Not invited";
                  return (
                    <Table.Tr key={member.id}>
                      <Table.Td>
                        <Group gap={12} wrap="nowrap">
                          <Avatar
                            size={40}
                            color={avatarColors[index % avatarColors.length]}
                            radius="xl"
                          >
                            {getInitials(member.name, member.email)}
                          </Avatar>
                          <Stack gap={2} className="projects-member-cell">
                            <Text fw={700}>{member.name}</Text>
                            <Text>{member.email}</Text>
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getInvitationStatusColor(statusLabel)}
                          variant="light"
                          className="projects-invitation-status"
                        >
                          {statusLabel}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Select
                          className="projects-permission-select"
                          value={permission}
                          data={projectPermissionValues.map((value) => ({
                            value,
                            label: projectPermissionLabels[value],
                          }))}
                          onChange={(value) => {
                            if (!value) {
                              return;
                            }
                            setPermissionByMember((current) => ({
                              ...current,
                              [member.id]: value as ProjectPermission,
                            }));
                          }}
                        />
                      </Table.Td>
                      <Table.Td className="projects-invitations-actions-cell">
                        <Group
                          justify="end"
                          gap={8}
                          wrap="wrap"
                          className="projects-invitations-actions"
                        >
                          <Button
                            className="projects-permission-action"
                            variant="outline"
                            color={isAccepted ? "teal" : "blue"}
                            loading={
                              sendInvitation.isPending ||
                              updateProjectAccessPermission.isPending
                            }
                            onClick={async () => {
                              if (!invitationProjectId) {
                                return;
                              }
                              try {
                                if (isAccepted && invitation?.accessId) {
                                  await updateProjectAccessPermission.mutateAsync(
                                    {
                                      projectId: invitationProjectId,
                                      accessId: invitation.accessId,
                                      permission,
                                    },
                                  );
                                  notifications.show({
                                    color: "teal",
                                    title: "Permission updated",
                                    message: `${member.email} access was updated.`,
                                  });
                                  return;
                                }

                                await sendInvitation.mutateAsync({
                                  projectId: invitationProjectId,
                                  memberId: member.id,
                                  permission,
                                });
                                notifications.show({
                                  color: "teal",
                                  title: "Invitation sent",
                                  message: `Invitation sent to ${member.email}.`,
                                });
                              } catch (error) {
                                notifications.show({
                                  color: "red",
                                  title: "Unable to update access",
                                  message: getErrorMessage(error),
                                });
                              }
                            }}
                          >
                            {isAccepted
                              ? "Update permission"
                              : invitation && !isRevoked && !isAccessRevoked
                                ? "Resend"
                                : "Send"}
                          </Button>
                          {isAccepted && invitation?.accessId ? (
                            <Button
                              className="projects-permission-action"
                              variant="outline"
                              color="red"
                              loading={revokeProjectAccess.isPending}
                              onClick={async () => {
                                if (
                                  !invitationProjectId ||
                                  !invitation.accessId
                                ) {
                                  return;
                                }
                                try {
                                  await revokeProjectAccess.mutateAsync({
                                    projectId: invitationProjectId,
                                    accessId: invitation.accessId,
                                  });
                                  notifications.show({
                                    color: "teal",
                                    title: "Access revoked",
                                    message: `${member.email} access was revoked.`,
                                  });
                                } catch (error) {
                                  notifications.show({
                                    color: "red",
                                    title: "Unable to revoke access",
                                    message: getErrorMessage(error),
                                  });
                                }
                              }}
                            >
                              Revoke access
                            </Button>
                          ) : invitation &&
                            !isAccepted &&
                            !isRevoked &&
                            !isAccessRevoked ? (
                            <Button
                              className="projects-permission-action"
                              variant="outline"
                              color="red"
                              loading={revokeInvitation.isPending}
                              onClick={async () => {
                                if (!invitationProjectId) {
                                  return;
                                }
                                try {
                                  await revokeInvitation.mutateAsync({
                                    projectId: invitationProjectId,
                                    invitationId: invitation.id,
                                  });
                                  notifications.show({
                                    color: "teal",
                                    title: "Invitation revoked",
                                    message: `${member.email} invitation was revoked.`,
                                  });
                                } catch (error) {
                                  notifications.show({
                                    color: "red",
                                    title: "Unable to revoke invitation",
                                    message: getErrorMessage(error),
                                  });
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
          </div>
          <Group justify="end">
            <Button
              variant="default"
              className="projects-modal-close-button"
              onClick={() => setInvitationProjectId(null)}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
      <ConfirmDeleteModal
        opened={deleteTarget !== null}
        itemName={deleteTarget?.name ?? ""}
        itemType="project"
        loading={deleteProject.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void (async () => {
            try {
              await deleteProject.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            } catch (error) {
              notifications.show({
                color: "red",
                title: "Unable to delete project",
                message: getErrorMessage(error),
              });
            }
          })();
        }}
      />
    </Stack>
  );
}
