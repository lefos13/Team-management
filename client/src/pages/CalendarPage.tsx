import { Loader, Paper, Stack } from "@mantine/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { useCalendarEvents } from "../hooks/use-app-data";

export function CalendarPage() {
  const navigate = useNavigate();
  const calendarQuery = useCalendarEvents();

  if (calendarQuery.isLoading) {
    return <Loader />;
  }

  const events = calendarQuery.data ?? [];

  return (
    <Stack gap="xl">
      <PageHeader
        title="Calendar"
        description="Visualize task deadlines and open the linked task directly for updates."
      />
      <Paper radius="xl" p="lg" withBorder>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          height={720}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek",
          }}
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            start: event.start ?? event.date,
            end: event.end ?? event.date,
            color: event.overdue ? "#D9480F" : "#0B7285",
          }))}
          eventClick={(info) => {
            navigate(`/tasks?taskId=${info.event.id}`);
          }}
        />
      </Paper>
    </Stack>
  );
}
