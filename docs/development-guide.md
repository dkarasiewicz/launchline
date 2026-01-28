# Development Guide

## Getting Started

### Prerequisites

- **Node.js**: v20 or later
- **pnpm**: v8 or later
- **Docker**: For running PostgreSQL, Redis, RabbitMQ
- **Linear Account**: For testing the integration

### Initial Setup

1. Clone repository and install dependencies
2. Start infrastructure with docker-compose
3. Configure environment variables
4. Run database migrations
5. Start development servers

## Project Structure

The project uses Nx monorepo with:
- apps/core - NestJS backend
- apps/customer-ui - Next.js frontend  
- libs/core/* - Shared libraries organized by domain

## Common Commands

```bash
# Development
pnpm nx serve-hmr core
pnpm nx start customer-ui

# Testing
pnpm nx test integration
pnpm nx lint integration

# Database
pnpm nx migrate-run core
```

## Resources

- NestJS Documentation
- LangChain/LangGraph Documentation
- Linear API Documentation
