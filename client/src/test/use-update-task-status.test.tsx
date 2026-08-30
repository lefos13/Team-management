/* Exercise the cache mutation through a real QueryClient so status transitions and server reconciliation remain observable at the hook boundary. */
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { TaskDTO } from "@team-management/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUpdateTaskStatus } from "../hooks/use-app-data";
import { api } from "../lib/api";

afterEach(() => {
  vi.restoreAllMocks();
});

function task(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    title: "Target",
    description: null,
    notes: null,
    status: "todo",
    isDefect: false,
    deadline: null,
    startDate: null,
    completedAt: null,
    projectId: "project-1",
    assigneeId: null,
    assigneeIds: [],
    parentTaskId: null,
    parentTaskTitle: null,
    projectName: "Project",
    assigneeName: null,
    assigneeNames: [],
    attachments: [],
    attachmentArchive: null,
    attachmentsPreviewAvailable: true,
    canEdit: true,
    canManageAssignees: true,
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const filters = { projectId: "project-1" };
  const target = task();
  const unrelated = task({ id: "task-2", title: "Unrelated", status: "blocked" });
  queryClient.setQueryData(["tasks", filters], [target, unrelated]);
  queryClient.setQueryData(["task", target.id], target);
  return { queryClient, filters, target, unrelated };
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useUpdateTaskStatus", () => {
  it("immediately updates the matching list and detail caches while the API is pending", async () => {
    const { queryClient, filters, target } = setup();
    const alternateFilters = { projectId: "project-1", status: "todo" };
    queryClient.setQueryData(["tasks", alternateFilters], [target]);
    let resolvePatch!: (value: { data: TaskDTO }) => void;
    vi.spyOn(api, "patch").mockReturnValueOnce(new Promise((resolve) => { resolvePatch = resolve; }) as never);

    const mutation = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(queryClient) });
    const pending = mutation.result.current.mutateAsync({ id: target.id, status: "in_progress" });

    await waitFor(() => {
      expect(queryClient.getQueryData<TaskDTO[]>(["tasks", filters])?.find((item) => item.id === target.id)?.status).toBe("in_progress");
      expect(queryClient.getQueryData<TaskDTO[]>(["tasks", alternateFilters])?.find((item) => item.id === target.id)?.status).toBe("in_progress");
      expect(queryClient.getQueryData<TaskDTO>(["task", target.id])?.status).toBe("in_progress");
      expect(queryClient.isMutating({ mutationKey: ["task-status"] })).toBe(1);
    });
    resolvePatch({ data: task({ status: "in_progress" }) });
    await pending;
  });

  /*
    A status mutation for one task must not let its settled core-query refetch
    overwrite another task's still-pending optimistic status.
  */
  it("keeps another task's optimistic status during a concurrent settlement", async () => {
    const { queryClient, filters, target, unrelated } = setup();
    const taskQuery = vi.fn().mockResolvedValue([target, unrelated]);
    queryClient.setQueryDefaults(["tasks", filters], { staleTime: Infinity });
    renderHook(
      () => useQuery({ queryKey: ["tasks", filters], queryFn: taskQuery, initialData: [target, unrelated] }),
      { wrapper: wrapper(queryClient) },
    );

    let resolveFirst!: (value: { data: TaskDTO }) => void;
    let resolveSecond!: (value: { data: TaskDTO }) => void;
    vi.spyOn(api, "patch")
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }) as never)
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }) as never);

    const mutation = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(queryClient) });
    const first = mutation.result.current.mutateAsync({ id: target.id, status: "done" });
    const second = mutation.result.current.mutateAsync({ id: unrelated.id, status: "in_progress" });

    await waitFor(() => {
      expect(queryClient.getQueryData<TaskDTO[]>(["tasks", filters])).toEqual([
        { ...target, status: "done" },
        { ...unrelated, status: "in_progress" },
      ]);
    });

    resolveFirst({ data: task({ status: "done" }) });
    await first;

    expect(taskQuery).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<TaskDTO[]>(["tasks", filters])?.find((item) => item.id === unrelated.id)?.status).toBe("in_progress");

    resolveSecond({ data: task({ id: unrelated.id, status: "in_progress" }) });
    await second;
  });

  it("rolls back only the affected task and preserves an unrelated cache change after rejection", async () => {
    const { queryClient, filters, target, unrelated } = setup();
    let rejectPatch!: (error: Error) => void;
    vi.spyOn(api, "patch").mockReturnValueOnce(new Promise((_, reject) => { rejectPatch = reject; }) as never);
    const mutation = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(queryClient) });
    const pending = mutation.result.current.mutateAsync({ id: target.id, status: "done" });
    await waitFor(() => expect(queryClient.getQueryData<TaskDTO>(["task", target.id])?.status).toBe("done"));
    queryClient.setQueryData(["tasks", filters], (items: TaskDTO[] | undefined) => items?.map((item) => item.id === unrelated.id ? { ...item, title: "Changed elsewhere" } : item));
    rejectPatch(new Error("rejected"));
    await expect(pending).rejects.toThrow("rejected");
    expect(queryClient.getQueryData<TaskDTO[]>(["tasks", filters])).toEqual([target, { ...unrelated, title: "Changed elsewhere" }]);
    expect(queryClient.getQueryData<TaskDTO>(["task", target.id])).toEqual(target);
  });

  it("replaces list and detail data with the full server DTO and reconciles an active core query", async () => {
    const { queryClient, filters, target } = setup();
    const serverTask = task({ status: "done", completedAt: "2030-02-01T00:00:00.000Z", updatedAt: "2030-02-01T00:00:01.000Z" });
    let coreValue = { refreshed: false };
    renderHook(() => useQuery({ queryKey: ["dashboard"], queryFn: async () => coreValue }), { wrapper: wrapper(queryClient) });
    vi.spyOn(api, "patch").mockResolvedValueOnce({ data: serverTask } as never);
    const mutation = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(queryClient.getQueryData(["dashboard"])).toEqual({ refreshed: false }));
    coreValue = { refreshed: true };
    await mutation.result.current.mutateAsync({ id: target.id, status: "done" });
    await waitFor(() => expect(queryClient.getQueryData(["dashboard"])).toEqual({ refreshed: true }));
    expect(queryClient.getQueryData<TaskDTO[]>(["tasks", filters])?.find((item) => item.id === target.id)).toEqual(serverTask);
    expect(queryClient.getQueryData(["task", target.id])).toEqual(serverTask);
  });

  it("does not invent completedAt when moving out of done, and accepts the server clearing it", async () => {
    const { queryClient, filters, target } = setup();
    const done = task({ status: "done", completedAt: "2030-02-01T00:00:00.000Z" });
    queryClient.setQueryData(["tasks", filters], [done]);
    queryClient.setQueryData(["task", target.id], done);
    let resolvePatch!: (value: { data: TaskDTO }) => void;
    vi.spyOn(api, "patch").mockReturnValueOnce(new Promise((resolve) => { resolvePatch = resolve; }) as never);
    const mutation = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(queryClient) });
    const pending = mutation.result.current.mutateAsync({ id: target.id, status: "todo" });
    await waitFor(() => {
      expect(queryClient.getQueryData<TaskDTO[]>(["tasks", filters])?.[0].completedAt).toBe("2030-02-01T00:00:00.000Z");
      expect(queryClient.getQueryData<TaskDTO>(["task", target.id])?.completedAt).toBe("2030-02-01T00:00:00.000Z");
    });
    resolvePatch({ data: task({ status: "todo", completedAt: null }) });
    await pending;
    expect(queryClient.getQueryData<TaskDTO[]>(["tasks", filters])?.[0].completedAt).toBeNull();
    expect(queryClient.getQueryData<TaskDTO>(["task", target.id])?.completedAt).toBeNull();
  });
});
