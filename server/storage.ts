import {
  users,
  content,
  settings,
  activityLog,
  type User,
  type UpsertUser,
  type Content,
  type InsertContent,
  type Settings,
  type InsertSettings,
  type ActivityLog,
  type InsertActivityLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Content operations
  getAllContent(): Promise<Content[]>;
  getContent(id: string): Promise<Content | undefined>;
  createContent(content: InsertContent): Promise<Content>;
  updateContent(id: string, content: Partial<InsertContent>): Promise<Content>;
  deleteContent(id: string): Promise<void>;
  
  // Settings operations
  getAllSettings(): Promise<Settings[]>;
  getSetting(key: string): Promise<Settings | undefined>;
  upsertSetting(setting: InsertSettings): Promise<Settings>;
  
  // Activity log operations
  getActivityLog(userId?: string): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUserById = userData.id ? await db.select().from(users).where(eq(users.id, userData.id)).limit(1) : [];
    const existingUserByEmail = userData.email ? await db.select().from(users).where(eq(users.email, userData.email)).limit(1) : [];
    
    const existingUser = existingUserById[0] || existingUserByEmail[0];
    
    if (existingUser) {
      const { role: _, ...userDataWithoutRole } = userData;
      const [updatedUser] = await db
        .update(users)
        .set({
          ...userDataWithoutRole,
          role: existingUser.role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updatedUser;
    } else {
      const [newUser] = await db
        .insert(users)
        .values(userData)
        .returning();
      return newUser;
    }
  }

  // Content operations
  async getAllContent(): Promise<Content[]> {
    return db.select().from(content).orderBy(desc(content.createdAt));
  }

  async getContent(id: string): Promise<Content | undefined> {
    const [item] = await db.select().from(content).where(eq(content.id, id));
    return item;
  }

  async createContent(contentData: InsertContent): Promise<Content> {
    const [item] = await db.insert(content).values(contentData).returning();
    return item;
  }

  async updateContent(id: string, contentData: Partial<InsertContent>): Promise<Content> {
    const [item] = await db
      .update(content)
      .set({ ...contentData, updatedAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    return item;
  }

  async deleteContent(id: string): Promise<void> {
    await db.delete(content).where(eq(content.id, id));
  }

  // Settings operations
  async getAllSettings(): Promise<Settings[]> {
    return db.select().from(settings);
  }

  async getSetting(key: string): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async upsertSetting(settingData: InsertSettings): Promise<Settings> {
    const [setting] = await db
      .insert(settings)
      .values(settingData)
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          ...settingData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return setting;
  }

  // Activity log operations
  async getActivityLog(userId?: string): Promise<ActivityLog[]> {
    if (userId) {
      return db
        .select()
        .from(activityLog)
        .where(eq(activityLog.userId, userId))
        .orderBy(desc(activityLog.createdAt))
        .limit(100);
    }
    return db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(100);
  }

  async createActivityLog(logData: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLog).values(logData).returning();
    return log;
  }
}

export const storage = new DatabaseStorage();
