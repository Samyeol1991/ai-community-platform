import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, loginUserSchema, insertPostSchema, 
  insertCommentSchema, insertPostReportSchema, insertCommentReportSchema,
  insertCategorySchema, insertSubcategorySchema, loginAdminSchema,
  insertAiSettingsSchema, insertAuthorInfoSchema,
  users, posts, categories, subcategories, admins, comments
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import cors from "cors";
import { checkContentModeration } from "./huggingface";
import { analyzePost, analyzeComment, testGPT51, analyzeCommentIntervention, generateInterventionResponse, generateAggressiveIntervention, generateBotReplyToUserComment, generateToxicPostModerationReply } from "./openai-utils";

// WebSocket 클라이언트 관리 (한 관리자가 여러 탭을 열 수 있으므로 Set으로 관리)
const adminClients = new Map<string, Set<WebSocket>>();

export function sendNotificationToAdmin(userId: string, notification: any) {
  const sockets = adminClients.get(userId);
  if (sockets) {
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'notification', data: notification }));
      }
    });
  }
}

const PgStore = connectPgSimple(session);

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      nickname?: string;
      email?: string;
      ageGroup?: string;
      role: string;
      avatar?: string | null;
      username?: string;
    }
  }
}

async function initializeAdminAccount() {
  const adminUsername = "admin";
  const existingAdmin = await storage.getAdminByUsername(adminUsername);
  
  if (!existingAdmin) {
    const hashedPassword = await crypto.hash("admin1234");
    await storage.createAdmin({
      username: adminUsername,
      password: hashedPassword,
      name: "관리자",
      email: "admin@example.com",
    });
    console.log("Admin account created successfully");
  }
}

async function getOrCreateBotAccount(botName: string, botEmail: string) {
  let bot = await storage.getUserByEmail(botEmail);
  
  if (!bot) {
    const hashedPassword = await crypto.hash(randomBytes(32).toString("hex"));
    bot = await storage.createUser({
      name: botName,
      nickname: botName,
      email: botEmail,
      password: hashedPassword,
      ageGroup: "20대"
    });
    console.log(`GPT Bot account created: ${botName} (${botEmail})`);
  }
  
  return bot;
}

async function getRandomBotAccount(): Promise<{ user: any; description: string | null }> {
  const authorInfos = await storage.getAuthorInfoList();
  
  if (authorInfos.length === 0) {
    console.log('[Bot Account] No author info found, using default');
    const user = await getOrCreateBotAccount("AI 도우미", "gpt-bot-default@ai-nexus.com");
    return { user, description: "친절하고 격려하는 AI 도우미" };
  }
  
  // 이름이 있는 작성자만 필터링
  const validAuthors = authorInfos.filter(a => a.name && a.name.trim().length > 0);
  
  if (validAuthors.length === 0) {
    console.log('[Bot Account] No valid author info found, using default');
    const user = await getOrCreateBotAccount("AI 도우미", "gpt-bot-default@ai-nexus.com");
    return { user, description: "친절하고 격려하는 AI 도우미" };
  }
  
  const randomAuthor = validAuthors[Math.floor(Math.random() * validAuthors.length)];
  const botEmail = `gpt-bot-${randomAuthor.id}@ai-nexus.com`;
  const user = await getOrCreateBotAccount(randomAuthor.name, botEmail);
  
  return { 
    user, 
    description: randomAuthor.description || "AI 커뮤니티 활성화를 돕는 작성자"
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  await initializeAdminAccount();

  app.set("trust proxy", 1);
  
  const isProduction = process.env.NODE_ENV === "production";
  
  // CORS 설정: credentials: true를 사용할 때는 origin을 명시해야 함
  app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['set-cookie'],
  }));
  
  app.use(
    session({
      store: new PgStore({
        conString: process.env.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "ai-nexus-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: "/",
      },
      name: "connect.sid",
      rolling: true,
      proxy: true,
    })
  );

  // Token-based authentication middleware for Replit webview compatibility
  // MUST run BEFORE passport.initialize() to restore session from token
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token && token !== 'null' && token !== 'undefined') {
        const sessionStore = req.sessionStore as any;
        if (sessionStore && sessionStore.get) {
          sessionStore.get(token, (err: any, sessionData: any) => {
            if (!err && sessionData) {
              // Restore the session with the token as session ID
              (req as any).sessionID = token;
              sessionStore.createSession(req, sessionData);
              console.log('[Token Auth] Session restored from token:', token.substring(0, 8) + '...');
            }
            next();
          });
          return;
        }
      }
    }
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "이메일 또는 비밀번호가 잘못되었습니다." });
          }
          const isMatch = await crypto.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: "이메일 또는 비밀번호가 잘못되었습니다." });
          }
          return done(null, {
            id: user.id,
            name: user.name,
            nickname: user.nickname,
            email: user.email,
            ageGroup: user.ageGroup,
            role: user.role,
            avatar: user.avatar,
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.use(
    'admin-local',
    new LocalStrategy(
      { usernameField: "username" },
      async (username, password, done) => {
        try {
          const admin = await storage.getAdminByUsername(username);
          if (!admin) {
            return done(null, false, { message: "아이디 또는 비밀번호가 잘못되었습니다." });
          }
          const isMatch = await crypto.compare(password, admin.password);
          if (!isMatch) {
            return done(null, false, { message: "아이디 또는 비밀번호가 잘못되었습니다." });
          }
          return done(null, {
            id: admin.id,
            name: admin.name,
            username: admin.username,
            email: admin.email || undefined,
            role: 'admin',
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    console.log('[SERIALIZE] Saving user to session:', user.id, 'Role:', user.role);
    done(null, `${user.role}:${user.id}`);
  });

  passport.deserializeUser(async (serialized: string, done) => {
    console.log('[DESERIALIZE] Loading from session:', serialized);
    try {
      const [role, id] = serialized.split(':');
      
      if (role === 'admin') {
        const admin = await storage.getAdmin(id);
        if (!admin) {
          console.log('[DESERIALIZE] Admin not found:', id);
          return done(null, false);
        }
        console.log('[DESERIALIZE] Admin loaded:', admin.username);
        done(null, {
          id: admin.id,
          name: admin.name,
          username: admin.username,
          email: admin.email || undefined,
          role: 'admin',
        });
      } else {
        const user = await storage.getUser(id);
        if (!user) {
          console.log('[DESERIALIZE] User not found:', id);
          return done(null, false);
        }
        console.log('[DESERIALIZE] User loaded:', user.email, 'Role:', user.role);
        done(null, {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          ageGroup: user.ageGroup,
          role: user.role,
          avatar: user.avatar,
        });
      }
    } catch (err) {
      console.log('[DESERIALIZE] Error:', err);
      done(err);
    }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: result.error.issues });
      }

      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(400).json({ message: "이미 사용 중인 이메일입니다." });
      }

      const existingNickname = await storage.getUserByNickname(result.data.nickname);
      if (existingNickname) {
        return res.status(400).json({ message: "이미 사용 중인 닉네임입니다." });
      }

      const hashedPassword = await crypto.hash(result.data.password);
      const user = await storage.createUser({
        ...result.data,
        password: hashedPassword,
      });

      req.login(
        {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          ageGroup: user.ageGroup,
          role: user.role,
          avatar: user.avatar,
        },
        (err) => {
          if (err) {
            return next(err);
          }
          req.session.save((saveErr) => {
            if (saveErr) {
              return next(saveErr);
            }
            return res.json({
              id: user.id,
              name: user.name,
              nickname: user.nickname,
              email: user.email,
              ageGroup: user.ageGroup,
              role: user.role,
              avatar: user.avatar,
              token: req.sessionID,
            });
          });
        }
      );
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const result = loginUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: result.error.issues });
    }

    passport.authenticate("local", (err: any, user: Express.User, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || "로그인에 실패했습니다." });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        req.session.save((saveErr) => {
          if (saveErr) {
            return next(saveErr);
          }
          console.log('[LOGIN] Session ID:', req.sessionID);
          console.log('[LOGIN] User:', req.user);
          console.log('[LOGIN] Session saved successfully');
          return res.json({ ...user, token: req.sessionID });
        });
      });
    })(req, res, next);
  });

  app.post("/api/admin/login", (req, res, next) => {
    const result = loginAdminSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: result.error.issues });
    }

    passport.authenticate("admin-local", (err: any, admin: Express.User, info: any) => {
      if (err) {
        return next(err);
      }
      if (!admin) {
        return res.status(401).json({ message: info.message || "로그인에 실패했습니다." });
      }
      req.login(admin, (err) => {
        if (err) {
          return next(err);
        }
        req.session.save((saveErr) => {
          if (saveErr) {
            return next(saveErr);
          }
          console.log('[ADMIN LOGIN] Session ID:', req.sessionID);
          console.log('[ADMIN LOGIN] Admin:', req.user);
          console.log('[ADMIN LOGIN] Session saved successfully');
          return res.json({ ...admin, token: req.sessionID });
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "로그아웃에 실패했습니다." });
      }
      res.json({ message: "로그아웃되었습니다." });
    });
  });

  app.post("/api/auth/verify-identity", async (req, res, next) => {
    try {
      const { email, name, ageGroup } = req.body;

      if (!email || !name || !ageGroup) {
        return res.status(400).json({ message: "이메일, 이름, 연령대를 모두 입력해주세요." });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "입력하신 정보와 일치하는 계정을 찾을 수 없습니다." });
      }

      if (user.name !== name || user.ageGroup !== ageGroup) {
        return res.status(404).json({ message: "입력하신 정보와 일치하는 계정을 찾을 수 없습니다." });
      }

      res.json({ userId: user.id, message: "본인 확인이 완료되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const { userId, newPassword } = req.body;

      if (!userId || !newPassword) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다." });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "비밀번호는 최소 6자 이상이어야 합니다." });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      const hashedPassword = await crypto.hash(newPassword);
      await storage.updateUserPassword(userId, hashedPassword);

      res.json({ message: "비밀번호가 성공적으로 변경되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", (req, res) => {
    console.log('[AUTH CHECK] Session ID:', req.sessionID);
    console.log('[AUTH CHECK] Session:', req.session);
    console.log('[AUTH CHECK] Cookies:', req.headers.cookie);
    console.log('[AUTH CHECK] Is authenticated:', req.isAuthenticated());
    
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    res.status(401).json({ message: "인증되지 않은 사용자입니다." });
  });

  app.put("/api/user/password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 입력해주세요." });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      const isMatch = await crypto.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "현재 비밀번호가 일치하지 않습니다." });
      }

      const hashedPassword = await crypto.hash(newPassword);
      await storage.updateUserPassword(user.id, hashedPassword);

      res.json({ message: "비밀번호가 변경되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/user/profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const { nickname } = req.body;

      if (!nickname || nickname.trim() === "") {
        return res.status(400).json({ message: "닉네임을 입력해주세요." });
      }

      // 닉네임 중복 확인
      const existingUser = await db.query.users.findFirst({
        where: (users, { eq, and, ne }) => and(
          eq(users.nickname, nickname.trim()),
          ne(users.id, req.user!.id)
        )
      });

      if (existingUser) {
        return res.status(409).json({ message: "이미 사용 중인 닉네임입니다." });
      }

      await db.update(users).set({ nickname: nickname.trim() }).where(eq(users.id, req.user!.id));

      const updatedUser = await storage.getUser(req.user!.id);

      res.json({
        id: updatedUser!.id,
        name: updatedUser!.name,
        nickname: updatedUser!.nickname,
        email: updatedUser!.email,
        ageGroup: updatedUser!.ageGroup,
        role: updatedUser!.role,
        avatar: updatedUser!.avatar,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/user/posts", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const postsData = await storage.getPostsByAuthor(req.user!.id);
      
      const postsWithAuthors = await Promise.all(
        postsData.map(async (post) => {
          const author = await storage.getUser(post.authorId);
          return {
            ...post,
            author: author ? {
              id: author.id,
              name: author.name,
              nickname: author.nickname,
              avatar: author.avatar,
            } : null,
          };
        })
      );

      res.json(postsWithAuthors);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/user/comments", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const commentsData = await storage.getCommentsByAuthor(req.user!.id);
      
      const commentsWithDetails = await Promise.all(
        commentsData.map(async (comment) => {
          const post = await storage.getPostById(comment.postId);
          const author = await storage.getUser(comment.userId);
          
          let parentComment = null;
          if (comment.parentCommentId) {
            const parent = await storage.getCommentById(comment.parentCommentId);
            if (parent) {
              const parentAuthor = await storage.getUser(parent.userId);
              parentComment = {
                id: parent.id,
                content: parent.content.substring(0, 50) + (parent.content.length > 50 ? '...' : ''),
                author: parentAuthor ? {
                  nickname: parentAuthor.nickname,
                  name: parentAuthor.name,
                } : null,
              };
            }
          }
          
          return {
            ...comment,
            isReply: !!comment.parentCommentId,
            parentComment,
            post: post ? {
              id: post.id,
              title: post.title,
              isHidden: post.isHidden,
            } : null,
            author: author ? {
              id: author.id,
              name: author.name,
              nickname: author.nickname,
              avatar: author.avatar,
            } : null,
          };
        })
      );

      res.json(commentsWithDetails);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts", async (req, res, next) => {
    try {
      const category = req.query.category as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 5;
      const offset = parseInt(req.query.offset as string) || 0;
      
      let postsData = await storage.getPosts(category);
      
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        postsData = postsData.filter(post => 
          post.title.toLowerCase().includes(searchLower) || 
          post.content.toLowerCase().includes(searchLower) ||
          (post.excerpt && post.excerpt.toLowerCase().includes(searchLower))
        );
      }
      
      // 정렬 처리
      if (sortBy === "popular") {
        // 인기순: 좋아요 많은 순 → 조회수 많은 순 → 최신순
        postsData.sort((a, b) => {
          if (b.likesCount !== a.likesCount) {
            return b.likesCount - a.likesCount;
          }
          if (b.viewCount !== a.viewCount) {
            return b.viewCount - a.viewCount;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      } else {
        // 기본값: 최신순
        postsData.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      
      // 페이지네이션 적용
      const total = postsData.length;
      const paginatedPosts = postsData.slice(offset, offset + limit);
      
      const postsWithAuthors = await Promise.all(
        paginatedPosts.map(async (post) => {
          const author = await storage.getUser(post.authorId);
          const actualComments = await storage.getCommentsByPostId(post.id);
          return {
            ...post,
            commentsCount: actualComments.length,
            author: author ? {
              id: author.id,
              name: author.name,
              nickname: author.nickname,
              avatar: author.avatar,
            } : null,
          };
        })
      );

      res.json({
        posts: postsWithAuthors,
        total,
        hasMore: offset + limit < total,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts/:id", async (req, res, next) => {
    try {
      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      // 일반 사용자는 숨겨진 게시물을 볼 수 없음 (관리자는 가능)
      const isAdmin = req.isAuthenticated() && req.user?.role === "admin";
      if (post.isHidden && !isAdmin) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      // 조회수 증가
      await storage.incrementPostView(req.params.id);

      // 증가된 viewCount를 반영하기 위해 다시 조회
      const updatedPost = await storage.getPostById(req.params.id);
      if (!updatedPost) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      const author = await storage.getUser(updatedPost.authorId);
      res.json({
        ...updatedPost,
        author: author ? {
          id: author.id,
          name: author.name,
          nickname: author.nickname,
          avatar: author.avatar,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/analyze", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      console.log(`[GPT Analyze] Analyzing post ${post.id}: "${post.title}"`);
      const analysis = await analyzePost(post.title, post.content, post.category || '일반');
      console.log(`[GPT Analyze] Analysis result:`, analysis);

      res.json(analysis);
    } catch (error) {
      console.error('[GPT Analyze Error]', error);
      next(error);
    }
  });

  app.get("/api/test/gpt51", async (req, res, next) => {
    try {
      console.log("[GPT-5.1 Test] Testing GPT-5.1 connection...");
      const result = await testGPT51();
      console.log("[GPT-5.1 Test] Result:", result);
      res.json(result);
    } catch (error: any) {
      console.error("[GPT-5.1 Test] Error:", error);
      next(error);
    }
  });

  app.post("/api/comments/:id/analyze", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const comment = await storage.getCommentById(req.params.id);
      if (!comment) {
        return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      }

      const post = await storage.getPostById(comment.postId);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      let parentCommentContent;
      if (comment.parentCommentId) {
        const parentComment = await storage.getCommentById(comment.parentCommentId);
        parentCommentContent = parentComment?.content;
      }

      console.log(`[GPT Analyze] Analyzing comment ${comment.id} on post "${post.title}"`);
      const analysis = await analyzeComment(
        post.title,
        post.content,
        comment.content,
        parentCommentContent
      );
      console.log(`[GPT Analyze] Analysis result:`, analysis);

      res.json(analysis);
    } catch (error) {
      console.error('[GPT Analyze Error]', error);
      next(error);
    }
  });

  app.post("/api/posts", async (req, res, next) => {
    try {
      console.log('[POST /api/posts] Request received');
      console.log('[POST /api/posts] Session ID:', req.sessionID);
      console.log('[POST /api/posts] isAuthenticated:', req.isAuthenticated());
      
      if (!req.isAuthenticated()) {
        console.log('[POST /api/posts] User not authenticated');
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      console.log('[POST /api/posts] Validating request data...');
      const result = insertPostSchema.safeParse({
        ...req.body,
        authorId: req.user!.id,
      });

      if (!result.success) {
        console.log('[POST /api/posts] Validation failed:', result.error.issues);
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: result.error.issues });
      }

      console.log('[POST /api/posts] Creating post immediately (moderation will run async)...');
      const post = await storage.createPost(result.data);
      console.log('[POST /api/posts] Post created:', post.id);
      
      const author = await storage.getUser(post.authorId);

      console.log('[POST /api/posts] Sending response immediately...');
      res.status(201).json({
        ...post,
        author: author ? {
          id: author.id,
          name: author.name,
          avatar: author.avatar,
        } : null,
      });

      // 비동기로 모더레이션 체크 및 후속 처리 (응답 후 실행)
      setImmediate(async () => {
        try {
          console.log(`[Async Moderation] Starting moderation check for post ${post.id}...`);
          const contentToCheck = `${post.title}\n${post.content}`;
          
          let moderation;
          try {
            moderation = await checkContentModeration(contentToCheck);
            console.log(`[Async Moderation] Moderation check complete for post ${post.id}:`, moderation);
          } catch (moderationError) {
            console.error(`[Async Moderation] Moderation check failed for post ${post.id}:`, moderationError);
            moderation = {
              isFlagged: false,
              moderationScore: '0',
              moderationReason: 'Moderation check failed'
            };
          }

          let aiSettings;
          try {
            aiSettings = await storage.getAiSettings();
          } catch (settingsError) {
            console.error('[Async Moderation] Failed to load AI settings:', settingsError);
            aiSettings = null;
          }
          const threshold = aiSettings ? aiSettings.postThreshold / 100 : 0.9;

          const shouldAutoHide = moderation.isFlagged && parseFloat(moderation.moderationScore) >= threshold;

          // 모더레이션 결과로 게시물 업데이트
          await db.update(posts)
            .set({
              isFlagged: moderation.isFlagged,
              moderationScore: moderation.moderationScore,
              moderationReason: moderation.moderationReason,
              isHidden: shouldAutoHide,
            })
            .where(eq(posts.id, post.id));
          console.log(`[Async Moderation] Post ${post.id} updated with moderation results`);

          // 자동 숨김 처리된 경우 관리자에게 알림 및 GPT-5.1 중재 답글 생성
          if (shouldAutoHide) {
            const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
            
            for (const admin of adminUsers) {
              const notification = await storage.createNotification({
                userId: admin.id,
                type: "auto_hide",
                title: "악성 게시물 자동 숨김",
                message: `게시물 "${post.title}"이(가) 악성 콘텐츠로 감지되어 자동으로 숨김 처리되었습니다. (확률: ${(parseFloat(moderation.moderationScore) * 100).toFixed(1)}%)`,
                postId: post.id,
              });
              
              sendNotificationToAdmin(admin.id, notification);
            }

            // GPT-5.1로 갈등 완화를 위한 중재 답글 생성
            try {
              console.log(`[Moderation Reply] Generating moderation reply for toxic post ${post.id}...`);
              const botInfo = await getRandomBotAccount();
              
              const moderationReply = await generateToxicPostModerationReply(
                post.title,
                post.content,
                parseFloat(moderation.moderationScore),
                moderation.moderationReason,
                botInfo.description || undefined
              );

              if (moderationReply) {
                await storage.createComment({
                  postId: post.id,
                  userId: botInfo.user.id,
                  content: moderationReply,
                  parentCommentId: null
                });
                console.log(`[Moderation Reply] Moderation reply created successfully by ${botInfo.user.nickname}`);
              } else {
                console.log(`[Moderation Reply] Failed to generate moderation reply for post ${post.id}`);
              }
            } catch (replyError) {
              console.error('[Moderation Reply Error]', replyError);
            }
          }

          // 10초 후 GPT 자동 댓글 생성 (유해하지 않은 정상 게시글만)
          if (!shouldAutoHide) {
            setTimeout(async () => {
              try {
                console.log(`[Auto Comment] Analyzing post ${post.id} after 10s delay...`);
                const postDetails = await storage.getPostById(post.id);
                if (!postDetails) {
                  console.log(`[Auto Comment] Post ${post.id} not found, skipping`);
                  return;
                }
              
              let categoryName = "기타";
              if (postDetails.categoryId) {
                const categoryResult = await db.select().from(categories).where(eq(categories.id, postDetails.categoryId)).limit(1);
                categoryName = categoryResult[0]?.name || "기타";
              }
              
              const botInfo = await getRandomBotAccount();
              console.log(`[Auto Comment] Selected bot: ${botInfo.user.nickname} with persona: ${botInfo.description}`);
              
              const analysis = await analyzePost(post.title, post.content, categoryName, botInfo.description || undefined);
              
              if (analysis.shouldComment && analysis.comment) {
                console.log(`[Auto Comment] Creating AI comment for post ${post.id} using bot: ${botInfo.user.nickname}`);
                await storage.createComment({
                  postId: post.id,
                  userId: botInfo.user.id,
                  content: analysis.comment,
                  parentCommentId: null
                });
                console.log(`[Auto Comment] AI comment created successfully by ${botInfo.user.nickname}`);
              } else {
                console.log(`[Auto Comment] No comment needed. Reason: ${analysis.reason}`);
              }
              } catch (error) {
                console.error('[Auto Comment Error]', error);
              }
            }, 10000);
          }

        } catch (error) {
          console.error('[Async Moderation Error]', error);
        }
      });

    } catch (error) {
      console.error('[POST /api/posts] Error:', error);
      console.error('[POST /api/posts] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      next(error);
    }
  });

  app.patch("/api/posts/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      if (post.authorId !== req.user!.id) {
        return res.status(403).json({ message: "권한이 없습니다." });
      }

      const updatedPost = await storage.updatePost(req.params.id, req.body);
      const author = await storage.getUser(updatedPost!.authorId);

      res.json({
        ...updatedPost,
        author: author ? {
          id: author.id,
          name: author.name,
          avatar: author.avatar,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/posts/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      if (post.authorId !== req.user!.id) {
        return res.status(403).json({ message: "권한이 없습니다." });
      }

      await storage.deletePost(req.params.id);
      res.json({ message: "게시물이 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/check-moderation", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "관리자 권한이 필요합니다." });
      }

      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      const contentToCheck = `${post.title}\n${post.content}`;
      const moderation = await checkContentModeration(contentToCheck);

      await db.update(posts)
        .set({
          isFlagged: moderation.isFlagged,
          moderationScore: moderation.moderationScore,
          moderationReason: moderation.moderationReason,
        })
        .where(eq(posts.id, req.params.id));

      const updatedPost = await storage.getPostById(req.params.id);
      res.json(updatedPost);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/like", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      if (post.authorId === req.user!.id) {
        return res.status(403).json({ message: "본인 게시물에는 좋아요/싫어요를 할 수 없습니다." });
      }

      const { isLike } = req.body;
      if (typeof isLike !== 'boolean') {
        return res.status(400).json({ message: "유효하지 않은 요청입니다." });
      }

      const result = await storage.togglePostLike(req.user!.id, req.params.id, isLike);
      const updatedPost = await storage.getPostById(req.params.id);

      res.json({
        action: result.action,
        post: updatedPost,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts/:id/like", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.json({ liked: null });
      }

      const like = await storage.getPostLike(req.user!.id, req.params.id);
      res.json({ liked: like ? like.isLike : null });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/report", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      if (post.authorId === req.user!.id) {
        return res.status(403).json({ message: "본인 게시물은 신고할 수 없습니다." });
      }

      const existingReport = await storage.getPostReport(req.user!.id, req.params.id);
      if (existingReport) {
        return res.status(400).json({ message: "이미 신고한 게시물입니다." });
      }

      const result = insertPostReportSchema.safeParse({
        userId: req.user!.id,
        postId: req.params.id,
        reason: req.body.reason,
      });

      if (!result.success) {
        return res.status(400).json({ message: "신고 내용을 입력해주세요.", errors: result.error.issues });
      }

      await storage.createPostReport(result.data);
      res.json({ message: "신고가 접수되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts/:id/comments", async (req, res, next) => {
    try {
      const allComments = await storage.getCommentsByPostId(req.params.id);
      
      // 일반 사용자는 숨겨진 댓글을 볼 수 없음 (관리자는 가능)
      const isAdmin = req.isAuthenticated() && req.user?.role === "admin";
      const comments = isAdmin ? allComments : allComments.filter(comment => !comment.isHidden);
      
      const commentsWithAuthors = await Promise.all(
        comments.map(async (comment) => {
          const author = await storage.getUser(comment.userId);
          let userLike = null;
          if (req.isAuthenticated()) {
            const like = await storage.getCommentLike(req.user!.id, comment.id);
            userLike = like ? like.isLike : null;
          }
          return {
            ...comment,
            author: author ? {
              id: author.id,
              nickname: author.nickname,
              avatar: author.avatar,
            } : null,
            userLike,
          };
        })
      );

      res.json(commentsWithAuthors);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:id/comments", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const post = await storage.getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      const result = insertCommentSchema.safeParse({
        postId: req.params.id,
        userId: req.user!.id,
        content: req.body.content,
        parentCommentId: req.body.parentCommentId || null,
      });

      if (!result.success) {
        return res.status(400).json({ message: "댓글 내용을 입력해주세요.", errors: result.error.issues });
      }

      console.log('[POST /api/comments] Creating comment immediately (moderation will run async)...');
      const comment = await storage.createComment(result.data);
      const author = await storage.getUser(comment.userId);

      console.log('[POST /api/comments] Sending response immediately...');
      res.status(201).json({
        ...comment,
        author: author ? {
          id: author.id,
          nickname: author.nickname,
          avatar: author.avatar,
        } : null,
      });

      // 비동기로 모더레이션 체크 및 후속 처리 (응답 후 실행)
      setImmediate(async () => {
        try {
          console.log(`[Async Comment Moderation] Starting moderation check for comment ${comment.id}...`);
          
          let moderation;
          try {
            moderation = await checkContentModeration(result.data.content);
            console.log(`[Async Comment Moderation] Moderation check complete for comment ${comment.id}:`, moderation);
          } catch (moderationError) {
            console.error(`[Async Comment Moderation] Moderation check failed for comment ${comment.id}:`, moderationError);
            moderation = {
              isFlagged: false,
              moderationScore: '0',
              moderationReason: 'Moderation check failed'
            };
          }

          let aiSettings;
          try {
            aiSettings = await storage.getAiSettings();
          } catch (settingsError) {
            console.error('[Async Comment Moderation] Failed to load AI settings:', settingsError);
            aiSettings = null;
          }
          const threshold = aiSettings ? aiSettings.commentThreshold / 100 : 0.9;

          const shouldAutoHide = moderation.isFlagged && parseFloat(moderation.moderationScore) >= threshold;

          // 모더레이션 결과로 댓글 업데이트
          await db.update(comments)
            .set({
              isFlagged: moderation.isFlagged,
              moderationScore: moderation.moderationScore,
              moderationReason: moderation.moderationReason,
              isHidden: shouldAutoHide,
            })
            .where(eq(comments.id, comment.id));
          console.log(`[Async Comment Moderation] Comment ${comment.id} updated with moderation results`);

          // 자동 숨김 처리된 경우 관리자에게 알림
          if (shouldAutoHide) {
            const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
            
            for (const admin of adminUsers) {
              const notification = await storage.createNotification({
                userId: admin.id,
                type: "auto_hide_comment",
                title: "악성 댓글 자동 숨김",
                message: `댓글이 악성 콘텐츠로 감지되어 자동으로 숨김 처리되었습니다. (확률: ${(parseFloat(moderation.moderationScore) * 100).toFixed(1)}%)`,
                postId: comment.postId,
              });
              
              sendNotificationToAdmin(admin.id, notification);
            }
          }

          // AI 개입 프로세스 (모더레이션 후 2초 대기)
          setTimeout(async () => {
            try {
              const toxicityScore = parseFloat(moderation.moderationScore);
              const isToxic = moderation.isFlagged;
              const isAutoHidden = shouldAutoHide;
              
              console.log(`[AI Intervention] Processing comment ${comment.id}`);
              console.log(`[AI Intervention] Toxicity: ${(toxicityScore * 100).toFixed(1)}%, Flagged: ${isToxic}, Auto-hidden: ${isAutoHidden}`);
              
              // 1단계: 악성 콘텐츠이고 숨김 처리 안된 경우 → 강력한 개입
              if (isToxic && !isAutoHidden) {
                console.log(`[AI Intervention] Toxic content detected but not hidden, generating aggressive intervention...`);
                
                const botInfo = await getRandomBotAccount();
                const aggressiveResponse = await generateAggressiveIntervention(
                  post.title,
                  comment.content,
                  toxicityScore,
                  botInfo.description || undefined
                );
                
                if (aggressiveResponse) {
                  console.log(`[AI Intervention] Creating aggressive intervention reply for comment ${comment.id}`);
                  await storage.createComment({
                    postId: comment.postId,
                    userId: botInfo.user.id,
                    content: aggressiveResponse,
                    parentCommentId: comment.id
                  });
                  console.log(`[AI Intervention] Aggressive intervention created by ${botInfo.user.nickname}`);
                }
                return;
              }
              
              // 2단계: 악성 콘텐츠가 아닌 경우 → GPT-4o-mini로 개입 필요성 분석
              if (!isToxic) {
                console.log(`[AI Intervention] Analyzing intervention need with GPT-4o-mini...`);
                
                let parentCommentContent;
                if (comment.parentCommentId) {
                  const parentComment = await storage.getCommentById(comment.parentCommentId);
                  parentCommentContent = parentComment?.content;
                }
                
                const interventionAnalysis = await analyzeCommentIntervention(
                  post.title,
                  post.content,
                  comment.content,
                  author?.nickname || author?.name || "익명",
                  !!comment.parentCommentId,
                  parentCommentContent
                );
                
                console.log(`[AI Intervention] Analysis: needsIntervention=${interventionAnalysis.needsIntervention}, actionLevel=${interventionAnalysis.actionLevel}, contentType=${interventionAnalysis.contentType}`);
                console.log(`[AI Intervention] Reason: ${interventionAnalysis.reason}`);
                
                // 3단계: 개입 필요한 경우 → GPT-5.1로 답글 생성
                if (interventionAnalysis.needsIntervention && interventionAnalysis.actionLevel !== "none") {
                  console.log(`[AI Intervention] Generating intervention response with GPT-5.1...`);
                  
                  const botInfo = await getRandomBotAccount();
                  const interventionResponse = await generateInterventionResponse(
                    post.title,
                    comment.content,
                    interventionAnalysis.actionLevel,
                    interventionAnalysis.reason,
                    botInfo.description || undefined,
                    parentCommentContent
                  );
                  
                  if (interventionResponse) {
                    console.log(`[AI Intervention] Creating intervention reply for comment ${comment.id}`);
                    await storage.createComment({
                      postId: comment.postId,
                      userId: botInfo.user.id,
                      content: interventionResponse,
                      parentCommentId: comment.id
                    });
                    console.log(`[AI Intervention] Intervention response created by ${botInfo.user.nickname} (Action: ${interventionAnalysis.actionLevel})`);
                  } else {
                    console.log(`[AI Intervention] Failed to generate intervention response`);
                  }
                } else {
                  console.log(`[AI Intervention] No intervention needed.`);
                }
              }
            } catch (error) {
              console.error('[AI Intervention Error]', error);
            }
          }, 2000);

          // AI 봇 댓글에 대한 답글인지 확인하고 화답 생성
          if (comment.parentCommentId) {
            setTimeout(async () => {
              try {
                const parentComment = await storage.getCommentById(comment.parentCommentId!);
                if (!parentComment) {
                  console.log(`[Bot Reply] Parent comment not found for ${comment.id}`);
                  return;
                }

                const parentAuthor = await storage.getUser(parentComment.userId);
                if (!parentAuthor) {
                  console.log(`[Bot Reply] Parent author not found`);
                  return;
                }

                const isBotComment = parentAuthor.email.startsWith('gpt-bot-');
                
                if (isBotComment) {
                  console.log(`[Bot Reply] User replied to bot comment ${parentComment.id}, generating response...`);
                  
                  const authorInfos = await storage.getAuthorInfoList();
                  const botAuthorInfo = authorInfos.find(ai => ai.name === parentAuthor.nickname);
                  
                  const botReply = await generateBotReplyToUserComment(
                    post.title,
                    parentComment.content,
                    comment.content,
                    botAuthorInfo?.description || undefined
                  );
                  
                  if (botReply) {
                    console.log(`[Bot Reply] Creating bot reply to user comment ${comment.id}`);
                    await storage.createComment({
                      postId: comment.postId,
                      userId: parentAuthor.id,
                      content: botReply,
                      parentCommentId: comment.id
                    });
                    console.log(`[Bot Reply] Bot reply created successfully by ${parentAuthor.nickname}`);
                  } else {
                    console.log(`[Bot Reply] Failed to generate bot reply`);
                  }
                }
              } catch (error) {
                console.error('[Bot Reply Error]', error);
              }
            }, 3000);
          }

        } catch (error) {
          console.error('[Async Comment Moderation Error]', error);
        }
      });

    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/comments/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const comment = await storage.getCommentById(req.params.id);
      if (!comment) {
        return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      }

      if (comment.userId !== req.user!.id) {
        return res.status(403).json({ message: "권한이 없습니다." });
      }

      await storage.deleteComment(req.params.id);
      res.json({ message: "댓글이 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments/:id/like", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const comment = await storage.getCommentById(req.params.id);
      if (!comment) {
        return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      }

      if (comment.userId === req.user!.id) {
        return res.status(403).json({ message: "본인 댓글에는 좋아요/싫어요를 할 수 없습니다." });
      }

      const { isLike } = req.body;
      if (typeof isLike !== 'boolean') {
        return res.status(400).json({ message: "유효하지 않은 요청입니다." });
      }

      const result = await storage.toggleCommentLike(req.user!.id, req.params.id, isLike);
      const updatedComment = await storage.getCommentById(req.params.id);

      res.json({
        action: result.action,
        comment: updatedComment,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments/:id/report", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const comment = await storage.getCommentById(req.params.id);
      if (!comment) {
        return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      }

      if (comment.userId === req.user!.id) {
        return res.status(403).json({ message: "본인 댓글은 신고할 수 없습니다." });
      }

      const existingReport = await storage.getCommentReport(req.user!.id, req.params.id);
      if (existingReport) {
        return res.status(400).json({ message: "이미 신고한 댓글입니다." });
      }

      const result = insertCommentReportSchema.safeParse({
        userId: req.user!.id,
        commentId: req.params.id,
        reason: req.body.reason,
      });

      if (!result.success) {
        return res.status(400).json({ message: "신고 내용을 입력해주세요.", errors: result.error.issues });
      }

      await storage.createCommentReport(result.data);
      res.json({ message: "신고가 접수되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  const isAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "관리자 권한이 필요합니다." });
    }
    next();
  };

  app.get("/api/admin/users", isAdmin, async (req, res, next) => {
    try {
      const allUsers = await db.select().from(users);
      const usersWithoutPassword = allUsers.map(({ password, ...user }) => user);
      res.json(usersWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  const updateUserSchema = z.object({
    name: z.string().transform(v => v.trim()).pipe(z.string().min(1, "이름을 입력해주세요.")).optional(),
    nickname: z.string().transform(v => v.trim()).pipe(z.string().min(1, "닉네임을 입력해주세요.")).optional(),
  }).refine((data: { name?: string; nickname?: string }) => data.name !== undefined || data.nickname !== undefined, {
    message: "수정할 정보를 입력해주세요.",
  });

  app.patch("/api/admin/users/:id", isAdmin, async (req, res, next) => {
    try {
      const validation = updateUserSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: validation.error.errors[0]?.message || "유효하지 않은 입력입니다." 
        });
      }

      const { name, nickname } = validation.data;
      
      const updates: { name?: string; nickname?: string } = {};
      
      if (name !== undefined) {
        updates.name = name;
      }
      
      if (nickname !== undefined) {
        updates.nickname = nickname;
        
        const existingUser = await storage.getUserByNickname(nickname);
        if (existingUser && existingUser.id !== req.params.id) {
          return res.status(400).json({ message: "이미 사용 중인 닉네임입니다." });
        }
      }

      const updatedUser = await storage.updateUser(req.params.id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      res.json({ message: "사용자 정보가 수정되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/users/:id/role", isAdmin, async (req, res, next) => {
    try {
      const { role } = req.body;
      if (role !== "user" && role !== "admin") {
        return res.status(400).json({ message: "유효하지 않은 역할입니다." });
      }

      await db.update(users).set({ role }).where(eq(users.id, req.params.id));
      res.json({ message: "역할이 변경되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/users/:id", isAdmin, async (req, res, next) => {
    try {
      if (req.params.id === req.user!.id) {
        return res.status(400).json({ message: "본인 계정은 삭제할 수 없습니다." });
      }
      await db.delete(users).where(eq(users.id, req.params.id));
      res.json({ message: "사용자가 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/posts", isAdmin, async (req, res, next) => {
    try {
      const allPosts = await db
        .select({
          id: posts.id,
          title: posts.title,
          excerpt: posts.excerpt,
          content: posts.content,
          category: posts.category,
          tags: posts.tags,
          authorId: posts.authorId,
          likesCount: posts.likesCount,
          dislikesCount: posts.dislikesCount,
          commentsCount: posts.commentsCount,
          moderationScore: posts.moderationScore,
          moderationReason: posts.moderationReason,
          isFlagged: posts.isFlagged,
          isHidden: posts.isHidden,
          createdAt: posts.createdAt,
          author: {
            id: users.id,
            name: users.name,
            nickname: users.nickname,
          },
        })
        .from(posts)
        .leftJoin(users, eq(posts.authorId, users.id))
        .orderBy(desc(posts.createdAt));
      
      const postsWithActualCounts = await Promise.all(
        allPosts.map(async (post) => {
          const actualComments = await storage.getCommentsByPostId(post.id);
          return {
            ...post,
            commentsCount: actualComments.length,
          };
        })
      );
      
      res.json(postsWithActualCounts);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/posts/:id", isAdmin, async (req, res, next) => {
    try {
      await storage.deletePost(req.params.id);
      res.json({ message: "게시물이 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/posts/:id/hidden", isAdmin, async (req, res, next) => {
    try {
      const { isHidden } = req.body;
      if (typeof isHidden !== "boolean") {
        return res.status(400).json({ message: "유효하지 않은 요청입니다." });
      }

      const updatedPost = await storage.togglePostHidden(req.params.id, isHidden);
      if (!updatedPost) {
        return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
      }

      res.json({ message: isHidden ? "게시물이 숨김 처리되었습니다." : "게시물이 표시되었습니다.", post: updatedPost });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/flagged-posts", isAdmin, async (req, res, next) => {
    try {
      const flaggedPosts = await storage.getFlaggedPosts();
      const postsWithAuthors = await Promise.all(
        flaggedPosts.map(async (post) => {
          const author = await storage.getUser(post.authorId);
          return {
            ...post,
            author: author ? {
              id: author.id,
              name: author.name,
              nickname: author.nickname,
              avatar: author.avatar,
            } : null,
          };
        })
      );
      res.json(postsWithAuthors);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/comments", isAdmin, async (req, res, next) => {
    try {
      const allComments = await storage.getAllComments();
      const commentsWithDetails = await Promise.all(
        allComments.map(async (comment) => {
          const author = await storage.getUser(comment.userId);
          const post = await storage.getPostById(comment.postId);
          return {
            ...comment,
            author: author ? {
              id: author.id,
              name: author.name,
              nickname: author.nickname,
              avatar: author.avatar,
            } : null,
            post: post ? {
              id: post.id,
              title: post.title,
            } : null,
          };
        })
      );
      res.json(commentsWithDetails);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/comments/:id", isAdmin, async (req, res, next) => {
    try {
      await storage.deleteComment(req.params.id);
      res.json({ message: "댓글이 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/comments/:id/hidden", isAdmin, async (req, res, next) => {
    try {
      const { isHidden } = req.body;
      if (typeof isHidden !== "boolean") {
        return res.status(400).json({ message: "유효하지 않은 요청입니다." });
      }

      const updatedComment = await storage.toggleCommentHidden(req.params.id, isHidden);
      if (!updatedComment) {
        return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      }

      res.json({ message: isHidden ? "댓글이 숨김 처리되었습니다." : "댓글이 표시되었습니다.", comment: updatedComment });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/stats", isAdmin, async (req, res, next) => {
    try {
      const allUsers = await db.select().from(users);
      const allPosts = await db.select().from(posts);
      const allComments = await storage.getAllComments();
      res.json({
        totalUsers: allUsers.length,
        totalPosts: allPosts.length,
        totalComments: allComments.length,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/sync-comment-counts", isAdmin, async (req, res, next) => {
    try {
      const updatedCount = await storage.syncAllCommentCounts();
      res.json({ message: `${updatedCount}개 게시글의 댓글 수가 동기화되었습니다.`, updatedCount });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/categories", isAdmin, async (req, res, next) => {
    try {
      const allCategories = await db.select().from(categories);
      const categoriesWithSubs = await Promise.all(
        allCategories.map(async (category) => {
          const subs = await db.select().from(subcategories).where(eq(subcategories.categoryId, category.id));
          return { ...category, subcategories: subs };
        })
      );
      res.json(categoriesWithSubs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/categories", isAdmin, async (req, res, next) => {
    try {
      const result = insertCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "유효하지 않은 데이터입니다.", errors: result.error.issues });
      }
      const [category] = await db.insert(categories).values(result.data).returning();
      res.json(category);
    } catch (error: any) {
      if (error.code === '23505') {
        if (error.message.includes('categories_name_key')) {
          return res.status(400).json({ message: "이미 존재하는 카테고리 이름입니다." });
        }
        if (error.message.includes('categories_slug_key')) {
          return res.status(400).json({ message: "이미 존재하는 슬러그입니다." });
        }
      }
      next(error);
    }
  });

  app.put("/api/admin/categories/:id", isAdmin, async (req, res, next) => {
    try {
      const { name, slug, tags, order } = req.body;
      
      // slug 중복 검사 (자기 자신 제외)
      const existingCategory = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      
      if (existingCategory.length > 0 && existingCategory[0].id !== req.params.id) {
        return res.status(400).json({ 
          message: `이미 존재하는 slug입니다: ${slug}. 다른 이름을 사용해주세요.` 
        });
      }
      
      await db.update(categories).set({ name, slug, tags, order }).where(eq(categories.id, req.params.id));
      res.json({ message: "카테고리가 수정되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/categories/:id", isAdmin, async (req, res, next) => {
    try {
      await db.delete(categories).where(eq(categories.id, req.params.id));
      res.json({ message: "카테고리가 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/subcategories", isAdmin, async (req, res, next) => {
    try {
      const result = insertSubcategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "유효하지 않은 데이터입니다.", errors: result.error.issues });
      }
      
      // slug 중복 검사
      const existingSubcategory = await db
        .select()
        .from(subcategories)
        .where(eq(subcategories.slug, result.data.slug))
        .limit(1);
      
      if (existingSubcategory.length > 0) {
        return res.status(400).json({ 
          message: `이미 존재하는 slug입니다: ${result.data.slug}. 다른 이름을 사용하거나 기존 카테고리를 수정해주세요.` 
        });
      }
      
      const [subcategory] = await db.insert(subcategories).values(result.data).returning();
      res.json(subcategory);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/subcategories/:id", isAdmin, async (req, res, next) => {
    try {
      const { name, slug, tags, order } = req.body;
      
      // slug 중복 검사 (자기 자신 제외)
      const existingSubcategory = await db
        .select()
        .from(subcategories)
        .where(eq(subcategories.slug, slug))
        .limit(1);
      
      if (existingSubcategory.length > 0 && existingSubcategory[0].id !== req.params.id) {
        return res.status(400).json({ 
          message: `이미 존재하는 slug입니다: ${slug}. 다른 이름을 사용해주세요.` 
        });
      }
      
      await db.update(subcategories).set({ name, slug, tags, order }).where(eq(subcategories.id, req.params.id));
      res.json({ message: "소카테고리가 수정되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/subcategories/:id", isAdmin, async (req, res, next) => {
    try {
      await db.delete(subcategories).where(eq(subcategories.id, req.params.id));
      res.json({ message: "소카테고리가 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/categories", async (req, res, next) => {
    try {
      const allCategories = await db.select().from(categories);
      const categoriesWithSubs = await Promise.all(
        allCategories.map(async (category) => {
          const subs = await db.select().from(subcategories).where(eq(subcategories.categoryId, category.id));
          return { ...category, subcategories: subs };
        })
      );
      res.json(categoriesWithSubs);
    } catch (error) {
      next(error);
    }
  });

  // 알림 관련 API
  app.get("/api/notifications", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const notifications = await storage.getNotificationsByUserId(req.user!.id);
      res.json(notifications);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/notifications/unread", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const notifications = await storage.getUnreadNotificationsByUserId(req.user!.id);
      res.json(notifications);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const notification = await storage.markNotificationAsRead(req.params.id);
      res.json(notification);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/notifications/read-all", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      await storage.markAllNotificationsAsRead(req.user!.id);
      res.json({ message: "모든 알림을 읽음 처리했습니다." });
    } catch (error) {
      next(error);
    }
  });

  // AI 설정 관련 API
  app.get("/api/admin/ai-settings", isAdmin, async (req, res, next) => {
    try {
      const settings = await storage.getAiSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/ai-settings", isAdmin, async (req, res, next) => {
    try {
      const result = insertAiSettingsSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "잘못된 입력입니다.", errors: result.error.issues });
      }

      const settings = await storage.updateAiSettings(result.data);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // 작성자 정보 관련 API
  app.get("/api/admin/author-info", isAdmin, async (req, res, next) => {
    try {
      const authorInfoList = await storage.getAuthorInfoList();
      res.json(authorInfoList);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/author-info", isAdmin, async (req, res, next) => {
    try {
      const result = insertAuthorInfoSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "잘못된 입력입니다.", errors: result.error.issues });
      }

      const authorInfo = await storage.createAuthorInfo(result.data);
      res.json(authorInfo);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/author-info/:id", isAdmin, async (req, res, next) => {
    try {
      const success = await storage.deleteAuthorInfo(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "작성자 정보를 찾을 수 없습니다." });
      }
      res.json({ message: "작성자 정보가 삭제되었습니다." });
    } catch (error) {
      next(error);
    }
  });

  // GPT 비용 API
  app.get("/api/admin/gpt-usage/monthly", isAdmin, async (req, res, next) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      
      const stats = await storage.getMonthlyApiUsageStats(year, month);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/gpt-usage/logs", isAdmin, async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      let logs;
      
      if (startDate && endDate) {
        logs = await storage.getApiUsageLogs(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        logs = await storage.getApiUsageLogs();
      }
      
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  // WebSocket 서버 설정 (특정 경로에서만 동작)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    // /ws 경로에서만 WebSocket 연결 허용
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected to /ws');
    let registeredUserId: string | null = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'register' && data.userId) {
          // 사용자가 실제로 관리자인지 확인
          const user = await storage.getUser(data.userId);
          if (!user || user.role !== 'admin') {
            console.log(`Non-admin user ${data.userId} attempted to register for notifications`);
            ws.close();
            return;
          }

          registeredUserId = data.userId;
          
          // 관리자 클라이언트 등록 (여러 연결을 Set으로 관리)
          if (!adminClients.has(data.userId)) {
            adminClients.set(data.userId, new Set());
          }
          adminClients.get(data.userId)!.add(ws);
          console.log(`Admin ${data.userId} registered for notifications`);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      // 연결이 끊어지면 해당 클라이언트만 제거
      if (registeredUserId) {
        const sockets = adminClients.get(registeredUserId);
        if (sockets) {
          sockets.delete(ws);
          // Set이 비어있으면 Map에서도 제거
          if (sockets.size === 0) {
            adminClients.delete(registeredUserId);
          }
          console.log(`Admin ${registeredUserId} connection closed`);
        }
      }
    });
  });

  return httpServer;
}
