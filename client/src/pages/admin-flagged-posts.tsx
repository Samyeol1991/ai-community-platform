import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface FlaggedPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  isFlagged: boolean;
  moderationScore: string | null;
  moderationReason: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    nickname: string;
    avatar: string | null;
  } | null;
}

export default function AdminFlaggedPosts() {
  const { toast } = useToast();
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // AdminLayout이 이미 인증을 확인했으므로, 바로 데이터를 로드
    loadFlaggedPosts();
  }, []);

  const loadFlaggedPosts = async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/admin/flagged-posts");

      if (response.ok) {
        const data = await response.json();
        setFlaggedPosts(data);
      } else {
        toast({
          title: "데이터 로드 실패",
          description: "플래그된 게시물을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "서버와의 통신 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("정말로 이 게시물을 삭제하시겠습니까?")) {
      return;
    }

    try {
      const response = await authFetch(`/api/admin/posts/${postId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "삭제 완료",
          description: "게시물이 삭제되었습니다.",
        });
        loadFlaggedPosts();
      } else {
        toast({
          title: "삭제 실패",
          description: "게시물 삭제 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "서버와의 통신 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">유해 콘텐츠 감지 게시물</h2>
        <p className="text-sm text-muted-foreground">
          AI 모델이 유해할 가능성이 있다고 판단한 게시물 목록입니다
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">로딩 중...</div>
      ) : flaggedPosts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            플래그된 게시물이 없습니다
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flaggedPosts.map((post) => (
            <Card key={post.id} className="border-red-200" data-testid={`card-flagged-post-${post.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      {post.title}
                      <Badge variant="destructive" data-testid={`badge-flagged-${post.id}`}>유해 콘텐츠</Badge>
                    </CardTitle>
                    <div className="text-sm text-muted-foreground mt-2">
                      작성자: {post.author?.nickname || "알 수 없음"} | 
                      카테고리: {post.category} | 
                      작성일: {new Date(post.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePost(post.id)}
                    data-testid={`button-delete-${post.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    삭제
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold">요약:</p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-excerpt-${post.id}`}>{post.excerpt}</p>
                  </div>
                  {post.moderationReason && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-sm font-semibold text-red-700">감지 사유:</p>
                      <p className="text-sm text-red-600" data-testid={`text-reason-${post.id}`}>{post.moderationReason}</p>
                    </div>
                  )}
                  {post.moderationScore && (
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold">신뢰도 점수:</span>{" "}
                        <span data-testid={`text-score-${post.id}`}>{post.moderationScore}</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
