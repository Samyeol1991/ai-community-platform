import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Search, MessageSquare, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface CommentWithDetails {
  id: string;
  content: string;
  userId: string;
  postId: string;
  parentCommentId: string | null;
  likesCount: number;
  dislikesCount: number;
  isFlagged: boolean;
  isHidden: boolean;
  moderationScore: string | null;
  moderationReason: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    nickname: string;
    avatar: string | null;
  } | null;
  post: {
    id: string;
    title: string;
  } | null;
}

export default function AdminComments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: comments, isLoading } = useQuery<CommentWithDetails[]>({
    queryKey: ["admin", "comments"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/comments");
      if (!res.ok) throw new Error("댓글 목록을 불러오는데 실패했습니다.");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/admin/comments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("댓글 삭제에 실패했습니다.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast({
        title: "댓글 삭제 완료",
        description: "댓글이 성공적으로 삭제되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: async ({ id, isHidden }: { id: string; isHidden: boolean }) => {
      const res = await authFetch(`/api/admin/comments/${id}/hidden`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden }),
      });
      if (!res.ok) throw new Error("댓글 숨김 처리에 실패했습니다.");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
      toast({
        title: "댓글 상태 변경",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "처리 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredComments = comments?.filter((comment) =>
    comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    comment.author?.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    comment.post?.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">댓글 관리</h1>
        <p className="text-muted-foreground">모든 댓글을 관리하고 삭제할 수 있습니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            전체 댓글 ({comments?.length || 0}개)
          </CardTitle>
          <CardDescription>
            사용자들이 작성한 모든 댓글 목록입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="댓글 내용, 작성자, 게시물 제목으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-comments"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredComments && filteredComments.length > 0 ? (
              filteredComments.map((comment) => (
                <Card 
                  key={comment.id} 
                  data-testid={`comment-${comment.id}`}
                  className={comment.isFlagged ? "border-red-300 bg-red-50" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <span className="font-medium" data-testid={`text-author-${comment.id}`}>
                            {comment.author?.nickname || "알 수 없음"}
                          </span>
                          <span>•</span>
                          <span data-testid={`text-time-${comment.id}`}>
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </span>
                          {comment.isFlagged && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-red-600 font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                유해 콘텐츠
                              </span>
                            </>
                          )}
                          {comment.isHidden && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-gray-600 font-medium">
                                <EyeOff className="h-3 w-3" />
                                숨김
                              </span>
                            </>
                          )}
                        </div>
                        
                        {comment.post && (
                          <div className="text-sm text-muted-foreground">
                            게시물: <span className="font-medium">{comment.post.title}</span>
                          </div>
                        )}

                        <p className="text-sm" data-testid={`text-content-${comment.id}`}>
                          {comment.content}
                        </p>

                        {comment.isFlagged && comment.moderationScore && (
                          <div className="text-xs text-red-600 mt-2 p-2 bg-red-100 rounded">
                            <strong>탐지 확률:</strong> {(parseFloat(comment.moderationScore) * 100).toFixed(1)}%
                            {comment.moderationReason && (
                              <>
                                <br />
                                <strong>사유:</strong> {comment.moderationReason}
                              </>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>👍 {comment.likesCount}</span>
                          <span>👎 {comment.dislikesCount}</span>
                          {comment.parentCommentId && (
                            <span className="text-blue-500">답글</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant={comment.isHidden ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => toggleHiddenMutation.mutate({ id: comment.id, isHidden: !comment.isHidden })}
                          disabled={toggleHiddenMutation.isPending}
                          data-testid={`button-toggle-${comment.id}`}
                        >
                          {comment.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(comment.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${comment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "검색 결과가 없습니다." : "댓글이 없습니다."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
