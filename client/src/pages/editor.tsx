import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  tags: string[];
  order: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  tags: string[];
  order: number;
  subcategories: Subcategory[];
}

export default function Editor() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const postId = searchParams.get("id");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState({
    title: "",
    category: "",
    subcategory: "",
    content: "",
  });

  const { data: existingPost, isLoading: postLoading } = useQuery({
    queryKey: ["posts", postId],
    queryFn: () => api.posts.getById(postId!),
    enabled: !!postId,
  });

  useEffect(() => {
    if (!user && !postLoading) {
      toast({
        variant: "destructive",
        title: "로그인이 필요합니다",
        description: "글을 작성하려면 먼저 로그인하세요.",
      });
      setLocation("/login");
    }
  }, [user, postLoading, toast, setLocation]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data.sort((a: Category, b: Category) => a.order - b.order));
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (existingPost) {
      setTitle(existingPost.title || "");
      setContent(existingPost.content || "");
      if (existingPost.categoryId) {
        setSelectedCategoryId(existingPost.categoryId);
      }
      if (existingPost.subcategoryId) {
        setSelectedSubcategoryId(existingPost.subcategoryId);
      }
    }
  }, [existingPost]);

  const createPostMutation = useMutation({
    mutationFn: api.posts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["user", "posts"] });
      toast({
        title: "게시물이 등록되었습니다!",
        description: "당신의 글이 커뮤니티에 공유되었습니다.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "게시물 등록 실패",
        description: error.message,
      });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.posts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["user", "posts"] });
      toast({
        title: "게시물이 수정되었습니다!",
        description: "변경사항이 저장되었습니다.",
      });
      setLocation("/profile");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "게시물 수정 실패",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user) {
      toast({
        variant: "destructive",
        title: "로그인이 필요합니다",
        description: "게시물을 작성하려면 먼저 로그인하세요.",
      });
      setLocation("/login");
      return;
    }

    const newErrors = {
      title: "",
      category: "",
      subcategory: "",
      content: "",
    };

    if (!title.trim()) {
      newErrors.title = "제목을 입력해주세요.";
    }

    if (!selectedCategoryId) {
      newErrors.category = "카테고리를 선택해주세요.";
    }

    const selectedCat = categories.find(c => c.id === selectedCategoryId);
    const hasSubcategories = (selectedCat?.subcategories?.length ?? 0) > 0;
    
    if (selectedCategoryId && hasSubcategories && !selectedSubcategoryId) {
      newErrors.subcategory = "세부 카테고리를 선택해주세요.";
    }

    if (!content || !content.trim()) {
      newErrors.content = "내용을 입력해주세요.";
    }

    if (newErrors.title || newErrors.category || newErrors.subcategory || newErrors.content) {
      setErrors(newErrors);
      return;
    }

    setErrors({
      title: "",
      category: "",
      subcategory: "",
      content: "",
    });

    const excerpt = content.slice(0, 200);
    const tags: string[] = [];
    const selectedSub = selectedCat?.subcategories.find(s => s.id === selectedSubcategoryId);
    
    let categoryLabel = selectedCat?.name || "";
    if (selectedSub) {
      categoryLabel += ` > ${selectedSub.name}`;
    }

    if (postId) {
      updatePostMutation.mutate({
        id: postId,
        data: {
          title,
          excerpt,
          content,
          category: categoryLabel,
          categoryId: selectedCategoryId || null,
          subcategoryId: selectedSubcategoryId || null,
          tags,
        },
      });
    } else {
      createPostMutation.mutate({
        title,
        excerpt,
        content,
        category: categoryLabel,
        categoryId: selectedCategoryId || null,
        subcategoryId: selectedSubcategoryId || null,
        tags,
      });
    }
  };

  const isSubmitting = createPostMutation.isPending || updatePostMutation.isPending;

  if (postLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{postId ? "글 수정" : "새 글 작성"}</h1>
      </div>

      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">제목</Label>
              <Input 
                id="title"
                name="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) {
                    setErrors(prev => ({ ...prev, title: "" }));
                  }
                }}
                placeholder="내용을 잘 나타내는 제목을 입력하세요..." 
                className={`text-lg font-medium h-12 ${errors.title ? "border-destructive focus-visible:ring-destructive" : ""}`}
                data-testid="input-title"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Select 
                    name="category" 
                    value={selectedCategoryId} 
                    onValueChange={(value) => {
                      setSelectedCategoryId(value);
                      setSelectedSubcategoryId("");
                      if (errors.category) {
                        setErrors(prev => ({ ...prev, category: "" }));
                      }
                    }}
                  >
                    <SelectTrigger 
                      data-testid="select-category"
                      className={errors.category ? "border-destructive" : ""}
                    >
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategoryId && (categories.find(c => c.id === selectedCategoryId)?.subcategories?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <Select 
                      name="subcategory" 
                      value={selectedSubcategoryId} 
                      onValueChange={(value) => {
                        setSelectedSubcategoryId(value);
                        if (errors.subcategory) {
                          setErrors(prev => ({ ...prev, subcategory: "" }));
                        }
                      }}
                    >
                      <SelectTrigger 
                        data-testid="select-subcategory"
                        className={errors.subcategory ? "border-destructive" : ""}
                      >
                        <SelectValue placeholder="세부 카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.find(c => c.id === selectedCategoryId)?.subcategories?.map(sub => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        )) ?? []}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {(errors.category || errors.subcategory) && (
                <p className="text-sm text-destructive">{errors.category || errors.subcategory}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">내용</Label>
              <Textarea 
                id="content"
                name="content"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (errors.content) {
                    setErrors(prev => ({ ...prev, content: "" }));
                  }
                }}
                placeholder="내용을 입력하세요..." 
                className={`min-h-[400px] resize-none text-sm leading-relaxed p-4 ${errors.content ? "border-destructive focus-visible:ring-destructive" : ""}`}
                data-testid="textarea-content"
              />
              {errors.content && (
                <p className="text-sm text-destructive">{errors.content}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-publish">
                {isSubmitting ? (postId ? "수정 중..." : "게시 중...") : (postId ? "수정하기" : "게시하기")}
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
}
