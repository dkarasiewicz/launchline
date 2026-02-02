/**
 * Tool UI Registry
 *
 * Central export for all assistant tool UI components.
 */

// Memory tools
export {
  SearchMemoriesToolUI as SearchMemoriesTool,
  SaveMemoryToolUI as SaveMemoryTool,
  GetBlockersToolUI as GetBlockersTool,
  GetDecisionsToolUI as GetDecisionsTool,
  ResolveIdentityToolUI as ResolveIdentityTool,
} from './memories';

// Inbox tools
export {
  GetInboxItemsToolUI as GetInboxItemsTool,
  GetWorkspaceStatusToolUI as GetWorkspaceStatusTool,
} from './inbox';

// Linear tools
export {
  GetLinearIssuesToolUI as GetLinearIssuesTool,
  GetLinearIssueDetailsToolUI as GetLinearIssueDetailsTool,
  SearchLinearIssuesToolUI as SearchLinearIssuesTool,
  GetLinearProjectStatusToolUI as GetLinearProjectStatusTool,
  GetLinearTeamWorkloadToolUI as GetLinearTeamWorkloadTool,
  GetLinearCycleStatusToolUI as GetLinearCycleStatusTool,
  AddLinearCommentToolUI as AddLinearCommentTool,
  CreateLinearIssueToolUI as CreateLinearIssueTool,
} from './linear';

// Project update tool
export { GenerateProjectUpdateToolUI as GenerateProjectUpdateTool } from './project-update';

// Plan/todos tool
export { WriteTodosToolUI } from './plan';

// Approval tools
export {
  UpdateLinearTicketToolUI,
  SendSlackMessageToolUI,
  InternetSearchToolUI,
  CreateGitHubIssueToolUI,
  ThinkToolUI,
} from './approval';

// Google workspace tools
export {
  GetLatestEmailsToolUI,
  ReplyToEmailToolUI,
  GetCalendarEventsToolUI,
  ScheduleCalendarEventToolUI,
} from './google';

// GitHub tools
export {
  GetGitHubPullRequestsToolUI,
  GetGitHubPullRequestDetailsToolUI,
  GetGitHubIssuesToolUI,
  SearchGitHubIssuesToolUI,
  GetGitHubCommitsToolUI,
} from './github/github';

// Sandbox tools
export { RunSandboxCommandToolUI } from './sandbox/sandbox';
