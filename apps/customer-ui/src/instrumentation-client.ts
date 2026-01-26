import posthog from 'posthog-js';

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
  capture_pageview: 'history_change',
  person_profiles: 'identified_only',
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});
