import type {
  CalendarEventDTO,
  DashboardDTO,
  DashboardFilters,
  MemberDeleteResultDTO,
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
  TeamMemberDTO,
} from "@team-management/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskDTO["status"] }) => {
      const response = await api.patch<TaskDTO>(`/tasks/${id}/status`, { status });
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await invalidateCoreQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
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
