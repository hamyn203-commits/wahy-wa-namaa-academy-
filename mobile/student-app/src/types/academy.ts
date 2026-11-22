export type AppRole = 'student' | 'guardian' | 'teacher' | 'admin' | 'supervisor';

export interface AcademyUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: AppRole;
  avatar?: string;
  age?: number;
  gender?: 'male' | 'female';
  currentLevel?: string;
  preferredTrack?: string;
  memorizedJuz?: number;
  guardianLinkCode?: string;
  emailVerified?: boolean;
  enrollmentSection?: string;
  onboarding?: {
    required?: boolean;
    completed?: boolean;
  };
}

export interface StudentDashboardStats {
  pendingTrials: number;
  upcomingSessions: number;
  completedSessions: number;
  homeworkPending: number;
  homeworkSubmitted: number;
  streakDays?: number;
  totalPoints?: number;
  trialAllowance?: {
    limit: number;
    used: number;
    remaining: number;
  };
}

export interface SessionTeacher {
  _id?: string;
  personalInfo?: {
    fullName?: string;
    country?: string;
    gender?: 'male' | 'female';
  };
  user?: {
    _id?: string;
    name?: string;
    avatar?: string;
  };
}

export interface SessionItem {
  _id: string;
  type: 'trial' | 'regular' | 'group_circle';
  status: 'pending' | 'accepted' | 'scheduled' | 'completed' | 'cancelled' | 'rejected' | 'no-show';
  scheduledAt: string;
  duration?: number;
  timezone?: string;
  roomId?: string;
  meetingLink?: string;
  notes?: string;
  teacher?: SessionTeacher;
  circle?: {
    _id?: string;
    name?: string;
  };
}

export interface HomeworkItem {
  _id: string;
  sessionId?: string;
  circleName?: string;
  title?: string;
  description?: string;
  surah?: string;
  ayahFrom?: number;
  ayahTo?: number;
  dueDate?: string;
  status: 'pending' | 'submitted' | 'done' | 'reviewed' | 'overdue';
  type?: string;
  teacherFeedback?: string;
  hasTeacherFeedbackAudio?: boolean;
  teacherFeedbackDuration?: number;
  reviewedAt?: string;
  grade?: number | string;
  isTask?: boolean;
  createdAt?: string;
  teacher?: SessionTeacher;
}

export interface SubscriptionItem {
  _id: string;
  planKey: string;
  section?: string;
  status: string;
  sessionCount: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  currency?: string;
  totalAmountMinor?: number;
  pricingSnapshot?: {
    nameAr?: string;
    nameEn?: string;
    durationLabelAr?: string;
    durationLabelEn?: string;
  };
  circle?: {
    _id?: string;
    name?: string;
    status?: string;
  };
  preferredTeacher?: SessionTeacher;
}

export interface PlanCatalogItem {
  key: string;
  name?: { ar?: string; en?: string };
  description?: { ar?: string; en?: string };
  durationLabel?: { ar?: string; en?: string };
  minStudents?: number;
  maxStudents?: number;
  pricePerSession?: number;
  pricePerSessionMinor?: number;
  currency?: string;
  features?: { ar?: string[]; en?: string[] } | string[];
  popular?: boolean;
  fromPrice?: boolean;
}

export interface PlanCatalogResponse {
  currency?: string;
  region?: string;
  countryCode?: string;
  plans?: PlanCatalogItem[];
  allowedSessionCounts?: number[];
}

export interface LocalizedText {
  ar?: string;
  en?: string;
  [key: string]: string | undefined;
}

export interface NotificationItem {
  _id: string;
  type?: string;
  title?: string | LocalizedText;
  message?: string | LocalizedText;
  isRead: boolean;
  createdAt: string;
  data?: {
    actionUrl?: string;
    meetingLink?: string;
  };
}

export interface GuardianChildSummary {
  student?: {
    _id: string;
    name?: string;
    email?: string;
    currentLevel?: string;
    memorizedJuz?: number;
    age?: number;
  };
  relationship?: string;
  stats?: {
    upcomingSessions?: number;
    completedSessions?: number;
    pendingHomework?: number;
  };
  nextSession?: SessionItem | null;
}

export interface GuardianFamilyOverview {
  children?: GuardianChildSummary[];
  summary?: {
    totalChildren?: number;
    upcomingSessions?: number;
    pendingHomework?: number;
  };
}

export interface GuardianInvitation {
  _id: string;
  status: string;
  relationship?: string;
  student?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  createdAt?: string;
  expiresAt?: string;
}

export interface PublicTeacher {
  _id: string;
  isFeatured?: boolean;
  isVerified?: boolean;
  hourlyRate?: number;
  languages?: string[];
  personalInfo?: {
    fullName?: string;
    country?: string;
    gender?: 'male' | 'female';
  };
  academicInfo?: {
    specialization?: string;
    qualification?: string;
    degree?: string;
    university?: string;
  };
  quranInfo?: {
    specializations?: string[];
    teachingExperience?: number;
    ijazah?: boolean;
    numberOfIjazat?: number;
    ijazaType?: string;
    sheikhName?: string;
    sanad?: string;
    memorizedParts?: number;
    bio?: string;
    memorizationStatus?: string;
  };
  rating?: {
    average?: number;
    count?: number;
  };
  stats?: {
    totalStudents?: number;
    completedSessions?: number;
  };
  user?: {
    _id?: string;
    name?: string;
    avatar?: string;
    bio?: string;
  };
  media?: {
    profilePhoto?: string;
    introductionVideo?: string;
    recitationVideo?: string;
    teachingMethodVideo?: string;
    additionalVideos?: string[];
  };
}

export interface TrialRequestItem {
  _id: string;
  studentName: string;
  preferredTrack?: string;
  status: string;
  createdAt?: string;
  scheduledAt?: string;
  preferredTimeSlot?: string;
}

export interface CourseItem {
  _id: string;
  slug?: string;
  title?: string | LocalizedText;
  description?: string | LocalizedText;
  category?: string;
  level?: string;
  price?: number;
  image?: string;
  stats?: {
    enrolled?: number;
    lessonsCount?: number;
    rating?: { average?: number; count?: number };
  };
  instructor?: {
    name?: string;
  };
}

export interface CourseEnrollment {
  _id: string;
  status?: string;
  progress?: number;
  course?: CourseItem;
}

export interface CourseLesson {
  _id: string;
  title?: string | LocalizedText;
  description?: string | LocalizedText;
  content?: {
    text?: string;
    body?: string;
    summary?: string;
  };
  type?: string;
  duration?: number;
  order?: number;
  completed?: boolean;
}

export interface EvaluationItem {
  _id: string;
  scheduledAt?: string;
  teacher?: SessionTeacher;
  teacherEvaluation?: {
    memorizationScore?: number;
    tajweedScore?: number;
    attendanceScore?: number;
    overallRating?: number;
    notes?: string;
    surah?: string;
    ayahRange?: string;
  };
}

export interface BadgeEntry {
  _id: string;
  isUnlocked?: boolean;
  unlockedAt?: string;
  badge?: {
    _id?: string;
    name?: string | LocalizedText;
    description?: string | LocalizedText;
    category?: string;
    rarity?: string;
    points?: number;
  };
}

export interface AchievementItem {
  _id: string;
  title?: string | LocalizedText;
  description?: string | LocalizedText;
  points?: number;
  achievedAt?: string;
}

export interface CertificateItem {
  _id: string;
  certificateId?: string;
  title?: string | LocalizedText;
  course?: { title?: string | LocalizedText };
  issuedAt?: string;
  grade?: string;
}

export interface SupportMessage {
  _id: string;
  senderRole: 'student' | 'admin';
  text: string;
  createdAt: string;
  readAt?: string | null;
  hasAudio?: boolean;
  audioDuration?: number;
  hasAttachment?: boolean;
  attachmentType?: 'image' | 'video' | '';
  attachmentMimeType?: string;
  attachmentName?: string;
  _optimistic?: boolean;
}

export interface SurahMeta {
  number: number;
  nameAr: string;
  nameEn: string;
  ayahs: number;
  revelation: 'meccan' | 'medinan';
  juz: number;
}
