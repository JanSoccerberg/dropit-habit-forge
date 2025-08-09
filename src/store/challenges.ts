import { create } from "zustand";
import { nanoid } from "nanoid";
import { Challenge, Participation, UserProfile, CheckIn, CheckInStatus, ChallengeRule } from "@/types";
import { todayStr, totalDays, daysElapsed, toISODate, daysBetween } from "@/utils/date";

interface State {
  user: UserProfile;
  challenges: Record<string, Challenge>;
  participations: Record<string, Participation>; // by challengeId:userId key
  checkIns: Record<string, CheckIn>; // key = challengeId:userId:date
}

interface CreateChallengeInput {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  checkInTime: string; // HH:mm
  requireScreenshot: boolean;
  stakeText?: string;
  stakeRule: ChallengeRule;
}

interface API {
  createChallenge(input: CreateChallengeInput): { id: string; joinCode: string };
  joinChallengeByCode(code: string): { id: string } | { error: string };
  findByCode(code: string): Challenge | undefined;
  checkIn(challengeId: string, status: CheckInStatus, screenshotName?: string): void;
  getUserParticipation(challengeId: string): Participation | undefined;
  getChallengeProgress(challengeId: string): { total: number; elapsed: number; percent: number };
  resetApp(): void;
  updateProfile(patch: Partial<UserProfile>): void;
}

const keyP = (challengeId: string, userId: string) => `${challengeId}:${userId}`;
const keyCI = (challengeId: string, userId: string, date: string) => `${challengeId}:${userId}:${date}`;

export const useChallengesStore = create<State & API>((set, get) => ({
  user: {
    id: "user-1",
    name: "Du",
    avatarUrl: undefined,
    locale: "de",
    pushEnabled: false,
    darkMode: true,
  },
  challenges: {},
  participations: {},
  checkIns: {},

  createChallenge: (input) => {
    const id = nanoid();
    const joinCode = nanoid(6).replace(/[-_]/g, "").slice(0, 6).toUpperCase();
    const challenge: Challenge = {
      id,
      title: input.title,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      checkInTime: input.checkInTime,
      requireScreenshot: input.requireScreenshot,
      stakeText: input.stakeText,
      stakeRule: input.stakeRule,
      joinCode,
      creatorId: get().user.id,
      createdAt: new Date().toISOString(),
    };

    const pKey = keyP(id, get().user.id);
    const participation: Participation = {
      id: nanoid(),
      challengeId: id,
      userId: get().user.id,
      joinedAt: new Date().toISOString(),
      streak: 0,
      reminders: { before1h: false },
    };

    set((s) => ({
      challenges: { ...s.challenges, [id]: challenge },
      participations: { ...s.participations, [pKey]: participation },
    }));

    return { id, joinCode };
  },

  joinChallengeByCode: (code) => {
    const c = Object.values(get().challenges).find((x) => x.joinCode === code.toUpperCase());
    if (!c) return { error: "Challenge existiert nicht" };
    const pKey = keyP(c.id, get().user.id);
    if (get().participations[pKey]) return { id: c.id };
    const participation: Participation = {
      id: nanoid(),
      challengeId: c.id,
      userId: get().user.id,
      joinedAt: new Date().toISOString(),
      streak: 0,
      reminders: { before1h: false },
    };
    set((s) => ({ participations: { ...s.participations, [pKey]: participation } }));
    return { id: c.id };
  },

  findByCode: (code) => Object.values(get().challenges).find((x) => x.joinCode === code.toUpperCase()),

  checkIn: (challengeId, status, screenshotName) => {
    const userId = get().user.id;
    const date = todayStr();
    const ciKey = keyCI(challengeId, userId, date);
    const prev = get().checkIns[ciKey];
    const checkIn: CheckIn = {
      id: prev?.id ?? nanoid(),
      challengeId,
      userId,
      date,
      status,
      screenshotName,
    };

    // update streak
    const pKey = keyP(challengeId, userId);
    const p = get().participations[pKey];
    let newStreak = p?.streak ?? 0;
    if (status === "success") newStreak = (p?.lastCheckInDate === toISODate(new Date(new Date().setDate(new Date().getDate() - 1)))) ? (newStreak + 1) : Math.max(1, newStreak + 1);
    else newStreak = 0;

    set((s) => ({
      checkIns: { ...s.checkIns, [ciKey]: checkIn },
      participations: { ...s.participations, [pKey]: { ...p, lastCheckInDate: date, streak: newStreak } as Participation },
    }));
  },

  getUserParticipation: (challengeId) => get().participations[keyP(challengeId, get().user.id)],

  getChallengeProgress: (challengeId) => {
    const c = get().challenges[challengeId];
    if (!c) return { total: 0, elapsed: 0, percent: 0 };
    const total = totalDays(c.startDate, c.endDate);
    const elapsed = Math.min(total, daysElapsed(c.startDate));
    const percent = Math.round((elapsed / Math.max(1, total)) * 100);
    return { total, elapsed, percent };
  },

  resetApp: () => set(() => ({ challenges: {}, participations: {}, checkIns: {} })),
  updateProfile: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),
}));

export type ChallengesAPI = Omit<API, "getChallengeProgress" | "getUserParticipation">;
export const api = {
  // This object mirrors calls that would be sent to a backend later
  createChallenge: (input: CreateChallengeInput) => useChallengesStore.getState().createChallenge(input),
  joinChallengeByCode: (code: string) => useChallengesStore.getState().joinChallengeByCode(code),
  findByCode: (code: string) => useChallengesStore.getState().findByCode(code),
  checkIn: (challengeId: string, status: CheckInStatus, screenshotName?: string) =>
    useChallengesStore.getState().checkIn(challengeId, status, screenshotName),
  resetApp: () => useChallengesStore.getState().resetApp(),
  updateProfile: (patch: Partial<UserProfile>) => useChallengesStore.getState().updateProfile(patch),
};
