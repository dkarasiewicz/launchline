# Collaboration & Contributing

This document describes how to collaborate on Launchline: how we communicate, file issues, open PRs, and handle reviews.

## Open-core model

Launchline is **open-core** and **self-hostable**:

- **Core application** (server, UI, agents, prompts, graphs, workflows): Licensed under **Business Source License 1.1 (BSL 1.1)** with a *no competing hosted service* restriction.
- **SDKs and client libraries**: Licensed under **MIT** for maximum adoption.

You can audit the code, self-host the platform, and use the SDKs commercially. You cannot offer Launchline (or a substantially similar service) as a competing hosted service.

By contributing, you agree that:
- Changes to the core application are licensed under BSL 1.1.
- Changes to SDKs and libraries follow the license of that package (usually MIT).

## Communication
- Primary async channels: GitHub issues + PRs. Use Slack for real‑time discussion when needed.
- Use issue templates and PR templates to surface necessary context.

## Issues
- Use the templates in .github/ISSUE_TEMPLATE/ for bugs and feature requests.
- Provide minimal repro steps, environment, and expected vs actual behavior.
- Add the relevant labels to help triage (bug, enhancement, docs, etc).

## Pull Requests
- Base PRs against the default branch (usually `main`) or the target integration branch.
- Use the PR template and include related issue numbers.
- Keep PRs focused and small; large design work may start as an issue or RFC.
- Add a short description, testing steps, and any required rollout notes.
- Specify which part of the codebase you're modifying (core application vs SDK).

## Code review expectations
- Reviewers should respond within 48 hours if possible; indicate blockers early.
- Authors: address feedback promptly and squash/fixup commits as requested.
- Prefer clarity over cleverness. Include unit/integration tests for behavior changes.
- The community can shape the roadmap — thoughtful contributions are welcome.

## Branching & commit messages
- Branch names: feature/<short-desc>, fix/<short-desc>, chore/<short-desc>.
- Commit messages: short summary line and an optional longer description. Reference issues when applicable.

## Tests & CI
- Ensure tests pass locally and in CI before requesting final review.
- Add small, focused tests for changed behavior. Document manual verification steps in the PR.

## Triage & releases
- Maintainers triage incoming issues and label appropriately.
- For release notes, add a short line under "Release notes" in PR template when required.

## Self-hosting & transparency
- The platform is designed to be self-hostable. Issues related to deployment, configuration, or infrastructure are valid and encouraged.
- We believe PM tools should be auditable, extensible, and community-owned.

## Security & sensitive data
- Do not include secrets or credentials in issues/PRs. Use private channels for sensitive discussions.
- Use responsible disclosure for security issues; contact repository owners or maintainers privately.

## Links & templates
- Issue templates: .github/ISSUE_TEMPLATE/
- PR template: .github/PULL_REQUEST_TEMPLATE.md
- License: LICENSE (BSL 1.1 for core, MIT for SDKs)

Thank you for contributing — clear, small, and tested changes are the fastest path to merge. Built in the open, for the community.
