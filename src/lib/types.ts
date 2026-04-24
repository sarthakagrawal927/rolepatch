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
  created_at: number;
  updated_at: number;
}

export interface TailoredResume {
  id: string;
  job_id: string;
  resume_id: string;
  source: string;
  accepted: number;
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

export type { AIConfig as AIProviderConfig } from '@saas-maker/ai/server';

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
