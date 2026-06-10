import {
  timelineCheckInHref,
  timelineMeasurementHref,
  type TimelineCheckIn,
  type TimelineMeasurementSnapshot,
  type TimelineWeek,
} from "@/lib/progress-timeline";

export interface TimelineLinks {
  checkInHref: (checkIn: TimelineCheckIn) => string;
  measurementHref: (measurement: TimelineMeasurementSnapshot) => string;
  photosHref: string;
  habitsHref: string;
  emptyCheckInHref: string;
  emptyMeasurementsHref: string;
  emptyPhotosHref: string;
  weekPrimaryHref: (week: TimelineWeek) => string | null;
}

export const CLIENT_TIMELINE_LINKS: TimelineLinks = {
  checkInHref: timelineCheckInHref,
  measurementHref: timelineMeasurementHref,
  photosHref: "/client/progress-photos",
  habitsHref: "/client/habits",
  emptyCheckInHref: "/client/check-in/new",
  emptyMeasurementsHref: "/client/measurements",
  emptyPhotosHref: "/client/progress-photos",
  weekPrimaryHref(week) {
    if (week.checkIn) return timelineCheckInHref(week.checkIn);
    if (week.measurement) return timelineMeasurementHref(week.measurement);
    if (week.photos.length > 0) return "/client/progress-photos";
    if (week.habits) return "/client/habits";
    return null;
  },
};

export function coachTimelineLinks(clientId: string): TimelineLinks {
  const base = `/coach/clients/${clientId}`;
  return {
    checkInHref(checkIn) {
      if (checkIn.responseId) return `${base}/responses/${checkIn.responseId}`;
      return base;
    },
    measurementHref() {
      return `${base}/progress#measurement-trends`;
    },
    photosHref: `/coach/gallery?client=${clientId}`,
    habitsHref: `${base}/habits`,
    emptyCheckInHref: base,
    emptyMeasurementsHref: `${base}/progress#measurement-trends`,
    emptyPhotosHref: `/coach/gallery?client=${clientId}`,
    weekPrimaryHref(week) {
      if (week.checkIn) {
        if (week.checkIn.responseId) return `${base}/responses/${week.checkIn.responseId}`;
        return base;
      }
      if (week.measurement) return `${base}/progress#measurement-trends`;
      if (week.photos.length > 0) return `/coach/gallery?client=${clientId}`;
      if (week.habits) return `${base}/habits`;
      return null;
    },
  };
}
