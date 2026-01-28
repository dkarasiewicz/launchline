# MCP Skills for DeepAgent

Launchline integrates with the Model Context Protocol (MCP) to give the DeepAgent extended capabilities through external tools and services.

## What is MCP?

MCP (Model Context Protocol) is a standardized protocol for connecting AI agents to external tools and data sources. It allows:

- File system access
- Database queries
- API integrations
- Custom tooling

Reference: https://modelcontextprotocol.io/

## Configuration

MCP servers are configured via environment variables or configuration files. Add to your `.env`:

```bash
# MCP Server Configuration (JSON format)
MCP_SERVERS='{"filesystem":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/path/to/workspace"]}}'
```

## Available MCP Skills

### Filesystem Access

Allows the agent to read and write files in a controlled directory.

**Setup**:
```bash
npm install -g @modelcontextprotocol/server-filesystem
```

**Configuration**:
```json
{
  "filesystem": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/workspace/docs"
    ]
  }
}
```

**Agent Capabilities**:
- Read documentation files
- Write meeting notes
- Create decision logs
- Update project status files

### Database Access

Allows the agent to query databases for context.

**Setup**:
```bash
npm install -g @modelcontextprotocol/server-postgres
```

**Configuration**:
```json
{
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "DATABASE_URL": "postgresql://user:pass@localhost:5432/db"
    }
  }
}
```

**Agent Capabilities**:
- Query historical issue data
- Look up past decisions
- Analyze patterns in tickets

### GitHub Integration

Extended GitHub capabilities beyond basic API calls.

**Setup**:
```bash
npm install -g @modelcontextprotocol/server-github
```

**Configuration**:
```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "ghp_your_token"
    }
  }
}
```

**Agent Capabilities**:
- Search code across repos
- Analyze PR reviews
- Track contributor activity

## Using MCP Skills in Conversations

Once configured, MCP tools appear automatically to the agent:

**Example conversation**:

User: "What decisions did we make last week about the API redesign?"

Agent uses:
1. `filesystem_read` - Read `/workspace/docs/decisions/`
2. `postgres_query` - Query decision logs from database
3. Returns synthesized summary

**Example action**:

User: "Log this decision in our decision log"

Agent uses:
1. `filesystem_write` - Append to `/workspace/docs/decisions/2024-Q1.md`
2. Confirms action completed

## Security Considerations

### File System Access

- **Restrict directories**: Only allow access to specific paths
- **Read-only mode**: Consider read-only for sensitive areas
- **Audit logs**: Track all file operations

### Database Access

- **Read-only user**: Create a database user with SELECT-only permissions
- **Query limits**: Set timeouts and row limits
- **No DDL**: Prevent schema modifications

### API Access

- **Token scope**: Use minimal required scopes
- **Rate limiting**: Be aware of API rate limits
- **Audit trail**: Log all external API calls

## Extending with Custom MCP Servers

You can create custom MCP servers for domain-specific needs:

```typescript
// custom-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: 'launchline-custom',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register custom tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'analyze_sprint',
        description: 'Analyze sprint velocity and completion',
        inputSchema: {
          type: 'object',
          properties: {
            sprintId: {
              type: 'string',
              description: 'Sprint identifier',
            },
          },
          required: ['sprintId'],
        },
      },
    ],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'analyze_sprint') {
    const { sprintId } = request.params.arguments;
    
    // Custom logic here
    const analysis = await analyzeSprintData(sprintId);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }
  
  throw new Error('Unknown tool');
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Configuration**:
```json
{
  "custom": {
    "command": "node",
    "args": ["./custom-mcp-server.js"]
  }
}
```

## Best Practices

1. **Start small**: Begin with filesystem access for documentation
2. **Test thoroughly**: Validate MCP tools work before giving to agent
3. **Monitor usage**: Track which tools are used most
4. **Iterate**: Add more skills based on actual needs
5. **Document**: Keep MCP server configs in version control

## Troubleshooting

### MCP Server Won't Connect

```bash
# Test server manually
npx -y @modelcontextprotocol/server-filesystem /tmp

# Check logs
tail -f logs/linea.log | grep MCP
```

### Tools Not Appearing

1. Verify server is in MCP_SERVERS config
2. Check server process is running
3. Restart Linea module to reload tools

### Permission Errors

1. Ensure filesystem paths are accessible
2. Verify database credentials are correct
3. Check API token scopes

## Future MCP Skills

Planned integrations:

- **Slack**: Advanced message search and context
- **Notion**: Document retrieval and updates
- **Jira**: Cross-project dependency tracking
- **Figma**: Design file reference
- **Analytics**: Custom metric queries

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Server Examples](https://github.com/modelcontextprotocol/servers)
- [LangChain MCP Integration](https://js.langchain.com/docs/integrations/tools/mcp)
