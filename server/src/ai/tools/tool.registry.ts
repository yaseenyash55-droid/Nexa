import { z } from 'zod';
import { UserService } from '../../services/user.service.js';
import { PostService } from '../../services/post.service.js';
import { getNotificationRepository } from '../../repositories/factory.js';
import { logger } from '../../utils/logger.js';

export interface ToolExecutionContext {
  userId: number;
  username: string;
  ip?: string;
  userAgent?: string;
}

export interface ToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  parametersSchema: z.ZodType<TParams>;
  jsonSchema: Record<string, any>;
  handler: (params: TParams, context: ToolExecutionContext) => Promise<TResult>;
}

export interface ToolExecutionAudit {
  toolName: string;
  userId: number;
  username: string;
  success: boolean;
  timestamp: string;
  error?: string;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private userService = new UserService();
  private postService = new PostService();

  constructor() {
    this.registerCoreTools();
  }

  private registerCoreTools(): void {
    // 1. get_my_profile
    this.register({
      name: 'get_my_profile',
      description: "Retrieve the authenticated user's own profile information, stats (follower/following count, posts count), bio, and account status. Requires no arguments.",
      parametersSchema: z.object({}).strict(),
      jsonSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      handler: async (_params: {}, context: ToolExecutionContext) => {
        const user = await this.userService.getUserById(context.userId, context.userId);
        return {
          userId: user.userId,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profileImageUrl: user.profileImageUrl,
          coverImageUrl: user.coverImageUrl,
          followersCount: user.followersCount ?? 0,
          followingCount: user.followingCount ?? 0,
          createdAt: user.createdAt
        };
      }
    });

    // 2. get_my_notifications
    this.register({
      name: 'get_my_notifications',
      description: "Retrieve the authenticated user's recent notifications (likes, comments, follows, mentions).",
      parametersSchema: z.object({
        limit: z.number().int().min(1).max(20).optional().default(10)
      }).strict(),
      jsonSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: 'Maximum number of notifications to retrieve (1-20, default 10)',
            minimum: 1,
            maximum: 20
          }
        },
        additionalProperties: false
      },
      handler: async (params: { limit?: number }, context: ToolExecutionContext) => {
        const notifRepo = getNotificationRepository();
        const limit = params.limit ?? 10;
        const result = await notifRepo.getUserNotifications(context.userId, undefined, limit);
        const unreadCount = await notifRepo.getUnreadCount(context.userId);

        return {
          unreadCount,
          notifications: (result.data || []).map(n => ({
            id: n.notificationId,
            type: n.type,
            actorUsername: n.actor?.username,
            postId: n.postId,
            isRead: n.isRead,
            createdAt: n.createdAt
          }))
        };
      }
    });

    // 3. search_public_posts
    this.register({
      name: 'search_public_posts',
      description: 'Search public posts across NEXA by keyword, hashtag, or topic. Only returns public posts or posts visible to the authenticated user.',
      parametersSchema: z.object({
        query: z.string().min(1).max(100),
        limit: z.number().int().min(1).max(15).optional().default(10)
      }).strict(),
      jsonSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or hashtag to query posts for',
            minLength: 1,
            maxLength: 100
          },
          limit: {
            type: 'integer',
            description: 'Max number of posts to return (1-15, default 10)',
            minimum: 1,
            maximum: 15
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      handler: async (params: { query: string; limit?: number }, context: ToolExecutionContext) => {
        const limit = params.limit ?? 10;
        const cleanQuery = params.query.toLowerCase().trim();

        // Query global public feed and filter by relevance to the query
        const feed = await this.postService.getGlobalFeed(context.userId, undefined, 50);
        const matched = feed.data
          .filter(post => {
            const content = (post.content || '').toLowerCase();
            return content.includes(cleanQuery);
          })
          .slice(0, limit);

        return {
          query: params.query,
          count: matched.length,
          posts: matched.map(p => ({
            postId: p.postId,
            authorUsername: p.author?.username,
            content: p.content,
            imageUrl: p.imageUrl,
            likesCount: p.likesCount,
            commentsCount: p.commentsCount,
            createdAt: p.createdAt
          }))
        };
      }
    });

    // 4. search_users
    this.register({
      name: 'search_users',
      description: 'Search for public users on NEXA by username, handle, or display name.',
      parametersSchema: z.object({
        query: z.string().min(1).max(50),
        limit: z.number().int().min(1).max(10).optional().default(5)
      }).strict(),
      jsonSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Username or display name keyword to search for',
            minLength: 1,
            maxLength: 50
          },
          limit: {
            type: 'integer',
            description: 'Max number of user profiles to return (1-10, default 5)',
            minimum: 1,
            maximum: 10
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      handler: async (params: { query: string; limit?: number }, context: ToolExecutionContext) => {
        const limit = params.limit ?? 5;
        const users = await this.userService.searchUsers(params.query, context.userId, limit);

        return {
          query: params.query,
          count: users.length,
          users: users.map(u => ({
            userId: u.userId,
            username: u.username,
            displayName: u.displayName,
            bio: u.bio,
            profileImageUrl: u.profileImageUrl,
            followersCount: u.followersCount ?? 0,
            followingCount: u.followingCount ?? 0
          }))
        };
      }
    });
  }

  public register<TParams, TResult>(tool: ToolDefinition<TParams, TResult>): void {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getOpenAiToolDefinitions(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.jsonSchema
      }
    }));
  }

  public async executeTool(
    name: string,
    rawParams: unknown,
    context: ToolExecutionContext
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const tool = this.tools.get(name);
    const timestamp = new Date().toISOString();

    if (!tool) {
      const errorMsg = `Tool '${name}' not found in registry`;
      this.recordAudit({
        toolName: name,
        userId: context.userId,
        username: context.username,
        success: false,
        timestamp,
        error: errorMsg
      });
      return { success: false, error: errorMsg };
    }

    // Validate parameters strictly against Zod schema
    const parseResult = tool.parametersSchema.safeParse(rawParams ?? {});
    if (!parseResult.success) {
      const errorMsg = `Invalid arguments for tool '${name}': ${parseResult.error.message}`;
      this.recordAudit({
        toolName: name,
        userId: context.userId,
        username: context.username,
        success: false,
        timestamp,
        error: errorMsg
      });
      return { success: false, error: errorMsg };
    }

    try {
      const result = await tool.handler(parseResult.data, context);

      this.recordAudit({
        toolName: name,
        userId: context.userId,
        username: context.username,
        success: true,
        timestamp
      });

      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err?.message || 'Tool execution failed';
      logger.error({ err: errorMsg, toolName: name, userId: context.userId }, 'AI tool execution error');

      this.recordAudit({
        toolName: name,
        userId: context.userId,
        username: context.username,
        success: false,
        timestamp,
        error: errorMsg
      });

      return { success: false, error: errorMsg };
    }
  }

  private recordAudit(audit: ToolExecutionAudit): void {
    logger.info(
      {
        audit: true,
        category: 'AI_TOOL_EXECUTION',
        toolName: audit.toolName,
        userId: audit.userId,
        username: audit.username,
        success: audit.success,
        timestamp: audit.timestamp,
        error: audit.error
      },
      `[AI TOOL AUDIT] ${audit.toolName} - ${audit.success ? 'SUCCESS' : 'FAILED'}`
    );
  }
}

export const toolRegistry = new ToolRegistry();
