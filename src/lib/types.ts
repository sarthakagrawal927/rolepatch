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
  status: 'draft' | 'tailored' | 'applied';
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

export interface AIProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface StashEntry {
  id: string;
  category: string;
  label: string;
  content: string;
  created_at: number;
  updated_at: number;
}
