import React from 'react';
import { render } from '@testing-library/react';
import Page from '../src/app/page';

global.fetch = jest.fn().mockResolvedValue({
  stargazers_count: 100,
});

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Page />);
    expect(baseElement).toBeTruthy();
  });
});
