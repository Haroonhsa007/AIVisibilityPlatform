import { PipelineRun } from './pipeline.model';

export type ProfileStatus = 'new' | 'running' | 'completed' | 'failed';

export interface ProfileCreate {
  name: string;
  domain: string;
  industry: string;
  description?: string;
  competitors?: string[];
}

export interface Profile extends ProfileCreate {
  profile_uuid: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  latest_run?: PipelineRun | null;
}
