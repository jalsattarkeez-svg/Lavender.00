import { create } from 'zustand';
import type { StudySession, SessionEvent, EventType, DistractionReason } from '@/types/database';
import {
  fetchActiveSessionWithEvents,
  createStudySession,
  createSessionEvent,
  closeSessionEvent,
  endStudySession,
  cancelStudySession,
} from '@/lib/api';

export type StudyState = 'study' | 'distraction' | 'break' | 'idle';

interface StudyStore {
  session: StudySession | null;
  events: SessionEvent[];
  currentEvent: SessionEvent | null;
  currentState: StudyState;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  startSession: (params: {
    learning_path_id: string | null;
    subject_id: string | null;
    lesson_id: string | null;
    session_type: import('@/types/database').SessionType;
  }) => Promise<void>;
  transitionTo: (newState: EventType, reason?: DistractionReason | null) => Promise<void>;
  endSession: (note?: string | null) => Promise<StudySession | null>;
  cancelSession: () => Promise<void>;
  clearSession: () => void;
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  session: null,
  events: [],
  currentEvent: null,
  currentState: 'idle',
  loading: false,
  error: null,

  init: async () => {
    set({ loading: true });
    try {
      const result = await fetchActiveSessionWithEvents();
      if (result) {
        const { session, events } = result;
        const lastEvent = events.length > 0 ? events[events.length - 1] : null;
        const currentState: StudyState = lastEvent
          ? (lastEvent.event_type as StudyState)
          : 'study';
        set({ session, events, currentEvent: lastEvent, currentState });
      } else {
        set({ session: null, events: [], currentEvent: null, currentState: 'idle' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load session' });
    } finally {
      set({ loading: false });
    }
  },

  startSession: async (params) => {
    set({ loading: true, error: null });
    try {
      const session = await createStudySession(params);
      const event = await createSessionEvent({
        study_session_id: session.id,
        event_type: 'study',
      });
      set({
        session,
        events: [event],
        currentEvent: event,
        currentState: 'study',
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start session' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  transitionTo: async (newState: EventType, reason?: DistractionReason | null) => {
    const state = get();
    if (!state.session || !state.currentEvent) return;
    if (state.currentState === newState) return;

    set({ loading: true, error: null });
    try {
      // Close current event
      const closedEvent = await closeSessionEvent(state.currentEvent.id);
      const updatedEvents = state.events.map((e) =>
        e.id === closedEvent.id ? closedEvent : e
      );

      // Create new event
      const newEvent = await createSessionEvent({
        study_session_id: state.session.id,
        event_type: newState,
        reason: newState === 'distraction' ? (reason ?? null) : null,
      });

      set({
        events: [...updatedEvents, newEvent],
        currentEvent: newEvent,
        currentState: newState as StudyState,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to transition' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  endSession: async (note?: string | null) => {
    const state = get();
    if (!state.session) return null;

    set({ loading: true, error: null });
    try {
      const completed = await endStudySession(state.session.id, note);
      set({
        session: null,
        events: [],
        currentEvent: null,
        currentState: 'idle',
      });
      return completed;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to end session' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  cancelSession: async () => {
    const state = get();
    if (!state.session) return;

    try {
      await cancelStudySession(state.session.id);
      set({
        session: null,
        events: [],
        currentEvent: null,
        currentState: 'idle',
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to cancel session' });
    }
  },

  clearSession: () => {
    set({
      session: null,
      events: [],
      currentEvent: null,
      currentState: 'idle',
    });
  },
}));
