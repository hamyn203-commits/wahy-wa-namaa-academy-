export interface TeacherRequestedChange {
  key: string;
  label: string;
  note?: string;
}

export interface TeacherUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: 'teacher' | 'student' | 'guardian' | 'admin';
  avatar?: string;
  bio?: string;
  teacherApproved?: boolean;
  teacherApprovalStatus?: 'pending' | 'under-review' | 'approved' | 'rejected' | 'suspended';
  teacherReviewNote?: string;
  teacherRequestedChanges?: TeacherRequestedChange[];
  onboarding?: {
    teacherApplicationReady?: boolean;
    profileCompleted?: boolean;
  };
  emailVerified?: boolean;
  isActive?: boolean;
}

export interface TeacherProfileData {
  _id: string;
  status?: string;
  isVerified?: boolean;
  hourlyRate?: number;
  availabilityTimezone?: string;
  personalInfo?: {
    fullName?: string;
    phone?: string;
    country?: string;
    city?: string;
    gender?: string;
  };
  academicInfo?: {
    university?: string;
    faculty?: string;
    qualification?: string;
    teachingExperience?: number;
    numberOfIjazat?: number;
    bio?: string;
    memorizationLevel?: string;
  };
  media?: {
    profilePhoto?: string;
    introductionVideo?: string;
    recitationVideo?: string;
    teachingMethodVideo?: string;
  };
  rating?: {
    average: number;
    count: number;
  };
  stats?: {
    totalStudents: number;
    totalHours: number;
    totalSessions: number;
  };
  availability?: AvailabilityDay[];
}

export interface TeacherStats {
  totalStudents: number;
  totalSessions: number;
  totalHours: number;
  pendingEarnings: number;
  availableEarnings?: number;
  totalEarnings: number;
  averageRating: number;
  sessionRate: number;
}

export interface SessionStudentRef {
  _id: string;
  name: string;
  avatar?: string;
  currentLevel?: string;
  preferredTrack?: string;
}

export interface SessionAttendanceEntry {
  student?: SessionStudentRef | string;
  status: 'scheduled' | 'attended' | 'absent' | 'excused';
  markedAt?: string;
}

export interface TeacherSession {
  _id: string;
  type: 'trial' | 'regular' | 'group_circle';
  status: 'pending' | 'accepted' | 'completed' | 'rejected' | 'cancelled' | 'reschedule_proposed';
  scheduledAt: string;
  duration?: number;
  timezone?: string;
  student?: SessionStudentRef;
  circle?: {
    _id: string;
    name: string;
    status?: string;
  };
  attendance?: SessionAttendanceEntry[];
  notes?: string;
  studentNotes?: string;
  meetingLink?: string;
  liveRoomId?: string;
  earnings?: {
    amount?: number;
    currency?: string;
  };
  evaluation?: {
    attendance?: number;
    memorization?: number;
    tajweed?: number;
    behavior?: number;
    commitment?: number;
    surahRecited?: string;
    fromAyah?: number;
    toAyah?: number;
    nextHomework?: string;
    overallNotes?: string;
  };
}

export interface ActiveStudent {
  _id: string;
  name: string;
  avatar?: string;
  currentLevel?: string;
  preferredTrack?: string;
  completedSessions?: number;
  upcomingSessions?: number;
  pendingTasks?: number;
  lastSessionAt?: string;
  circles?: Array<{ _id: string; name: string }>;
}

export interface TeacherCircle {
  _id: string;
  name: string;
  status?: string;
  track?: string;
  level?: string;
  timezone?: string;
  maxStudents?: number;
  currentCount?: number;
  durationMinMinutes?: number;
  durationMaxMinutes?: number;
  students?: SessionStudentRef[];
}

export interface TeacherTaskItem {
  _id: string;
  student?: {
    _id: string;
    name: string;
    avatar?: string;
  };
  circle?: {
    _id: string;
    name: string;
  };
  type: 'memorization' | 'review-recent' | 'review-far' | 'audio' | 'test';
  title: string;
  description?: string;
  dueDate?: string;
  status: 'pending' | 'submitted' | 'done';
  submissionFile?: string;
  submissionNote?: string;
  submittedAt?: string;
  teacherFeedback?: string;
  hasTeacherFeedbackAudio?: boolean;
  teacherFeedbackDuration?: number;
  reviewedAt?: string;
  createdAt?: string;
}

export interface CurrencyBalance {
  available: number;
  pending: number;
  withdrawn: number;
  totalEarned: number;
}

export interface TeacherFinanceState {
  balances: {
    EGP: CurrencyBalance;
    USD: CurrencyBalance;
  };
  limits: {
    minPayoutEGP: number;
    minPayoutUSD: number;
  };
}

export interface FinanceTransaction {
  _id: string;
  type: 'session_earning' | 'payout' | 'bonus' | 'deduction' | 'adjustment';
  amount: number;
  currency: 'EGP' | 'USD';
  status: 'pending' | 'completed' | 'rejected' | 'cancelled';
  payoutMethod?: string;
  description?: string;
  notes?: string;
  referenceNumber?: string;
  createdAt: string;
}

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  isBooked?: boolean;
}

export interface AvailabilityDay {
  day: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  slots: AvailabilitySlot[];
}

export interface TeacherUpdateItem {
  _id: string;
  title: string;
  message?: string;
  publishedAt?: string;
  createdAt?: string;
  audience?: {
    mode: 'all-active' | 'selected';
    students?: Array<{ _id: string; name: string; avatar?: string }>;
  };
  videos?: Array<{
    name?: string;
    size?: number;
    contentType?: string;
  }>;
}

export interface TeacherAnalytics {
  monthlySessions: Array<{ month: string; count: number }>;
  totalCompleted: number;
  lifetimeCompleted?: number;
  averageRating: number;
  totalStudents: number;
  trialConversion?: {
    completedTrials: number;
    converted: number;
    rate: number;
  };
  homework?: {
    total: number;
    completed: number;
    completionRate: number;
  };
  upcomingSevenDays?: number;
  earnings?: {
    daily: number;
    weekly: number;
    monthly: number;
    available?: number;
    pendingPayouts?: number;
  };
}

export interface TeacherReviewItem {
  _id: string;
  rating: number;
  comment?: string;
  isAnonymous?: boolean;
  student?: {
    name?: string;
    avatar?: string;
  };
  createdAt: string;
}

export interface TeacherProfileChangeRequest {
  _id: string;
  status: 'pending' | 'approved' | 'rejected';
  changedFields?: string[];
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface NotificationItem {
  _id: string;
  type?: string;
  title?: string | { ar?: string; en?: string };
  message?: string | { ar?: string; en?: string };
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
  data?: {
    actionUrl?: string;
    session?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface SessionChatMessage {
  _id: string;
  senderRole?: string;
  senderName?: string;
  isMe?: boolean;
  originalText?: string;
  translatedText?: string;
  text?: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: string;
}

export interface StudentSummaryResponse {
  student?: {
    _id: string;
    name: string;
    avatar?: string;
    currentLevel?: string;
    preferredTrack?: string;
    age?: number;
    gender?: string;
  };
  progress?: {
    completedSessions?: number;
    totalMemorizedAyahs?: number;
    memorizedSurahs?: number;
    averageMemorization?: number;
    averageTajweed?: number;
    currentSurah?: string;
    streakDays?: number;
  };
  recentSessions?: TeacherSession[];
  tasks?: TeacherTaskItem[];
}
