export type ChallengeRule = "per-missed-day" | "overall-fail";

export interface Challenge {
  id: string;
  title: string;
  description?: string;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  checkInTime: string; // HH:mm
  requireScreenshot: boolean;
  stakeText?: string; // free text
  stakeRule: ChallengeRule;
  joinCode: string; // 6-char code
  creatorId: string;
  createdAt: string; // ISO date-time
}

export type CheckInStatus = "success" | "fail";
export type CheckInSource = "user" | "system_cron" | "admin";

export interface CheckIn {
  id: string;
  challengeId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: CheckInStatus;
  screenshotName?: string; // placeholder only, no upload
  locked?: boolean; // true if final and cannot be changed by users
  source?: CheckInSource; // origin of the check-in
  createdAt?: string; // ISO date-time for deadline checking
}

export interface ParticipationReminders {
  before1h: boolean;
}

export interface Participation {
  id: string;
  challengeId: string;
  userId: string;
  joinedAt: string;
  streak: number;
  lastCheckInDate?: string; // YYYY-MM-DD
  reminders: ParticipationReminders;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  locale: string;
  pushEnabled: boolean;
  darkMode: boolean;
}
