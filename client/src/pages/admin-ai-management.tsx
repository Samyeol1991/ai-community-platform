import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import type { AiSettings, AuthorInfo } from "@shared/schema";

async function fetchAiSettings(): Promise<AiSettings> {
  const response = await authFetch("/api/admin/ai-settings");
  if (!response.ok) {
    throw new Error("AI 설정을 가져오는 데 실패했습니다.");
  }
  return response.json();
}

async function updateAiSettings(settings: { postThreshold: number; commentThreshold: number }): Promise<AiSettings> {
  const response = await authFetch("/api/admin/ai-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error("AI 설정 업데이트에 실패했습니다.");
  }
  return response.json();
}

async function fetchAuthorInfoList(): Promise<AuthorInfo[]> {
  const response = await authFetch("/api/admin/author-info");
  if (!response.ok) {
    throw new Error("AI 봇 정보를 가져오는 데 실패했습니다.");
  }
  return response.json();
}

async function createAuthorInfo(data: { name: string; description?: string }): Promise<AuthorInfo> {
  const response = await authFetch("/api/admin/author-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("AI 봇 등록에 실패했습니다.");
  }
  return response.json();
}

async function deleteAuthorInfo(id: string): Promise<void> {
  const response = await authFetch(`/api/admin/author-info/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("AI 봇 삭제에 실패했습니다.");
  }
}

export default function AdminAiManagementPage() {
  const queryClient = useQueryClient();
  const [postThreshold, setPostThreshold] = useState(90);
  const [commentThreshold, setCommentThreshold] = useState(90);
  const [authorName, setAuthorName] = useState("");
  const [authorDescription, setAuthorDescription] = useState("");

  const { data: aiSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: fetchAiSettings,
  });

  const { data: authorInfoList = [], isLoading: isLoadingAuthors } = useQuery({
    queryKey: ["author-info"],
    queryFn: fetchAuthorInfoList,
  });

  useEffect(() => {
    if (aiSettings) {
      setPostThreshold(aiSettings.postThreshold);
      setCommentThreshold(aiSettings.commentThreshold);
    }
  }, [aiSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: updateAiSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      toast.success("AI 설정이 업데이트되었습니다.");
    },
    onError: () => {
      toast.error("AI 설정 업데이트에 실패했습니다.");
    },
  });

  const createAuthorMutation = useMutation({
    mutationFn: createAuthorInfo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["author-info"] });
      toast.success("AI 봇이 등록되었습니다.");
      setAuthorName("");
      setAuthorDescription("");
    },
    onError: () => {
      toast.error("AI 봇 등록에 실패했습니다.");
    },
  });

  const deleteAuthorMutation = useMutation({
    mutationFn: deleteAuthorInfo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["author-info"] });
      toast.success("AI 봇이 삭제되었습니다.");
    },
    onError: () => {
      toast.error("AI 봇 삭제에 실패했습니다.");
    },
  });

  const handleUpdateSettings = () => {
    updateSettingsMutation.mutate({
      postThreshold,
      commentThreshold,
    });
  };

  const handleCreateAuthor = () => {
    if (!authorName.trim()) {
      toast.error("AI 봇 이름을 입력해주세요.");
      return;
    }
    createAuthorMutation.mutate({
      name: authorName,
      description: authorDescription || undefined,
    });
  };

  const handleDeleteAuthor = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteAuthorMutation.mutate(id);
    }
  };

  if (isLoadingSettings || isLoadingAuthors) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">AI 관리</h1>
          <p className="text-muted-foreground mb-8">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI 관리</h1>
          <p className="text-muted-foreground">악성 콘텐츠 탐지 임계값 설정 및 AI 봇 관리</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>악성 콘텐츠 탐지 임계값 설정</CardTitle>
            <CardDescription>
              설정한 확률 이상의 악성 콘텐츠는 자동으로 숨김 처리됩니다. (0-100%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="post-threshold">게시물 악성 콘텐츠 확률 임계값 (%)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="post-threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={postThreshold}
                  onChange={(e) => setPostThreshold(parseInt(e.target.value) || 0)}
                  className="max-w-[200px]"
                  data-testid="input-post-threshold"
                />
                <span className="text-sm text-muted-foreground">
                  현재: {postThreshold}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment-threshold">댓글 악성 콘텐츠 확률 임계값 (%)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="comment-threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={commentThreshold}
                  onChange={(e) => setCommentThreshold(parseInt(e.target.value) || 0)}
                  className="max-w-[200px]"
                  data-testid="input-comment-threshold"
                />
                <span className="text-sm text-muted-foreground">
                  현재: {commentThreshold}%
                </span>
              </div>
            </div>

            <Button 
              onClick={handleUpdateSettings}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-update-settings"
            >
              {updateSettingsMutation.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI 봇 등록</CardTitle>
            <CardDescription>
              AI 댓글 봇에 대한 정보를 등록하고 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="author-name">AI 봇 이름 *</Label>
                <Input
                  id="author-name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="AI 봇 이름을 입력하세요"
                  data-testid="input-author-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author-description">설명 (선택)</Label>
                <Textarea
                  id="author-description"
                  value={authorDescription}
                  onChange={(e) => setAuthorDescription(e.target.value)}
                  placeholder="AI 봇에 대한 설명을 입력하세요"
                  rows={3}
                  data-testid="input-author-description"
                />
              </div>

              <Button 
                onClick={handleCreateAuthor}
                disabled={createAuthorMutation.isPending}
                data-testid="button-create-author"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createAuthorMutation.isPending ? "등록 중..." : "AI 봇 등록"}
              </Button>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">등록된 AI 봇 목록</h3>
              {authorInfoList.length === 0 ? (
                <p className="text-sm text-muted-foreground">등록된 AI 봇이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {authorInfoList.map((author) => (
                    <div
                      key={author.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                      data-testid={`author-item-${author.id}`}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium" data-testid={`text-author-name-${author.id}`}>
                          {author.name}
                        </h4>
                        {author.description && (
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`text-author-description-${author.id}`}>
                            {author.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          등록일: {new Date(author.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAuthor(author.id)}
                        disabled={deleteAuthorMutation.isPending}
                        data-testid={`button-delete-author-${author.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
