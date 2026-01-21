import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, CommentWithDetails } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, FileText, Edit, Trash2, MessageSquare, ThumbsUp, Loader2, AlertCircle, EyeOff, CornerDownRight, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || "");

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    newPasswordConfirm: "",
  });
  const [passwordMatch, setPasswordMatch] = useState(true);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories", {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  useEffect(() => {
    if (passwordForm.newPassword && passwordForm.newPasswordConfirm) {
      setPasswordMatch(passwordForm.newPassword === passwordForm.newPasswordConfirm);
    } else {
      setPasswordMatch(true);
    }
  }, [passwordForm.newPassword, passwordForm.newPasswordConfirm]);

  const { data: myPosts, isLoading: postsLoading } = useQuery({
    queryKey: ["user", "posts"],
    queryFn: api.user.getMyPosts,
    enabled: !!user,
  });

  const { data: myComments, isLoading: commentsLoading } = useQuery({
    queryKey: ["user", "comments"],
    queryFn: api.user.getMyComments,
    enabled: !!user,
  });

  const updatePasswordMutation = useMutation({
    mutationFn: api.user.updatePassword,
    onSuccess: () => {
      toast({
        title: "비밀번호 변경 완료",
        description: "비밀번호가 성공적으로 변경되었습니다.",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        newPasswordConfirm: "",
      });
      setIsPasswordDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "비밀번호 변경 실패",
        description: error.message,
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: api.posts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({
        title: "게시물 삭제 완료",
        description: "게시물이 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "게시물 삭제 실패",
        description: error.message,
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: api.user.updateProfile,
    onSuccess: async (data) => {
      updateUser({ nickname: data.nickname });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      toast({
        title: "프로필 변경 완료",
        description: "닉네임이 성공적으로 변경되었습니다.",
      });
      setIsEditingNickname(false);
      setNickname(data.nickname);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "프로필 변경 실패",
        description: error.message,
      });
    },
  });

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordMatch) {
      toast({
        variant: "destructive",
        title: "비밀번호 불일치",
        description: "새 비밀번호가 일치하지 않습니다.",
      });
      return;
    }

    updatePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutation.mutate(postId);
  };

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim() === "") {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "닉네임을 입력해주세요.",
      });
      return;
    }
    updateProfileMutation.mutate({ nickname: nickname.trim() });
  };

  const handleCancelNickname = () => {
    setNickname(user?.nickname || "");
    setIsEditingNickname(false);
  };

  const isPasswordFormValid = 
    passwordForm.currentPassword.trim() !== "" &&
    passwordForm.newPassword.trim() !== "" &&
    passwordForm.newPasswordConfirm.trim() !== "" &&
    passwordMatch;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
        <Link href="/login">
          <Button>로그인하기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">마이페이지</h1>
        <p className="text-muted-foreground mt-2">프로필과 활동 내역을 관리하세요</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 mr-2" />
            프로필
          </TabsTrigger>
          <TabsTrigger value="posts" data-testid="tab-posts">
            <FileText className="h-4 w-4 mr-2" />
            내 게시글
          </TabsTrigger>
          <TabsTrigger value="comments" data-testid="tab-comments">
            <MessageSquare className="h-4 w-4 mr-2" />
            내 댓글
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                프로필 정보
              </CardTitle>
              <CardDescription>회원 정보를 확인하고 수정하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-2xl">{user.nickname[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="grid gap-6 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground mb-2 block">닉네임</Label>
                  {!isEditingNickname ? (
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-medium">{user.nickname}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingNickname(true)}
                        data-testid="button-edit-nickname"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        수정
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleNicknameSubmit} className="flex items-center gap-2">
                      <Input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="닉네임 입력"
                        className="max-w-xs"
                        data-testid="input-nickname"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-nickname"
                      >
                        {updateProfileMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelNickname}
                        data-testid="button-cancel-nickname"
                      >
                        취소
                      </Button>
                    </form>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">이름</Label>
                    <p className="text-lg font-medium">{user.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">연령대</Label>
                    <p className="text-lg font-medium">{user.ageGroup}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">이메일</Label>
                  <p className="text-lg font-medium">{user.email}</p>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-muted-foreground mb-2 block">비밀번호</Label>
                  <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-open-password-dialog">
                        <Lock className="h-4 w-4 mr-2" />
                        비밀번호 변경
                      </Button>
                    </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>비밀번호 변경</DialogTitle>
                    <DialogDescription>
                      현재 비밀번호를 확인한 후 새 비밀번호로 변경할 수 있습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePasswordSubmit}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">현재 비밀번호 <span className="text-destructive">*</span></Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                          required
                          data-testid="input-current-password"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPassword">새 비밀번호 <span className="text-destructive">*</span></Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                          required
                          data-testid="input-new-password"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPasswordConfirm">새 비밀번호 확인 <span className="text-destructive">*</span></Label>
                        <Input
                          id="newPasswordConfirm"
                          type="password"
                          value={passwordForm.newPasswordConfirm}
                          onChange={(e) => handlePasswordChange("newPasswordConfirm", e.target.value)}
                          required
                          data-testid="input-new-password-confirm"
                        />
                        {!passwordMatch && passwordForm.newPasswordConfirm && (
                          <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                            <AlertCircle className="h-4 w-4" />
                            <span>비밀번호가 일치하지 않습니다.</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={!isPasswordFormValid || updatePasswordMutation.isPending}
                        data-testid="button-change-password"
                      >
                        {updatePasswordMutation.isPending ? "변경 중..." : "비밀번호 변경"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                내가 쓴 게시글
              </CardTitle>
              <CardDescription>작성한 게시물 {myPosts?.length || 0}개</CardDescription>
            </CardHeader>
            <CardContent>
              {postsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {!postsLoading && myPosts && myPosts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">아직 작성한 게시물이 없습니다.</p>
                  <Link href="/editor">
                    <Button>첫 글 작성하기</Button>
                  </Link>
                </div>
              )}

              {!postsLoading && myPosts && myPosts.length > 0 && (
                <div className="space-y-4">
                  {myPosts.map((post) => (
                    <Card key={post.id} className={`border-border/60 ${post.isHidden ? 'bg-muted/50' : ''}`}>
                      <CardContent className="p-6">
                        {post.isHidden ? (
                          <div className="flex items-center gap-3 text-muted-foreground py-4">
                            <EyeOff className="h-5 w-5" />
                            <span>규칙에 위반되어 숨김 처리 되었습니다.</span>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="rounded-md font-normal text-xs">
                                  {post.category}
                                </Badge>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                              </div>

                              <div>
                                <Link href={`/post/${post.id}`}>
                                  <h3 className="text-lg font-semibold hover:text-primary transition-colors cursor-pointer">
                                    {post.title}
                                  </h3>
                                </Link>
                                <p className="text-muted-foreground line-clamp-2 text-sm mt-1">
                                  {post.excerpt}
                                </p>
                              </div>

                              <div className="flex items-center gap-4 text-muted-foreground text-sm">
                                <div className="flex items-center gap-1">
                                  <ThumbsUp className="h-4 w-4" />
                                  <span>{post.likesCount || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-4 w-4" />
                                  <span>{post.commentsCount || 0}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <Link href={`/editor?id=${post.id}`}>
                                <Button variant="outline" size="sm" className="w-full" data-testid={`button-edit-${post.id}`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  수정
                                </Button>
                              </Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" data-testid={`button-delete-${post.id}`}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    삭제
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>게시물을 삭제하시겠습니까?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      이 작업은 되돌릴 수 없습니다. 게시물이 영구적으로 삭제됩니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeletePost(post.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                내가 쓴 댓글
              </CardTitle>
              <CardDescription>작성한 댓글 및 답글 {myComments?.length || 0}개</CardDescription>
            </CardHeader>
            <CardContent>
              {commentsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {!commentsLoading && myComments && myComments.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">아직 작성한 댓글이 없습니다.</p>
                </div>
              )}

              {!commentsLoading && myComments && myComments.length > 0 && (
                <div className="space-y-4">
                  {myComments.map((comment: any) => (
                    <Card key={comment.id} className={`border-border/60 ${comment.isHidden ? 'bg-muted/50' : ''}`}>
                      <CardContent className="p-6">
                        {comment.isHidden ? (
                          <div className="flex items-center gap-3 text-muted-foreground py-2">
                            <EyeOff className="h-5 w-5" />
                            <span>규칙에 위반되어 숨김 처리 되었습니다.</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                {comment.isReply && (
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <CornerDownRight className="h-3 w-3" />
                                    답글
                                  </Badge>
                                )}
                                {comment.post ? (
                                  comment.post.isHidden ? (
                                    <span className="flex items-center gap-1">
                                      <EyeOff className="h-3 w-3" />
                                      숨김 처리된 게시글
                                    </span>
                                  ) : (
                                    <span className="font-medium text-foreground">
                                      {comment.post.title}
                                    </span>
                                  )
                                ) : (
                                  <span>삭제된 게시글</span>
                                )}
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko })}</span>
                              </div>
                              {comment.post && !comment.post.isHidden && (
                                <Link href={`/post/${comment.post.id}`}>
                                  <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid={`button-goto-post-${comment.id}`}>
                                    <ExternalLink className="h-3 w-3" />
                                    게시글 보기
                                  </Button>
                                </Link>
                              )}
                            </div>

                            {comment.isReply && (
                              <div className="bg-muted/50 rounded-md p-3 text-sm border-l-2 border-muted-foreground/30">
                                {comment.parentComment ? (
                                  <>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      @{comment.parentComment.author?.nickname || '알 수 없음'}님의 댓글에 답글
                                    </div>
                                    <p className="text-muted-foreground text-xs">{comment.parentComment.content}</p>
                                  </>
                                ) : (
                                  <p className="text-muted-foreground text-xs">원본 댓글이 삭제되었습니다.</p>
                                )}
                              </div>
                            )}

                            <p className="text-foreground">{comment.content}</p>

                            <div className="flex items-center gap-4 text-muted-foreground text-sm">
                              <div className="flex items-center gap-1">
                                <ThumbsUp className="h-4 w-4" />
                                <span>{comment.likesCount || 0}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
