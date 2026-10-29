export type SlotType = 'PRE' | 'FORMAL' | 'POST' | 'BREAK';

export interface WorkDay {
  id: string | number;
  school_id?: string;
  day_index: number;
  day_name: string;
  is_active: boolean;
  max_periods?: number;
  version?: number;
  updated_at?: string;
}

export interface TimeSlot {
  id: string;
  school_id?: string;
  day_index: number;
  period_number: number;
  slot_name: string;
  start_time: string;
  end_time: string;
  slot_type: SlotType;
  version?: number;
  updated_at?: string;
}

export interface UnavailableRule {
  day_index: number;
  periods: number[] | 'ALL';
  level: 'HARD' | 'SOFT';
  reason?: string;
}

export interface Teacher {
  id: string;
  school_id?: string;
  teacher_code: string;
  full_name: string;
  max_periods_per_day?: number;
  unavailable_slots?: UnavailableRule[] | any[];
  version?: number;
  updated_at?: string;
}

export interface ClassRoom {
  id: string;
  school_id?: string;
  class_name: string;
  grade_level?: number | string;
  created_at?: string;
}

export interface Room {
  id: string;
  school_id?: string;
  room_name: string;
  room_type?: string;
}

export interface Subject {
  id: string;
  school_id?: string;
  subject_code: string;
  subject_name: string;
  is_heavy_subject?: boolean;
}

export interface Lesson {
  id: string;
  school_id?: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  preferred_room_id: string | null;
  total_periods?: number;
  total_periods_per_week?: number;
  split_pattern: string | number[];
  allowed_slot_types: SlotType | string;
  version?: number;
  updated_at?: string;
}

export interface ScheduleItem {
  id: string;
  school_id?: string;
  job_id?: string;
  lesson_id: string;
  time_slot_id: string;
  teacher_id: string;
  class_id: string;
  room_id: string | null;
  is_locked: boolean;
}

export interface GenerationJob {
  id: string;
  school_id?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_message: string;
  execution_time_ms?: number;
}
