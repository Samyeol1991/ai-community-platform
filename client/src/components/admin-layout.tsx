import { Link, useLocation } from "wouter";
import { Shield, Users, FileText, LogOut, FolderTree, Bell, MessageSquare, Bot, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  postId: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(ctx);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }

    return () => {
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    };
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (!response.ok) {
        setLocation("/admin/login");
        return;
      }
      const userData = await response.json();
      if (userData.role !== "admin") {
        setLocation("/");
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error("Auth check failed:", error);
      setLocation("/admin/login");
    } finally {
      setIsChecking(false);
    }
  };

  // 알림 소리 재생 함수
  const playNotificationSound = async () => {
    if (!audioContext || audioContext.state === 'closed') {
      console.warn('AudioContext not available');
      return;
    }

    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  // WebSocket 연결 (관리자만)
  useEffect(() => {
    // 사용자가 로그인하고 관리자인 경우에만 WebSocket 연결
    if (!user || user.role !== 'admin') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // 관리자 등록
      ws.send(JSON.stringify({ type: 'register', userId: user.id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const notification = data.data;
          
          // 새 알림 수신 시 알림 목록 갱신
          queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
          
          // 알림 소리 재생
          playNotificationSound();
          
          // 하단에 토스트 알림 표시
          toast(notification.title, {
            description: notification.message,
            action: notification.postId ? {
              label: '확인하기',
              onClick: () => {
                // 알림을 읽음 처리
                fetch(`/api/notifications/${notification.id}/read`, {
                  method: 'PATCH',
                  credentials: 'include',
                });
                
                // 게시물 페이지로 이동
                setLocation('/admin/posts');
              },
            } : undefined,
            duration: 5000,
          });

          // 브라우저 시스템 알림 표시 (권한이 있는 경우)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
            });
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [user, queryClient]);

  // 읽지 않은 알림 조회
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications/unread'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/unread', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // 30초마다 갱신
  });

  const handleNotificationClick = async (notification: Notification) => {
    // 알림을 읽음 처리
    await fetch(`/api/notifications/${notification.id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });

    // 알림 목록 갱신
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });

    // 게시물로 이동
    if (notification.postId) {
      setLocation(`/admin/posts`);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setLocation("/admin/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // 인증 확인 중이거나 사용자 정보가 없으면 아무것도 렌더링하지 않음
  if (isChecking || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">AI Nexus 관리자</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 알림 드롭다운 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      data-testid="badge-notification-count"
                    >
                      {notifications.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    새로운 알림이 없습니다
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex flex-col items-start p-4 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="font-semibold">{notification.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{notification.message}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* Admin Navigation */}
      <div className="border-b">
        <div className="container mx-auto px-4">
          <nav className="flex gap-1 py-2 overflow-x-auto">
            <Link href="/admin">
              <Button
                variant={location === "/admin" ? "default" : "ghost"}
                className="gap-2 whitespace-nowrap"
                data-testid="nav-admin-dashboard"
              >
                <Shield className="h-4 w-4" />
                대시보드
              </Button>
            </Link>
            <Link href="/admin/posts">
              <Button
                variant={location === "/admin/posts" ? "default" : "ghost"}
                className="gap-2 whitespace-nowrap"
                data-testid="nav-admin-posts"
              >
                <FileText className="h-4 w-4" />
                게시판 관리
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button
                variant={location === "/admin/users" ? "default" : "ghost"}
                className="gap-2 whitespace-nowrap"
                data-testid="nav-admin-users"
              >
                <Users className="h-4 w-4" />
                회원 관리
              </Button>
            </Link>
            <Link href="/admin/categories">
              <Button
                variant={location === "/admin/categories" ? "default" : "ghost"}
                className="gap-2 whitespace-nowrap"
                data-testid="nav-admin-categories"
              >
                <FolderTree className="h-4 w-4" />
                카테고리 관리
              </Button>
            </Link>
            <Link href="/admin/comments">
              <Button
                variant={location === "/admin/comments" ? "default" : "ghost"}
                className="gap-2 whitespace-nowrap"
                data-testid="nav-admin-comments"
              >
                <MessageSquare className="h-4 w-4" />
                댓글 관리
              </Button>
            </Link>
            <Link href="/admin/ai-management">
              <Button
                variant={location === "/admin/ai-management" ? "default" : "ghost"}
                className="gap-2 whitespace-nowrap"
                data-testid="nav-admin-ai-management"
              >
                <Bot className="h-4 w-4" />
                AI 관리
              </Button>
            </Link>
            <Link href="/admin/gpt-costs">
              <Button
                variant={location === "/admin/gpt-costs" ? "default" : "ghost"}
                className="gap-2 whitespace-nowrap"
                data-testid="nav-admin-gpt-costs"
              >
                <DollarSign className="h-4 w-4" />
                GPT 비용
              </Button>
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  );
}
