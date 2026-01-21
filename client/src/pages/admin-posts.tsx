import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, AlertCircle, CheckCircle, HelpCircle, ChevronDown, ChevronUp, EyeOff, Eye, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface Post {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  createdAt: string;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  moderationScore: string | null;
  moderationReason: string | null;
  isFlagged: boolean | null;
  isHidden: boolean;
  author: {
    id: string;
    name: string;
    nickname: string;
  } | null;
}

export default function AdminPosts() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [checkingModeration, setCheckingModeration] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // AdminLayout이 이미 인증을 확인했으므로, 바로 데이터를 로드
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await authFetch("/api/admin/posts");

      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      toast({
        title: "데이터 로드 실패",
        description: "게시물을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const toggleExpand = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const response = await authFetch(`/api/admin/posts/${deleteTarget}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast({
        title: "삭제 완료",
        description: "게시물이 삭제되었습니다.",
      });

      setDeleteTarget(null);
      loadPosts();
    } catch (error: any) {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleHidden = async (postId: string, isHidden: boolean) => {
    try {
      const response = await authFetch(`/api/admin/posts/${postId}/hidden`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isHidden }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast({
        title: isHidden ? "숨김 처리 완료" : "숨김 해제 완료",
        description: isHidden ? "게시물이 숨김 처리되었습니다." : "게시물이 다시 표시됩니다.",
      });

      loadPosts();
    } catch (error: any) {
      toast({
        title: "처리 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncCommentCounts = async () => {
    setSyncing(true);
    try {
      const response = await authFetch("/api/admin/sync-comment-counts", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("동기화에 실패했습니다.");
      }

      const data = await response.json();
      toast({
        title: "동기화 완료",
        description: data.message,
      });

      loadPosts();
    } catch (error: any) {
      toast({
        title: "동기화 실패",
        description: error.message || "댓글 수 동기화에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckModeration = async (postId: string) => {
    setCheckingModeration(prev => new Set(prev).add(postId));
    
    try {
      const response = await authFetch(`/api/posts/${postId}/check-moderation`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("확인에 실패했습니다.");
      }

      toast({
        title: "악성 콘텐츠 확인 완료",
        description: "게시물이 다시 검사되었습니다.",
      });

      loadPosts();
    } catch (error: any) {
      // 실패 메시지는 노출하지 않음
    } finally {
      setCheckingModeration(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">게시판 관리</h2>
          <p className="text-sm text-muted-foreground">모든 게시물을 확인하고 관리할 수 있습니다.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncCommentCounts}
          disabled={syncing}
          data-testid="button-sync-comments"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          댓글 수 동기화
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>게시물 목록</CardTitle>
          <CardDescription>총 {posts.length}개의 게시물</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">제목</TableHead>
                <TableHead className="w-[80px]">작성자</TableHead>
                <TableHead className="w-[120px]">카테고리</TableHead>
                <TableHead className="w-[80px]">작성일</TableHead>
                <TableHead className="w-[100px]">악성 콘텐츠</TableHead>
                <TableHead className="w-[80px]">좋아요</TableHead>
                <TableHead className="w-[50px]">댓글</TableHead>
                <TableHead className="w-[60px]">상태</TableHead>
                <TableHead className="text-right w-[100px]">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    게시물이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => {
                  const isExpanded = expandedPosts.has(post.id);
                  const moderationScore = post.moderationScore ? parseFloat(post.moderationScore) : 0;
                  const needsModerationCheck = post.moderationScore !== null && moderationScore === 0;
                  const isCheckingModeration = checkingModeration.has(post.id);
                  
                  return (
                    <TableRow key={post.id} data-testid={`row-post-${post.id}`}>
                      <TableCell className="max-w-0">
                        <button
                          onClick={() => toggleExpand(post.id)}
                          className="w-full text-left flex items-center gap-2 min-w-0 hover:text-primary transition-colors cursor-pointer"
                          data-testid={`button-expand-${post.id}`}
                        >
                          <span className="font-medium truncate block flex-1">{post.title}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap border-t pt-2">
                            {post.content}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="truncate">{post.author?.name || "탈퇴한 사용자"}</TableCell>
                      <TableCell className="truncate">{post.category}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(post.createdAt), {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </TableCell>
                      <TableCell>
                        {post.moderationScore !== null && post.moderationScore !== undefined ? (
                          <div className="flex flex-col gap-1">
                            {needsModerationCheck ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCheckModeration(post.id)}
                                disabled={isCheckingModeration}
                                className="h-7 text-xs gap-1"
                                data-testid={`button-check-moderation-${post.id}`}
                              >
                                {isCheckingModeration ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                확인
                              </Button>
                            ) : post.isFlagged ? (
                              <>
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit" data-testid={`badge-flagged-${post.id}`}>
                                  <AlertCircle className="h-3 w-3" />
                                  악성
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {(moderationScore * 100).toFixed(1)}%
                                </span>
                              </>
                            ) : (
                              <>
                                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600 w-fit" data-testid={`badge-safe-${post.id}`}>
                                  <CheckCircle className="h-3 w-3" />
                                  정상
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {(moderationScore * 100).toFixed(1)}%
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1 text-yellow-600 border-yellow-600 w-fit" data-testid={`badge-unchecked-${post.id}`}>
                            <HelpCircle className="h-3 w-3" />
                            미확인
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{post.likesCount}</TableCell>
                      <TableCell>{post.commentsCount}</TableCell>
                      <TableCell>
                        {post.isHidden ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit" data-testid={`badge-hidden-${post.id}`}>
                            <EyeOff className="h-3 w-3" />
                            숨김
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit" data-testid={`badge-visible-${post.id}`}>
                            <Eye className="h-3 w-3" />
                            공개
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleHidden(post.id, !post.isHidden)}
                            data-testid={`button-toggle-hidden-${post.id}`}
                            title={post.isHidden ? "숨김 해제" : "숨김 처리"}
                          >
                            {post.isHidden ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(post.id)}
                            data-testid={`button-delete-post-${post.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 취소할 수 없습니다. 게시물이 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
