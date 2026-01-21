import { 
  type User, type InsertUser, type Post, type InsertPost,
  type Comment, type InsertComment,
  type PostLike, type InsertPostLike,
  type PostReport, type InsertPostReport,
  type CommentLike, type InsertCommentLike,
  type CommentReport, type InsertCommentReport,
  type Notification, type InsertNotification,
  type Admin, type InsertAdmin,
  type AiSettings, type InsertAiSettings,
  type AuthorInfo, type InsertAuthorInfo,
  type ApiUsageLog, type InsertApiUsageLog,
  users, posts, comments, postLikes, postReports, commentLikes, commentReports, categories, subcategories, notifications, admins, aiSettings, authorInfo, apiUsageLogs
} from "@shared/schema";
import { db } from "../db";
import { eq, desc, and, isNull, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByNickname(nickname: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: { name?: string; nickname?: string }): Promise<User | undefined>;
  updateUserPassword(id: string, newPassword: string): Promise<User | undefined>;
  
  getAdmin(id: string): Promise<Admin | undefined>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  createPost(post: InsertPost, moderation?: { isFlagged: boolean; moderationScore: string; moderationReason: string; isHidden?: boolean }): Promise<Post>;
  getPostById(id: string): Promise<Post | undefined>;
  getPosts(category?: string): Promise<Post[]>;
  getPostsByAuthor(authorId: string): Promise<Post[]>;
  getFlaggedPosts(): Promise<Post[]>;
  updatePost(id: string, updates: Partial<InsertPost>): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
  togglePostHidden(id: string, isHidden: boolean): Promise<Post | undefined>;
  incrementPostView(id: string): Promise<void>;

  togglePostLike(userId: string, postId: string, isLike: boolean): Promise<{ action: 'added' | 'removed' | 'changed', postLike?: PostLike }>;
  getPostLike(userId: string, postId: string): Promise<PostLike | undefined>;
  updatePostLikeCounts(postId: string): Promise<void>;

  createPostReport(report: InsertPostReport): Promise<PostReport>;
  getPostReport(userId: string, postId: string): Promise<PostReport | undefined>;

  createComment(comment: InsertComment, moderation?: { isFlagged: boolean; moderationScore: string; moderationReason: string; isHidden?: boolean }): Promise<Comment>;
  getCommentById(id: string): Promise<Comment | undefined>;
  getCommentsByPostId(postId: string): Promise<Comment[]>;
  getCommentsByAuthor(userId: string): Promise<Comment[]>;
  getAllComments(): Promise<Comment[]>;
  deleteComment(id: string): Promise<boolean>;
  toggleCommentHidden(id: string, isHidden: boolean): Promise<Comment | undefined>;

  toggleCommentLike(userId: string, commentId: string, isLike: boolean): Promise<{ action: 'added' | 'removed' | 'changed', commentLike?: CommentLike }>;
  getCommentLike(userId: string, commentId: string): Promise<CommentLike | undefined>;
  updateCommentLikeCounts(commentId: string): Promise<void>;

  createCommentReport(report: InsertCommentReport): Promise<CommentReport>;
  getCommentReport(userId: string, commentId: string): Promise<CommentReport | undefined>;

  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  getUnreadNotificationsByUserId(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  getAiSettings(): Promise<AiSettings | undefined>;
  updateAiSettings(settings: InsertAiSettings): Promise<AiSettings | undefined>;

  createAuthorInfo(info: InsertAuthorInfo): Promise<AuthorInfo>;
  getAuthorInfoList(): Promise<AuthorInfo[]>;
  deleteAuthorInfo(id: string): Promise<boolean>;
  
  syncAllCommentCounts(): Promise<number>;

  createApiUsageLog(log: InsertApiUsageLog): Promise<ApiUsageLog>;
  getApiUsageLogs(startDate?: Date, endDate?: Date): Promise<ApiUsageLog[]>;
  getMonthlyApiUsageStats(year: number, month: number): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    byModel: Record<string, { calls: number; tokens: number; cost: number }>;
    byFunction: Record<string, { calls: number; tokens: number; cost: number }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByNickname(nickname: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: { name?: string; nickname?: string }): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async updateUserPassword(id: string, newPassword: string): Promise<User | undefined> {
    const result = await db.update(users).set({ password: newPassword }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getAdmin(id: string): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    return result[0];
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
    return result[0];
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const result = await db.insert(admins).values(insertAdmin).returning();
    return result[0];
  }

  async createPost(insertPost: InsertPost, moderation?: { isFlagged: boolean; moderationScore: string; moderationReason: string; isHidden?: boolean }): Promise<Post> {
    const postData = moderation 
      ? { ...insertPost, ...moderation }
      : insertPost;
    const result = await db.insert(posts).values(postData).returning();
    return result[0];
  }

  async getPostById(id: string): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0];
  }

  async getPosts(categorySlug?: string): Promise<Post[]> {
    if (categorySlug) {
      // slug로 카테고리 또는 소카테고리 찾기
      const category = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
      const subcategory = await db.select().from(subcategories).where(eq(subcategories.slug, categorySlug)).limit(1);
      
      if (category.length > 0) {
        // 대카테고리인 경우: categoryId로 필터링 (숨겨지지 않은 게시물만)
        return await db.select().from(posts).where(and(eq(posts.categoryId, category[0].id), eq(posts.isHidden, false))).orderBy(desc(posts.createdAt));
      } else if (subcategory.length > 0) {
        // 소카테고리인 경우: subcategoryId로 필터링 (숨겨지지 않은 게시물만)
        return await db.select().from(posts).where(and(eq(posts.subcategoryId, subcategory[0].id), eq(posts.isHidden, false))).orderBy(desc(posts.createdAt));
      }
    }
    // 숨겨지지 않은 게시물만 반환
    return await db.select().from(posts).where(eq(posts.isHidden, false)).orderBy(desc(posts.createdAt));
  }

  async getPostsByAuthor(authorId: string): Promise<Post[]> {
    return await db.select().from(posts).where(eq(posts.authorId, authorId)).orderBy(desc(posts.createdAt));
  }

  async getFlaggedPosts(): Promise<Post[]> {
    return await db.select().from(posts).where(eq(posts.isFlagged, true)).orderBy(desc(posts.createdAt));
  }

  async updatePost(id: string, updates: Partial<InsertPost>): Promise<Post | undefined> {
    const result = await db.update(posts).set(updates).where(eq(posts.id, id)).returning();
    return result[0];
  }

  async deletePost(id: string): Promise<boolean> {
    const result = await db.delete(posts).where(eq(posts.id, id)).returning();
    return result.length > 0;
  }

  async togglePostHidden(id: string, isHidden: boolean): Promise<Post | undefined> {
    const result = await db.update(posts).set({ isHidden }).where(eq(posts.id, id)).returning();
    return result[0];
  }

  async incrementPostView(id: string): Promise<void> {
    await db.execute(sql`UPDATE posts SET view_count = view_count + 1 WHERE id = ${id}`);
  }

  async togglePostLike(userId: string, postId: string, isLike: boolean): Promise<{ action: 'added' | 'removed' | 'changed', postLike?: PostLike }> {
    const existing = await this.getPostLike(userId, postId);
    
    if (existing) {
      if (existing.isLike === isLike) {
        await db.delete(postLikes).where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)));
        await this.updatePostLikeCounts(postId);
        return { action: 'removed' };
      } else {
        const result = await db.update(postLikes)
          .set({ isLike })
          .where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)))
          .returning();
        await this.updatePostLikeCounts(postId);
        return { action: 'changed', postLike: result[0] };
      }
    } else {
      const result = await db.insert(postLikes).values({ userId, postId, isLike }).returning();
      await this.updatePostLikeCounts(postId);
      return { action: 'added', postLike: result[0] };
    }
  }

  async getPostLike(userId: string, postId: string): Promise<PostLike | undefined> {
    const result = await db.select().from(postLikes)
      .where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)))
      .limit(1);
    return result[0];
  }

  async updatePostLikeCounts(postId: string): Promise<void> {
    const likes = await db.select().from(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.isLike, true)));
    const dislikes = await db.select().from(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.isLike, false)));
    
    await db.update(posts)
      .set({ 
        likesCount: likes.length,
        dislikesCount: dislikes.length
      })
      .where(eq(posts.id, postId));
  }

  async createPostReport(report: InsertPostReport): Promise<PostReport> {
    const result = await db.insert(postReports).values(report).returning();
    return result[0];
  }

  async getPostReport(userId: string, postId: string): Promise<PostReport | undefined> {
    const result = await db.select().from(postReports)
      .where(and(eq(postReports.userId, userId), eq(postReports.postId, postId)))
      .limit(1);
    return result[0];
  }

  async createComment(comment: InsertComment, moderation?: { isFlagged: boolean; moderationScore: string; moderationReason: string; isHidden?: boolean }): Promise<Comment> {
    const commentData = moderation 
      ? { 
          ...comment, 
          isFlagged: moderation.isFlagged,
          moderationScore: moderation.moderationScore,
          moderationReason: moderation.moderationReason,
          isHidden: moderation.isHidden || false
        }
      : comment;
    
    const result = await db.insert(comments).values(commentData).returning();
    const allComments = await db.select().from(comments).where(eq(comments.postId, comment.postId));
    await db.update(posts)
      .set({ commentsCount: allComments.length })
      .where(eq(posts.id, comment.postId));
    return result[0];
  }

  async getCommentById(id: string): Promise<Comment | undefined> {
    const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return result[0];
  }

  async getCommentsByPostId(postId: string): Promise<Comment[]> {
    return await db.select().from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));
  }

  async getCommentsByAuthor(userId: string): Promise<Comment[]> {
    return await db.select().from(comments)
      .where(eq(comments.userId, userId))
      .orderBy(desc(comments.createdAt));
  }

  async getAllComments(): Promise<Comment[]> {
    return await db.select().from(comments).orderBy(desc(comments.createdAt));
  }

  async deleteComment(id: string): Promise<boolean> {
    const comment = await this.getCommentById(id);
    if (!comment) return false;
    
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    
    if (result.length > 0) {
      const remainingComments = await db.select().from(comments).where(eq(comments.postId, comment.postId));
      await db.update(posts)
        .set({ commentsCount: remainingComments.length })
        .where(eq(posts.id, comment.postId));
    }
    
    return result.length > 0;
  }

  async toggleCommentHidden(id: string, isHidden: boolean): Promise<Comment | undefined> {
    const result = await db.update(comments).set({ isHidden }).where(eq(comments.id, id)).returning();
    return result[0];
  }

  async toggleCommentLike(userId: string, commentId: string, isLike: boolean): Promise<{ action: 'added' | 'removed' | 'changed', commentLike?: CommentLike }> {
    const existing = await this.getCommentLike(userId, commentId);
    
    if (existing) {
      if (existing.isLike === isLike) {
        await db.delete(commentLikes).where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)));
        await this.updateCommentLikeCounts(commentId);
        return { action: 'removed' };
      } else {
        const result = await db.update(commentLikes)
          .set({ isLike })
          .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)))
          .returning();
        await this.updateCommentLikeCounts(commentId);
        return { action: 'changed', commentLike: result[0] };
      }
    } else {
      const result = await db.insert(commentLikes).values({ userId, commentId, isLike }).returning();
      await this.updateCommentLikeCounts(commentId);
      return { action: 'added', commentLike: result[0] };
    }
  }

  async getCommentLike(userId: string, commentId: string): Promise<CommentLike | undefined> {
    const result = await db.select().from(commentLikes)
      .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)))
      .limit(1);
    return result[0];
  }

  async updateCommentLikeCounts(commentId: string): Promise<void> {
    const likes = await db.select().from(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.isLike, true)));
    const dislikes = await db.select().from(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.isLike, false)));
    
    await db.update(comments)
      .set({ 
        likesCount: likes.length,
        dislikesCount: dislikes.length
      })
      .where(eq(comments.id, commentId));
  }

  async createCommentReport(report: InsertCommentReport): Promise<CommentReport> {
    const result = await db.insert(commentReports).values(report).returning();
    return result[0];
  }

  async getCommentReport(userId: string, commentId: string): Promise<CommentReport | undefined> {
    const result = await db.select().from(commentReports)
      .where(and(eq(commentReports.userId, userId), eq(commentReports.commentId, commentId)))
      .limit(1);
    return result[0];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getAiSettings(): Promise<AiSettings | undefined> {
    const result = await db.select().from(aiSettings).limit(1);
    return result[0];
  }

  async updateAiSettings(settings: InsertAiSettings): Promise<AiSettings | undefined> {
    const existing = await this.getAiSettings();
    if (existing) {
      const result = await db.update(aiSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(aiSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(aiSettings).values(settings).returning();
      return result[0];
    }
  }

  async createAuthorInfo(info: InsertAuthorInfo): Promise<AuthorInfo> {
    const result = await db.insert(authorInfo).values(info).returning();
    return result[0];
  }

  async getAuthorInfoList(): Promise<AuthorInfo[]> {
    return await db.select().from(authorInfo).orderBy(desc(authorInfo.createdAt));
  }

  async deleteAuthorInfo(id: string): Promise<boolean> {
    const result = await db.delete(authorInfo).where(eq(authorInfo.id, id)).returning();
    return result.length > 0;
  }

  async syncAllCommentCounts(): Promise<number> {
    const allPosts = await db.select({ id: posts.id }).from(posts);
    let updatedCount = 0;
    
    for (const post of allPosts) {
      const commentCount = await db.select({ count: sql<number>`count(*)` })
        .from(comments)
        .where(eq(comments.postId, post.id));
      
      const actualCount = Number(commentCount[0]?.count || 0);
      
      await db.update(posts)
        .set({ commentsCount: actualCount })
        .where(eq(posts.id, post.id));
      
      updatedCount++;
    }
    
    return updatedCount;
  }

  async createApiUsageLog(log: InsertApiUsageLog): Promise<ApiUsageLog> {
    const result = await db.insert(apiUsageLogs).values(log).returning();
    return result[0];
  }

  async getApiUsageLogs(startDate?: Date, endDate?: Date): Promise<ApiUsageLog[]> {
    if (startDate && endDate) {
      return await db.select().from(apiUsageLogs)
        .where(and(
          gte(apiUsageLogs.createdAt, startDate),
          lte(apiUsageLogs.createdAt, endDate)
        ))
        .orderBy(desc(apiUsageLogs.createdAt));
    }
    return await db.select().from(apiUsageLogs).orderBy(desc(apiUsageLogs.createdAt));
  }

  async getMonthlyApiUsageStats(year: number, month: number): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    byModel: Record<string, { calls: number; tokens: number; cost: number }>;
    byFunction: Record<string, { calls: number; tokens: number; cost: number }>;
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    const logs = await this.getApiUsageLogs(startDate, endDate);
    
    const modelStats: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const functionStats: Record<string, { calls: number; tokens: number; cost: number }> = {};
    let totalCalls = 0;
    let totalTokens = 0;
    let totalCost = 0;
    
    for (const log of logs) {
      totalCalls++;
      totalTokens += log.totalTokens;
      totalCost += parseFloat(log.totalCost);
      
      if (!modelStats[log.model]) {
        modelStats[log.model] = { calls: 0, tokens: 0, cost: 0 };
      }
      modelStats[log.model].calls++;
      modelStats[log.model].tokens += log.totalTokens;
      modelStats[log.model].cost += parseFloat(log.totalCost);
      
      if (!functionStats[log.functionName]) {
        functionStats[log.functionName] = { calls: 0, tokens: 0, cost: 0 };
      }
      functionStats[log.functionName].calls++;
      functionStats[log.functionName].tokens += log.totalTokens;
      functionStats[log.functionName].cost += parseFloat(log.totalCost);
    }
    
    return { totalCalls, totalTokens, totalCost, byModel: modelStats, byFunction: functionStats };
  }
}

export const storage = new DatabaseStorage();
