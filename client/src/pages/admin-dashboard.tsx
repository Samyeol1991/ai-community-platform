import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, FolderTree, AlertCircle, TrendingUp, MessageSquare, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/api";

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalComments?: number;
  totalCategories: number;
  flaggedPosts: number;
}

interface GptUsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalPosts: 0, totalCategories: 0, flaggedPosts: 0 });
  const [gptStats, setGptStats] = useState<GptUsageStats>({ totalCalls: 0, totalTokens: 0, totalCost: 0 });

  useEffect(() => {
    loadUserAndStats();
    loadGptStats();
  }, []);

  const loadUserAndStats = async () => {
    try {
      const response = await authFetch("/api/auth/me");

      if (response.ok) {
        const user = await response.json();
        setCurrentUser(user);
      }

      await loadStats();
    } catch (error) {
      console.error("Failed to load user and stats:", error);
    }
  };

  const loadStats = async () => {
    try {
      const [statsRes, categoriesRes, flaggedPostsRes] = await Promise.all([
        authFetch("/api/admin/stats"),
        authFetch("/api/categories"),
        authFetch("/api/admin/flagged-posts"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const categoriesData = categoriesRes.ok ? await categoriesRes.json() : [];
        const flaggedPostsData = flaggedPostsRes.ok ? await flaggedPostsRes.json() : [];
        setStats({
          ...statsData,
          totalComments: statsData.totalComments || 0,
          totalCategories: categoriesData.length || 0,
          flaggedPosts: flaggedPostsData.length || 0,
        });
      }
    } catch (error) {
      toast({
        title: "데이터 로드 실패",
        description: "통계를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadGptStats = async () => {
    try {
      const response = await authFetch("/api/admin/gpt-usage/monthly");
      if (response.ok) {
        const data = await response.json();
        setGptStats(data);
      }
    } catch (error) {
      console.error("Failed to load GPT stats:", error);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">대시보드</h2>
        {currentUser && (
          <p className="text-sm text-muted-foreground">{currentUser.nickname}님 환영합니다</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Link href="/admin/users">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 회원</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">등록된 회원 수</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/posts">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 게시물</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-posts">{stats.totalPosts}</div>
              <p className="text-xs text-muted-foreground">작성된 게시물 수</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/comments">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 댓글</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-comments">{stats.totalComments || 0}</div>
              <p className="text-xs text-muted-foreground">작성된 댓글 수</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/categories">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">카테고리</CardTitle>
              <FolderTree className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-categories">{stats.totalCategories}</div>
              <p className="text-xs text-muted-foreground">등록된 카테고리 수</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/flagged-posts">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">유해 콘텐츠</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-flagged-posts">{stats.flaggedPosts}</div>
              <p className="text-xs text-muted-foreground">플래그된 게시물</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/gpt-costs">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이번 달 GPT 비용</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-gpt-cost">${gptStats.totalCost.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground">{gptStats.totalCalls}회 호출 · {gptStats.totalTokens.toLocaleString()} 토큰</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            빠른 접근
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/admin/posts">
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">게시판 관리</h3>
                    <p className="text-sm text-muted-foreground">게시물 조회 및 삭제</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/admin/users">
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">회원 관리</h3>
                    <p className="text-sm text-muted-foreground">회원 조회 및 권한 관리</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/admin/categories">
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <FolderTree className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">카테고리 관리</h3>
                    <p className="text-sm text-muted-foreground">카테고리 추가 및 편집</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
