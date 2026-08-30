import type {
  AdminLoginInput,
  AdminOverviewDTO,
  AdminPaginationQuery,
  AdminSessionDTO,
  CalendarEventDTO,
  DashboardDTO,
  DashboardFilters,
  MemberDeleteResultDTO,
  PaginatedAdminAccessDTO,
  PaginatedAdminMembersDTO,
  PaginatedAdminProjectsDTO,
  PaginatedAdminTasksDTO,
  PaginatedAdminUsersDTO,
  MemberInput,
  ProjectDetailDTO,
  ProjectInvitationDTO,
  ProjectInput,
  ProjectListDTO,
  ProjectPermission,
  ProjectSummaryDTO,
  TaskAttachmentDTO,
  TaskDTO,
  TaskExportFilters,
  TaskFilters,
  TaskImportResultDTO,
  TaskImportTemplateVariant,
  TaskInput,
  TaskShareLinkDTO,
  TeamMemberDTO,
} from "@team-management/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

/*
Keep backoffice state separate from the normal workspace cache so unlocking the
admin area does not disturb the signed-in user queries or route behavior.
*/
export function useAdminSession() {
  return useQuery({
    queryKey: ["admin-session"],
    retry: false,
    queryFn: async () => {
      const response = await api.get<AdminSessionDTO>("/admin/session");
      return response.data;
    },
  });
}

function invalidateAdminQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-session"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-projects"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-members"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-access"] }),
  ]);
}

export function useCreateAdminSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminLoginInput) => {
      const response = await api.post<AdminSessionDTO>("/admin/session", payload);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateAdminQueries(queryClient);
    },
  });
}

export function useDeleteAdminSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.delete("/admin/session");
    },
    onSuccess: async () => {
      await invalidateAdminQueries(queryClient);
    },
  });
}

export function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-overview"],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<AdminOverviewDTO>("/admin/overview");
      return response.data;
    },
  });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-users", enabled],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminUsersDTO>("/admin/users");
      return response.data;
    },
  });
}

export function useAdminUsersPage(enabled: boolean, pagination: AdminPaginationQuery) {
  return useQuery({
    queryKey: ["admin-users", pagination],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminUsersDTO>("/admin/users", { params: pagination });
      return response.data;
    },
  });
}

export function useAdminProjects(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-projects", enabled],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminProjectsDTO>("/admin/projects");
      return response.data;
    },
  });
}

export function useAdminProjectsPage(enabled: boolean, pagination: AdminPaginationQuery) {
  return useQuery({
    queryKey: ["admin-projects", pagination],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminProjectsDTO>("/admin/projects", { params: pagination });
      return response.data;
    },
  });
}

export function useAdminMembers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-members", enabled],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminMembersDTO>("/admin/members");
      return response.data;
    },
  });
}

export function useAdminMembersPage(enabled: boolean, pagination: AdminPaginationQuery) {
  return useQuery({
    queryKey: ["admin-members", pagination],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminMembersDTO>("/admin/members", { params: pagination });
      return response.data;
    },
  });
}

export function useAdminTasks(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-tasks", enabled],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminTasksDTO>("/admin/tasks");
      return response.data;
    },
  });
}

export function useAdminTasksPage(enabled: boolean, pagination: AdminPaginationQuery) {
  return useQuery({
    queryKey: ["admin-tasks", pagination],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminTasksDTO>("/admin/tasks", { params: pagination });
      return response.data;
    },
  });
}

export function useAdminAccess(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-access", enabled],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminAccessDTO>("/admin/access");
      return response.data;
    },
  });
}

export function useAdminAccessPage(enabled: boolean, pagination: AdminPaginationQuery) {
  return useQuery({
    queryKey: ["admin-access", pagination],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await api.get<PaginatedAdminAccessDTO>("/admin/access", { params: pagination });
      return response.data;
    },
  });
}

export function useDashboard(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: async () => {
      const response = await api.get<DashboardDTO>("/dashboard", { params: filters });
      return response.data;
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await api.get<ProjectListDTO>("/projects");
      return response.data;
    },
  });
}

export function useProjectDetail(projectId: string | null) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await api.get<ProjectDetailDTO>(`/projects/${projectId}`);
      return response.data;
    },
  });
}

export function useProjectInvitations(projectId: string | null) {
  return useQuery({
    queryKey: ["project-invitations", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await api.get<ProjectInvitationDTO[]>(`/projects/${projectId}/invitations`);
      return response.data;
    },
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const response = await api.get<TeamMemberDTO[]>("/members");
      return response.data;
    },
  });
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      const response = await api.get<TaskDTO[]>("/tasks", { params: filters });
      return response.data;
    },
  });
}

export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: ["task", taskId],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const response = await api.get<TaskDTO>(`/tasks/${taskId}`);
      return response.data;
    },
  });
}

export function useTaskSharePreview(token: string | null) {
  return useQuery({
    queryKey: ["task-share-preview", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const response = await api.get<TaskDTO>(`/task-shares/${token}`);
      return response.data;
    },
  });
}

export async function exportTasks(filters: TaskExportFilters) {
  const response = await api.get<Blob>("/tasks/export", {
    params: filters,
    responseType: "blob",
  });
  return response.data;
}

export async function downloadTaskImportTemplate(projectId: string, variant: TaskImportTemplateVariant) {
  const response = await api.get<Blob>(`/projects/${projectId}/tasks/import-template`, {
    params: { variant },
    responseType: "blob",
  });
  return response.data;
}

export function useImportTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post<TaskImportResultDTO>(`/projects/${projectId}/tasks/import`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const response = await api.get<CalendarEventDTO[]>("/calendar/events");
      return response.data;
    },
  });
}

function invalidateCoreQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["members"] }),
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
  ]);
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProjectInput) => {
      const response = await api.post<ProjectSummaryDTO>("/projects", payload);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ProjectInput }) => {
      const response = await api.put<ProjectSummaryDTO>(`/projects/${id}`, payload);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await invalidateCoreQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["project", variables.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useSendProjectInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, memberId, permission }: { projectId: string; memberId: string; permission: ProjectPermission }) => {
      const response = await api.post<ProjectInvitationDTO>(`/projects/${projectId}/invitations`, { memberId, permission });
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["project-invitations", variables.projectId] });
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useRevokeProjectInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, invitationId }: { projectId: string; invitationId: string }) => {
      const response = await api.post<ProjectInvitationDTO>(`/projects/${projectId}/invitations/${invitationId}/revoke`);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["project-invitations", variables.projectId] });
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useUpdateProjectAccessPermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, accessId, permission }: { projectId: string; accessId: string; permission: ProjectPermission }) => {
      await api.patch(`/projects/${projectId}/access/${accessId}/permission`, { permission });
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["project-invitations", variables.projectId] });
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useRevokeProjectAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, accessId }: { projectId: string; accessId: string }) => {
      await api.post(`/projects/${projectId}/access/${accessId}/revoke`);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["project-invitations", variables.projectId] });
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MemberInput) => {
      const response = await api.post<TeamMemberDTO>("/members", payload);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: MemberInput }) => {
      const response = await api.put<TeamMemberDTO>(`/members/${id}`, payload);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<MemberDeleteResultDTO>(`/members/${id}`);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TaskInput) => {
      const response = await api.post<TaskDTO>("/tasks", payload);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TaskInput }) => {
      const response = await api.put<TaskDTO>(`/tasks/${id}`, payload);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await invalidateCoreQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
    },
  });
}

export function useUpdateTaskStatus() {
  /*
  Keep status moves responsive while preserving the full TaskDTO contract: cancel
  matching reads, change only status in every cached task view, and let the
  server response and settled refetch provide cascades, timestamps, and
  attachment state. Pattern source:
  https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates#via-the-cache
  */
  return useMutation({
    mutationKey: ["task-status"],
    mutationFn: async ({ id, status }: { id: string; status: TaskDTO["status"] }) => {
      const response = await api.patch<TaskDTO>(`/tasks/${id}/status`, { status });
      return response.data;
    },
    onMutate: async (variables, context) => {
      const taskListKey = ["tasks"];
      const taskDetailKey = ["task", variables.id] as const;

      await Promise.all([
        context.client.cancelQueries({ queryKey: taskListKey }),
        context.client.cancelQueries({ queryKey: taskDetailKey, exact: true }),
      ]);

      const listSnapshots = context.client
        .getQueriesData<TaskDTO[]>({ queryKey: taskListKey })
        .flatMap(([queryKey, tasks]) => {
          const previousTask = tasks?.find((task) => task.id === variables.id);
          return previousTask ? [{ queryKey, previousStatus: previousTask.status }] : [];
        });
      const previousDetail = context.client.getQueryData<TaskDTO>(taskDetailKey);

      context.client.setQueriesData<TaskDTO[]>({ queryKey: taskListKey }, (tasks) => {
        if (!tasks) {
          return tasks;
        }

        return tasks.map((task) => (task.id === variables.id ? { ...task, status: variables.status } : task));
      });

      if (previousDetail) {
        context.client.setQueryData<TaskDTO>(taskDetailKey, (task) =>
          task ? { ...task, status: variables.status } : task,
        );
      }

      return {
        listSnapshots,
        previousDetailStatus: previousDetail?.status,
      };
    },
    onError: (_error, variables, rollback, context) => {
      if (!rollback) {
        return;
      }

      for (const { queryKey, previousStatus } of rollback.listSnapshots) {
        context.client.setQueryData<TaskDTO[]>(queryKey, (tasks) => {
          if (!tasks) {
            return tasks;
          }

          return tasks.map((task) =>
            task.id === variables.id && task.status === variables.status
              ? { ...task, status: previousStatus }
              : task,
          );
        });
      }

      const previousDetailStatus = rollback.previousDetailStatus;
      if (previousDetailStatus !== undefined) {
        const taskDetailKey = ["task", variables.id] as const;
        context.client.setQueryData<TaskDTO>(taskDetailKey, (task) =>
          task && task.status === variables.status ? { ...task, status: previousDetailStatus } : task,
        );
      }
    },
    onSuccess: (serverTask, _variables, _rollback, context) => {
      context.client.setQueriesData<TaskDTO[]>({ queryKey: ["tasks"] }, (tasks) => {
        if (!tasks) {
          return tasks;
        }

        return tasks.map((task) => (task.id === serverTask.id ? serverTask : task));
      });
      context.client.setQueriesData<TaskDTO>(
        { queryKey: ["task", serverTask.id], exact: true },
        (task) => (task ? serverTask : task),
      );
    },
    onSettled: async (_data, _error, variables, _rollback, context) => {
      await Promise.all([
        invalidateCoreQueries(context.client),
        context.client.invalidateQueries({ queryKey: ["task", variables.id], exact: true }),
      ]);
    },
  });
}

export function useCreateTaskShareLink() {
  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post<TaskShareLinkDTO>(`/tasks/${taskId}/share-links`);
      return response.data;
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
    },
  });
}

export async function downloadTaskAttachment(taskId: string, attachmentId: string) {
  const response = await api.get<Blob>(`/tasks/${taskId}/attachments/${attachmentId}/download`, {
    responseType: "blob",
  });
  return response.data;
}

export async function previewTaskAttachment(taskId: string, attachmentId: string) {
  const response = await api.get<Blob>(`/tasks/${taskId}/attachments/${attachmentId}/preview`, {
    responseType: "blob",
  });
  return response.data;
}

export async function previewSharedTaskAttachment(token: string, attachmentId: string) {
  const response = await api.get<Blob>(`/task-shares/${token}/attachments/${attachmentId}/preview`, {
    responseType: "blob",
  });
  return response.data;
}

export async function downloadTaskAttachmentArchive(taskId: string) {
  const response = await api.get<Blob>(`/tasks/${taskId}/attachments/archive`, {
    responseType: "blob",
  });
  return response.data;
}

export function useUploadTaskAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, files }: { taskId: string; files: File[] }) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("file", file);
      }

      const response = await api.post<TaskDTO>(`/tasks/${taskId}/attachments`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await invalidateCoreQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

export function useDeleteTaskAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, attachmentId }: { taskId: string; attachmentId: string }) => {
      const response = await api.delete<TaskDTO>(`/tasks/${taskId}/attachments/${attachmentId}`);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await invalidateCoreQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

export function countTaskPreviewableAttachments(attachments: TaskAttachmentDTO[]) {
  return attachments.filter((attachment) => attachment.isImage || attachment.mimeType === "application/pdf" || attachment.mimeType.startsWith("text/")).length;
}
