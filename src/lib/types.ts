export interface User {
  id: string;
  email: string;
  name: string;
  image: string;
  created_at: number;
  updated_at: number;
}

export interface Resume {
  id: string;
  name: string;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface JobApplication {
  id: string;
  resume_id: string;
  url: string;
  company: string;
  role: string;
  jd_raw: string;
  jd_text: string;
  status: 'draft' | 'tailored' | 'applied' | 'interview' | 'offer' | 'rejected';
  interview_date: number | null;
  follow_up_at: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  offer_amount: number | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: number;
  updated_at: number;
}

export interface TailorChange {
  snippet: string;
  reason: string;
  jd_match?: string;
}

export type JobDetailsPatch = Partial<
  Pick<
    JobApplication,
    | 'interview_date'
    | 'follow_up_at'
    | 'salary_min'
    | 'salary_max'
    | 'salary_currency'
    | 'offer_amount'
    | 'notes'
    | 'rejection_reason'
  >
>;

export interface TailoredResume {
  id: string;
  job_id: string;
  resume_id: string;
  source: string;
  accepted: number;
  changes: TailorChange[];
  created_at: number;
  updated_at: number;
}

export interface CoverLetter {
  id: string;
  job_id: string;
  resume_id: string;
  content: string;
  company_research: string;
  created_at: number;
  updated_at: number;
}

export interface OutreachEmail {
  id: string;
  job_id: string;
  resume_id: string;
  subject: string;
  body: string;
  created_at: number;
}

export interface AIProviderConfig {
  endpointUrl: string;
  apiKey: string;
  model: string;
}

export interface FitScoreDimension {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export interface FitScore {
  id: string;
  job_id: string;
  overall_score: number;
  dimensions: FitScoreDimension[];
  strengths: string[];
  gaps: string[];
  recommendation: string;
  created_at: number;
}

export interface InterviewStory {
  id: string;
  job_id: string;
  theme: string;
  jd_requirement: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  best_for: string[];
  created_at: number;
}

export interface StashEntry {
  id: string;
  category: string;
  label: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export type AchievementImpact =
  | 'revenue'
  | 'cost'
  | 'growth'
  | 'quality'
  | 'speed'
  | 'leadership'
  | 'technical'
  | 'other';

export interface AchievementEvidence {
  id: string;
  title: string;
  situation: string;
  action: string;
  result: string;
  metric: string;
  scope: string;
  skills: string[];
  role_targets: string[];
  impact_type: AchievementImpact;
  created_at: number;
  updated_at: number;
}

export type SkillPriority = 'high' | 'medium' | 'low';
export type SkillResourceType = 'course' | 'doc' | 'project' | 'book';

export interface SkillResource {
  type: SkillResourceType;
  title: string;
  url?: string;
  estimated_hours?: number;
}

export interface SkillRoadmapItem {
  skill: string;
  priority: SkillPriority;
  reason: string;
  resources: SkillResource[];
  milestone: string;
}

export interface SkillsRoadmap {
  id: string;
  job_id: string;
  items: SkillRoadmapItem[];
  total_estimated_hours: number;
  summary: string;
  created_at: number;
}
