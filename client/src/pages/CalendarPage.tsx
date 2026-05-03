import { Loader, Paper, Stack } from "@mantine/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useMediaQuery } from "@mantine/hooks";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { useCalendarEvents } from "../hooks/use-app-data";

const calendarEventColorMap = {
  todo: "#868E96",
  in_progress: "#228BE6",
  blocked: "#E03131",
} as const;

function isActiveCalendarStatus(status: string): status is keyof typeof calendarEventColorMap {
  return status in calendarEventColorMap;
}

export function CalendarPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const calendarQuery = useCalendarEvents();

  if (calendarQuery.isLoading) {
    return <Loader />;
  }

  const events = calendarQuery.data ?? [];

  return (
    <Stack gap="xl">
      <PageHeader
        title="Calendar"
        description="Visualize active task deadlines and open the linked task directly for updates."
      />
      <Paper radius="xl" p="lg" withBorder className="calendar-page-panel">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          height={isMobile ? 440 : 720}
          dayMaxEventRows={isMobile ? 1 : 3}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: isMobile ? "" : "dayGridMonth,timeGridWeek",
          }}
          events={
            /*
            Keep the calendar limited to actionable statuses and mirror each
            status with a stable color so scheduling reflects current progress.
            */
            events.flatMap((event) => {
              if (!isActiveCalendarStatus(event.status)) {
                return [];
              }

              return [{
                id: event.id,
                title: event.title,
                start: event.start ?? event.date,
                end: event.end ?? event.date,
                color: calendarEventColorMap[event.status],
              }];
            })
          }
          eventClick={(info) => {
            navigate(`/tasks/${info.event.id}`);
          }}
        />
      </Paper>
    </Stack>
  );
}
