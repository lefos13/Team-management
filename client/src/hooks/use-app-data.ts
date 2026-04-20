import type {
  CalendarEventDTO,
  DashboardDTO,
  MemberInput,
  ProjectDetailDTO,
  ProjectInput,
  ProjectSummaryDTO,
  TaskDTO,
  TaskFilters,
  TaskInput,
  TeamMemberDTO,
} from "@team-management/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await api.get<DashboardDTO>("/dashboard");
      return response.data;
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await api.get<ProjectSummaryDTO[]>("/projects");
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

export function useArchiveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<TeamMemberDTO>(`/members/${id}`);
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
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
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
    onSuccess: async () => {
      await invalidateCoreQueries(queryClient);
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
