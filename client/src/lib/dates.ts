import dayjs from "dayjs";

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "No date";
  }

  return dayjs(value).format("DD MMM YYYY, HH:mm");
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "No date";
  }

  return dayjs(value).format("DD MMM YYYY");
}

export function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  return dayjs(value).format("YYYY-MM-DDTHH:mm");
}

export function toIsoFromLocal(value: string): string {
  return new Date(value).toISOString();
}
