import { ActionIcon, Button, Card, Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { ProjectStatusBadge } from "../components/StatusBadge";
import { ProjectFormModal } from "../components/forms/ProjectFormModal";
import {
  useCreateProject,
  useDeleteProject,
  useMembers,
  useProjectDetail,
  useProjects,
  useUpdateProject,
} from "../hooks/use-app-data";
import { getErrorMessage } from "../lib/api";

export function ProjectsPage() {
  const [opened, setOpened] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const projectsQuery = useProjects();
  const membersQuery = useMembers();
  const projectDetailQuery = useProjectDetail(editingProjectId);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const editableProject = useMemo(() => {
    const project = projectsQuery.data?.find((item) => item.id === editingProjectId) ?? null;
    if (!project) {
      return null;
    }

    return {
      ...project,
      memberIds: projectDetailQuery.data?.memberIds ?? [],
    };
  }, [editingProjectId, projectDetailQuery.data?.memberIds, projectsQuery.data]);

  if (projectsQuery.isLoading || membersQuery.isLoading) {
    return <Loader />;
  }

  const projects = projectsQuery.data ?? [];
  const members = membersQuery.data ?? [];

  return (
    <Stack gap="xl">
      <PageHeader
        title="Projects"
        description="Track the active portfolio, project memberships, and the amount of work tied to each initiative."
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

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {projects.map((project) => {
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
                    <ActionIcon
                      variant="light"
                      onClick={() => {
                        setEditingProjectId(project.id);
                        setOpened(true);
                      }}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="light"
                      loading={deleteProject.isPending}
                      onClick={async () => {
                        try {
                          await deleteProject.mutateAsync(project.id);
                        } catch (error) {
                          notifications.show({
                            color: "red",
                            title: "Unable to delete project",
                            message: getErrorMessage(error),
                          });
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
            notifications.show({
              color: "red",
              title: "Unable to save project",
              message: getErrorMessage(error),
            });
          }
        }}
      />
    </Stack>
  );
}
