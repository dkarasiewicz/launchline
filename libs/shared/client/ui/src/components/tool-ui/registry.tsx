'use client';

import {
  UpdateLinearTicketToolUI,
  SendSlackMessageToolUI,
  InternetSearchToolUI,
  CreateGitHubIssueToolUI,
  ThinkToolUI,
} from './approval/approval';
import {
  SearchMemoriesToolUI,
  SaveMemoryToolUI,
  GetBlockersToolUI,
  GetDecisionsToolUI,
  ResolveIdentityToolUI,
} from './memories/memories';
import {
  GetInboxItemsToolUI,
  GetWorkspaceStatusToolUI,
} from './inbox/inbox';
import {
  GetLinearIssuesToolUI,
  GetLinearIssueDetailsToolUI,
  SearchLinearIssuesToolUI,
  GetLinearProjectStatusToolUI,
  GetLinearTeamWorkloadToolUI,
  GetLinearCycleStatusToolUI,
  AddLinearCommentToolUI,
  CreateLinearIssueToolUI,
} from './linear/linear';
import { GenerateProjectUpdateToolUI } from './project-update/project-update';
import { WriteTodosToolUI } from './plan/_adapter';
import {
  GetLatestEmailsToolUI,
  ReplyToEmailToolUI,
  GetCalendarEventsToolUI,
  ScheduleCalendarEventToolUI,
} from './google/google';
import {
  GetGitHubPullRequestsToolUI,
  GetGitHubPullRequestDetailsToolUI,
  GetGitHubIssuesToolUI,
  SearchGitHubIssuesToolUI,
  GetGitHubCommitsToolUI,
} from './github/github';
import { RunSandboxCommandToolUI } from './sandbox/sandbox';
import { RunSandboxWorkflowToolUI } from './sandbox/workflow';

export function LineaToolRegistry() {
  return (
    <>
      {/* Memory tools */}
      <SearchMemoriesToolUI />
      <SaveMemoryToolUI />
      <GetBlockersToolUI />
      <GetDecisionsToolUI />
      <ResolveIdentityToolUI />
      {/* Inbox tools */}
      <GetInboxItemsToolUI />
      <GetWorkspaceStatusToolUI />
      {/* Linear tools */}
      <GetLinearIssuesToolUI />
      <GetLinearIssueDetailsToolUI />
      <SearchLinearIssuesToolUI />
      <GetLinearProjectStatusToolUI />
      <GetLinearTeamWorkloadToolUI />
      <GetLinearCycleStatusToolUI />
      <AddLinearCommentToolUI />
      <CreateLinearIssueToolUI />
      {/* Project update */}
      <GenerateProjectUpdateToolUI />
      {/* Google workspace */}
      <GetLatestEmailsToolUI />
      <ReplyToEmailToolUI />
      <GetCalendarEventsToolUI />
      <ScheduleCalendarEventToolUI />
      {/* GitHub tools */}
      <GetGitHubPullRequestsToolUI />
      <GetGitHubPullRequestDetailsToolUI />
      <GetGitHubIssuesToolUI />
      <SearchGitHubIssuesToolUI />
      <GetGitHubCommitsToolUI />
      {/* Sandbox automation */}
      <RunSandboxCommandToolUI />
      <RunSandboxWorkflowToolUI />
      {/* Human-in-the-loop Approval UIs */}
      <UpdateLinearTicketToolUI />
      <SendSlackMessageToolUI />
      <InternetSearchToolUI />
      <CreateGitHubIssueToolUI />
      <ThinkToolUI />
      {/* DeepAgents built-in write_todos */}
      <WriteTodosToolUI />
    </>
  );
}
