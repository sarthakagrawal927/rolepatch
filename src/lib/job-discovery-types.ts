export interface DiscoveredJob {
  id: string;
  site?: string | null;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  is_remote?: boolean | null;
  date_posted?: string | null;
  job_type?: string | null;
  min_amount?: number | null;
  max_amount?: number | null;
  currency?: string | null;
  job_url?: string | null;
  description?: string | null;
  description_short?: string | null;
}

export interface JobSearchFilters {
  query: string;
  location?: string;
  remote?: boolean;
}
