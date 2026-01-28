import { Injectable, Logger } from '@nestjs/common';
import { type StructuredToolInterface } from '@langchain/core/tools';
import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Factory for creating MCP (Model Context Protocol) tools
 * 
 * MCP allows the agent to interact with external services through
 * a standardized protocol. This enables:
 * - File system access
 * - Database queries
 * - API integrations
 * - Custom tooling
 * 
 * Reference: https://modelcontextprotocol.io/
 */
@Injectable()
export class MCPToolsFactory {
  private readonly logger = new Logger(MCPToolsFactory.name);
  private mcpClients: Map<string, MCPClient> = new Map();

  /**
   * Initialize MCP servers from configuration
   * 
   * Example configuration:
   * {
   *   'filesystem': {
   *     command: 'node',
   *     args: ['path/to/mcp-server-filesystem.js'],
   *     env: {}
   *   },
   *   'postgres': {
   *     command: 'node',
   *     args: ['path/to/mcp-server-postgres.js'],
   *     env: { DATABASE_URL: 'postgres://...' }
   *   }
   * }
   */
  async initializeServers(
    config: Record<string, { command: string; args: string[]; env?: Record<string, string> }>
  ): Promise<void> {
    for (const [name, serverConfig] of Object.entries(config)) {
      try {
        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args,
          env: { ...process.env, ...serverConfig.env },
        });

        const client = new MCPClient({
          name: `launchline-${name}`,
          version: '1.0.0',
        }, {
          capabilities: {},
        });

        await client.connect(transport);
        this.mcpClients.set(name, client);
        
        this.logger.log(`Connected to MCP server: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to connect to MCP server ${name}:`, error);
      }
    }
  }

  /**
   * Create LangChain tools from all connected MCP servers
   */
  async createMCPTools(): Promise<StructuredToolInterface[]> {
    const tools: StructuredToolInterface[] = [];

    for (const [serverName, client] of this.mcpClients.entries()) {
      try {
        const { tools: mcpTools } = await client.listTools();

        for (const mcpTool of mcpTools) {
          const tool = new DynamicStructuredTool({
            name: `${serverName}_${mcpTool.name}`,
            description: mcpTool.description || `Tool from ${serverName}`,
            schema: this.convertMCPSchemaToZod(mcpTool.inputSchema),
            func: async (input: Record<string, unknown>) => {
              try {
                const result = await client.callTool({
                  name: mcpTool.name,
                  arguments: input,
                });

                return this.formatMCPResult(result);
              } catch (error) {
                this.logger.error(`Error calling MCP tool ${mcpTool.name}:`, error);
                return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
            },
          });

          tools.push(tool);
        }

        this.logger.log(`Created ${mcpTools.length} tools from ${serverName}`);
      } catch (error) {
        this.logger.error(`Failed to create tools from ${serverName}:`, error);
      }
    }

    return tools;
  }

  /**
   * Convert MCP JSON Schema to Zod schema
   */
  private convertMCPSchemaToZod(inputSchema: any): z.ZodType {
    if (!inputSchema || !inputSchema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodType> = {};

    for (const [key, value] of Object.entries(inputSchema.properties as Record<string, any>)) {
      if (value.type === 'string') {
        shape[key] = z.string().describe(value.description || '');
      } else if (value.type === 'number') {
        shape[key] = z.number().describe(value.description || '');
      } else if (value.type === 'boolean') {
        shape[key] = z.boolean().describe(value.description || '');
      } else if (value.type === 'array') {
        shape[key] = z.array(z.any()).describe(value.description || '');
      } else {
        shape[key] = z.any().describe(value.description || '');
      }

      // Handle optional fields
      if (!inputSchema.required || !inputSchema.required.includes(key)) {
        shape[key] = shape[key].optional();
      }
    }

    return z.object(shape);
  }

  /**
   * Format MCP result for display
   */
  private formatMCPResult(result: any): string {
    if (!result.content || result.content.length === 0) {
      return 'No content returned';
    }

    return result.content
      .map((item: any) => {
        if (item.type === 'text') {
          return item.text;
        } else if (item.type === 'image') {
          return `[Image: ${item.mimeType}]`;
        } else {
          return JSON.stringify(item);
        }
      })
      .join('\n');
  }

  /**
   * Cleanup: disconnect all MCP clients
   */
  async cleanup(): Promise<void> {
    for (const [name, client] of this.mcpClients.entries()) {
      try {
        await client.close();
        this.logger.log(`Disconnected from MCP server: ${name}`);
      } catch (error) {
        this.logger.error(`Error disconnecting from ${name}:`, error);
      }
    }
    this.mcpClients.clear();
  }
}
