import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, MoreHorizontal, Flag, Loader2, EyeOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { CommentsSection } from "@/components/comments-section";
import NotFound from "./not-found";

export default function PostDetail() {
  const [, params] = useRoute("/post/:id");
  const postId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["posts", postId],
    queryFn: () => api.posts.getById(postId!),
    enabled: !!postId,
  });

  const { data: likeStatus } = useQuery({
    queryKey: ["posts", postId, "like"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/like`, {
        credentials: "include",
      });
      return response.json();
    },
    enabled: !!postId && !!user,
  });

  const likeMutation = useMutation({
    mutationFn: async (isLike: boolean) => {
      const response = await fetch(`/api/posts/${postId}/like`, {
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
      queryClient.invalidateQueries({ queryKey: ["posts", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts", postId, "like"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "오류",
        description: error.message,
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await fetch(`/api/posts/${postId}/report`, {
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

  const handleLike = (isLike: boolean) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "로그인 필요",
        description: "로그인 후 이용해주세요.",
      });
      return;
    }
    likeMutation.mutate(isLike);
  };

  const handleReport = () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "로그인 필요",
        description: "로그인 후 이용해주세요.",
      });
      return;
    }
    if (!reportReason.trim()) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "신고 사유를 입력해주세요.",
      });
      return;
    }
    reportMutation.mutate(reportReason);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) return <NotFound />;

  const category = CATEGORIES.find(c => c.slug === post.category);
  const userLiked = likeStatus?.liked;

  if (post.isHidden) {
    return (
      <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
          <div className="p-6 rounded-full bg-muted">
            <EyeOff className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">규칙에 위반되어 숨김 처리 되었습니다.</h2>
          <p className="text-muted-foreground">이 게시글은 커뮤니티 규정에 따라 숨김 처리되었습니다.</p>
          <Button variant="outline" onClick={() => window.history.back()}>
            이전으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
             <Badge variant="outline" className="uppercase tracking-widest text-[10px]" data-testid="badge-category">
               {category?.name || post.category}
             </Badge>
             <span className="text-sm text-muted-foreground">•</span>
             <span className="text-sm text-muted-foreground" data-testid="text-created-date">
               {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}
             </span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight lg:text-5xl" data-testid="text-title">
            {post.title}
          </h1>

          <div className="flex items-center justify-between py-4 border-y border-border/40">
             <div className="flex items-center gap-3">
               <Avatar className="h-10 w-10 border border-border">
                 <AvatarImage src={post.author?.avatar || undefined} />
                 <AvatarFallback>{post.author?.nickname[0] || "?"}</AvatarFallback>
               </Avatar>
               <div>
                 <p className="text-sm font-medium leading-none" data-testid="text-author-name">{post.author?.name || "익명"}</p>
                 <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</p>
               </div>
             </div>

             <div className="flex items-center gap-2">
               <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-share">
                 <Share2 className="h-4 w-4 mr-2" />
                 공유
               </Button>
               <Button variant="ghost" size="icon" data-testid="button-more">
                 <MoreHorizontal className="h-4 w-4" />
               </Button>
             </div>
          </div>
        </header>

        <div className="prose prose-zinc dark:prose-invert max-w-none">
           <div className="whitespace-pre-wrap" data-testid="text-content">{post.content}</div>
        </div>

        <div className="flex gap-2 pt-4">
          {post.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="hover:bg-secondary/80 cursor-pointer" data-testid={`badge-tag-${tag}`}>
              #{tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-4 py-6 border-t border-border/40">
           <Button 
             variant={userLiked === true ? "default" : "outline"} 
             className="gap-2"
             onClick={() => handleLike(true)}
             disabled={likeMutation.isPending}
             data-testid="button-like"
           >
             <ThumbsUp className="h-4 w-4" />
             좋아요 <span data-testid="text-likes-count">({post.likesCount})</span>
           </Button>
           <Button 
             variant={userLiked === false ? "default" : "outline"} 
             className="gap-2"
             onClick={() => handleLike(false)}
             disabled={likeMutation.isPending}
             data-testid="button-dislike"
           >
             <ThumbsDown className="h-4 w-4" />
             싫어요 <span data-testid="text-dislikes-count">({post.dislikesCount})</span>
           </Button>
           <Button variant="ghost" className="gap-2" data-testid="button-comments">
             <MessageSquare className="h-4 w-4" />
             댓글 <span data-testid="text-comments-count">({post.commentsCount})</span>
           </Button>
           <div className="ml-auto">
             <Button 
               variant="ghost" 
               size="sm" 
               className="text-muted-foreground hover:text-destructive"
               onClick={() => setReportDialogOpen(true)}
               data-testid="button-report"
             >
               <Flag className="h-4 w-4 mr-2" />
               신고
             </Button>
           </div>
        </div>

        <CommentsSection postId={postId!} />

      </article>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시물 신고</DialogTitle>
            <DialogDescription>
              신고 사유를 상세히 작성해주세요. 신고는 운영진 검토 후 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="신고 사유를 입력하세요..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="min-h-[120px]"
            data-testid="input-report-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)} data-testid="button-cancel-report">
              취소
            </Button>
            <Button 
              onClick={handleReport} 
              disabled={reportMutation.isPending}
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? "신고 중..." : "신고하기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
