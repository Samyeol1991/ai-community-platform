import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ThumbsUp, ThumbsDown, Flag, Trash2, MessageCircle, EyeOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentCommentId: string | null;
  likesCount: number;
  dislikesCount: number;
  isHidden: boolean;
  createdAt: string;
  author: {
    id: string;
    nickname: string;
    avatar: string | null;
  } | null;
  userLike: boolean | null;
}

interface CommentsSectionProps {
  postId: string;
}

function ReplyInput({ 
  commentId, 
  onSubmit, 
  onCancel,
  isPending 
}: { 
  commentId: string; 
  onSubmit: (content: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content);
      setContent("");
    }
  };

  return (
    <div className="flex gap-2 pt-2">
      <Avatar className="h-7 w-7">
        <AvatarFallback>ME</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <Textarea
          placeholder="답글을 작성하세요..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[60px] resize-none bg-background text-sm"
          data-testid={`input-reply-${commentId}`}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            data-testid={`button-cancel-reply-${commentId}`}
          >
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || !content.trim()}
            data-testid={`button-submit-reply-${commentId}`}
          >
            {isPending ? "작성 중..." : "답글 작성"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [commentContent, setCommentContent] = useState("");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["posts", postId, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        credentials: "include",
      });
      return response.json();
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ content, parentCommentId }: { content: string; parentCommentId?: string }) => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, parentCommentId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["posts", postId] });
      setCommentContent("");
      setActiveReplyId(null);
      toast({
        title: "댓글 작성 완료",
        description: "댓글이 성공적으로 작성되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "댓글 작성 실패",
        description: error.message,
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["posts", postId] });
      toast({
        title: "댓글 삭제 완료",
        description: "댓글이 삭제되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "댓글 삭제 실패",
        description: error.message,
      });
    },
  });

  const likeCommentMutation = useMutation({
    mutationFn: async ({ commentId, isLike }: { commentId: string; isLike: boolean }) => {
      const response = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isLike }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", postId, "comments"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "오류",
        description: error.message,
      });
    },
  });

  const reportCommentMutation = useMutation({
    mutationFn: async ({ commentId, reason }: { commentId: string; reason: string }) => {
      const response = await fetch(`/api/comments/${commentId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "신고 완료",
        description: "신고가 접수되었습니다.",
      });
      setReportDialogOpen(false);
      setReportCommentId(null);
      setReportReason("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "신고 실패",
        description: error.message,
      });
    },
  });

  const handleCreateComment = () => {
    if (!user) {
      if (confirm("로그인해야 작성 가능합니다.")) {
        setLocation("/login");
      }
      return;
    }
    if (!commentContent.trim()) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "댓글 내용을 입력해주세요.",
      });
      return;
    }
    createCommentMutation.mutate({ content: commentContent });
  };

  const handleCreateReply = (parentCommentId: string, content: string) => {
    if (!user) {
      if (confirm("로그인해야 작성 가능합니다.")) {
        setLocation("/login");
      }
      return;
    }
    createCommentMutation.mutate({ content, parentCommentId });
  };

  const handleToggleReply = (commentId: string) => {
    if (!user) {
      if (confirm("로그인해야 작성 가능합니다.")) {
        setLocation("/login");
      }
      return;
    }
    setActiveReplyId(activeReplyId === commentId ? null : commentId);
  };

  const handleLikeComment = (commentId: string, isLike: boolean) => {
    if (!user) {
      if (confirm("로그인해야 작성 가능합니다.")) {
        setLocation("/login");
      }
      return;
    }
    likeCommentMutation.mutate({ commentId, isLike });
  };

  const handleDeleteComment = (commentId: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleOpenReportDialog = (commentId: string) => {
    if (!user) {
      if (confirm("로그인해야 작성 가능합니다.")) {
        setLocation("/login");
      }
      return;
    }
    setReportCommentId(commentId);
    setReportDialogOpen(true);
  };

  const handleSubmitReport = () => {
    if (!reportCommentId) return;
    if (!reportReason.trim()) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "신고 사유를 입력해주세요.",
      });
      return;
    }
    reportCommentMutation.mutate({ commentId: reportCommentId, reason: reportReason });
  };

  const topLevelComments = comments.filter((c: Comment) => !c.parentCommentId);
  const getReplies = (commentId: string) => comments.filter((c: Comment) => c.parentCommentId === commentId);

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    if (comment.isHidden) {
      return (
        <div className={`flex gap-4 ${isReply ? 'ml-12' : ''}`}>
          <div className="flex items-center gap-2 text-muted-foreground py-2 px-4 bg-muted/50 rounded-md">
            <EyeOff className="h-4 w-4" />
            <span className="text-sm">규칙에 위반되어 숨김 처리 되었습니다.</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex gap-4 ${isReply ? 'ml-12' : ''}`}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author?.avatar || undefined} />
          <AvatarFallback>{comment.author?.nickname[0] || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm" data-testid={`text-comment-author-${comment.id}`}>
                {comment.author?.nickname || "익명"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {user?.id === comment.userId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteComment(comment.id)}
                  data-testid={`button-delete-comment-${comment.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleOpenReportDialog(comment.id)}
                data-testid={`button-report-comment-${comment.id}`}
              >
                <Flag className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-comment-content-${comment.id}`}>
            {comment.content}
          </p>
        <div className="flex items-center gap-4 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-xs gap-1 ${comment.userLike === true ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleLikeComment(comment.id, true)}
            disabled={likeCommentMutation.isPending}
            data-testid={`button-like-comment-${comment.id}`}
          >
            <ThumbsUp className="h-3 w-3" />
            <span data-testid={`text-comment-likes-${comment.id}`}>{comment.likesCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-xs gap-1 ${comment.userLike === false ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleLikeComment(comment.id, false)}
            disabled={likeCommentMutation.isPending}
            data-testid={`button-dislike-comment-${comment.id}`}
          >
            <ThumbsDown className="h-3 w-3" />
            <span data-testid={`text-comment-dislikes-${comment.id}`}>{comment.dislikesCount}</span>
          </Button>
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => handleToggleReply(comment.id)}
              data-testid={`button-reply-comment-${comment.id}`}
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              답글
            </Button>
          )}
        </div>

        {!isReply && activeReplyId === comment.id && (
          <ReplyInput
            key={`reply-${comment.id}`}
            commentId={comment.id}
            onSubmit={(content) => handleCreateReply(comment.id, content)}
            onCancel={() => setActiveReplyId(null)}
            isPending={createCommentMutation.isPending}
          />
        )}
      </div>
    </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-muted/30 rounded-xl p-6 md:p-8">
        <p className="text-center text-muted-foreground">댓글을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-muted/30 rounded-xl p-6 md:p-8 space-y-6">
        <h3 className="font-semibold text-lg">댓글 <span data-testid="text-comments-total">({comments.length})</span></h3>

        <div className="flex gap-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="댓글을 작성하세요..."
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              className="min-h-[80px] resize-none bg-background"
              data-testid="input-comment"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleCreateComment}
                disabled={createCommentMutation.isPending}
                data-testid="button-submit-comment"
              >
                {createCommentMutation.isPending ? "작성 중..." : "댓글 작성"}
              </Button>
            </div>
          </div>
        </div>

        {comments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-6">
              {topLevelComments.map((comment: Comment) => (
                <div key={comment.id} className="space-y-4">
                  <CommentItem comment={comment} />
                  {getReplies(comment.id).map((reply: Comment) => (
                    <CommentItem key={reply.id} comment={reply} isReply />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {comments.length === 0 && (
          <p className="text-center text-muted-foreground py-8">아직 댓글이 없습니다. 첫 번째 댓글을 작성해보세요!</p>
        )}
      </div>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>댓글 신고</DialogTitle>
            <DialogDescription>
              신고 사유를 상세히 작성해주세요. 신고는 운영진 검토 후 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="신고 사유를 입력하세요..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="min-h-[120px]"
            data-testid="input-comment-report-reason"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReportDialogOpen(false);
                setReportCommentId(null);
                setReportReason("");
              }}
              data-testid="button-cancel-comment-report"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={reportCommentMutation.isPending}
              data-testid="button-submit-comment-report"
            >
              {reportCommentMutation.isPending ? "신고 중..." : "신고하기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
