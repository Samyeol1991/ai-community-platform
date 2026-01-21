import type { User, Post, Comment } from "@shared/schema";

export interface PostWithAuthor extends Post {
  author: {
    id: string;
    name: string;
    nickname: string;
    avatar: string | null;
  } | null;
}

export interface CommentWithDetails extends Comment {
  post: {
    id: string;
    title: string;
    isHidden: boolean;
  } | null;
  author: {
    id: string;
    name: string;
    nickname: string;
    avatar: string | null;
  } | null;
}

export interface AuthResponse {
  id: string;
  name: string;
  nickname: string;
  email: string;
  ageGroup: string;
  role: string;
  avatar: string | null;
  token?: string;
}

const TOKEN_KEY = 'auth_token';

export const tokenStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};

function getAuthHeaders(): Record<string, string> {
  const token = tokenStorage.getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const existingHeaders = options.headers as Record<string, string> || {};
  
  return fetch(url, {
    ...options,
    headers: {
      ...existingHeaders,
      ...authHeaders,
    },
    credentials: "include",
  });
}

export const api = {
  user: {
    async getMyPosts() {
      const res = await authFetch("/api/user/posts");
      if (!res.ok) {
        throw new Error("내 게시물을 불러오는데 실패했습니다.");
      }
      return res.json() as Promise<PostWithAuthor[]>;
    },

    async getMyComments() {
      const res = await authFetch("/api/user/comments");
      if (!res.ok) {
        throw new Error("내 댓글을 불러오는데 실패했습니다.");
      }
      return res.json() as Promise<CommentWithDetails[]>;
    },

    async updatePassword(data: { currentPassword: string; newPassword: string }) {
      const res = await authFetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "비밀번호 변경에 실패했습니다.");
      }
      return res.json();
    },

    async updateProfile(data: { nickname: string }) {
      const res = await authFetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "프로필 수정에 실패했습니다.");
      }
      return res.json() as Promise<AuthResponse>;
    },
  },

  auth: {
    async register(data: { name: string; email: string; password: string; ageGroup: string }) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "회원가입에 실패했습니다.");
      }
      const response = await res.json() as AuthResponse;
      if (response.token) {
        tokenStorage.setToken(response.token);
      }
      return response;
    },

    async login(data: { email: string; password: string }) {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "로그인에 실패했습니다.");
      }
      const response = await res.json() as AuthResponse;
      if (response.token) {
        tokenStorage.setToken(response.token);
      }
      return response;
    },

    async logout() {
      const res = await authFetch("/api/auth/logout", {
        method: "POST",
      });
      tokenStorage.clearToken();
      if (!res.ok) {
        throw new Error("로그아웃에 실패했습니다.");
      }
      return res.json();
    },

    async getCurrentUser() {
      const res = await authFetch("/api/auth/me");
      if (!res.ok) {
        return null;
      }
      return res.json() as Promise<AuthResponse>;
    },
  },

  posts: {
    async getAll(category?: string) {
      const url = category ? `/api/posts?category=${encodeURIComponent(category)}` : "/api/posts";
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error("게시물을 불러오는데 실패했습니다.");
      }
      return res.json() as Promise<PostWithAuthor[]>;
    },

    async getById(id: string) {
      const res = await authFetch(`/api/posts/${id}`);
      if (!res.ok) {
        throw new Error("게시물을 찾을 수 없습니다.");
      }
      return res.json() as Promise<PostWithAuthor>;
    },

    async create(data: { title: string; excerpt: string; content: string; category: string; categoryId?: string | null; subcategoryId?: string | null; tags: string[] }) {
      const res = await authFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "게시물 작성에 실패했습니다.");
      }
      return res.json() as Promise<PostWithAuthor>;
    },

    async update(id: string, data: Partial<{ title: string; excerpt: string; content: string; category: string; categoryId?: string | null; subcategoryId?: string | null; tags: string[] }>) {
      const res = await authFetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "게시물 수정에 실패했습니다.");
      }
      return res.json() as Promise<PostWithAuthor>;
    },

    async delete(id: string) {
      const res = await authFetch(`/api/posts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("게시물 삭제에 실패했습니다.");
      }
      return res.json();
    },

    async checkModeration(id: string) {
      const res = await authFetch(`/api/posts/${id}/check-moderation`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "악성 콘텐츠 확인에 실패했습니다.");
      }
      return res.json() as Promise<Post>;
    },
  },
};
