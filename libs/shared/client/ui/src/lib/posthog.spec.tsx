import React from 'react';
import { render } from '@testing-library/react';
import { PostHogProvider } from './posthog';

describe('PostHogProvider', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <PostHogProvider>Test Child</PostHogProvider>,
    );
    expect(baseElement).toBeTruthy();
  });
});
