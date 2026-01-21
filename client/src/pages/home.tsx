import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, ThumbsUp, Grid3x3, ListFilter, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

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

interface HomeProps {
  sortBy?: "latest" | "popular";
}

export default function Home({ sortBy }: HomeProps = {}) {
  const [, params] = useRoute("/category/:slug");
  const categorySlug = params?.slug;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categorySlug || null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedCategory(categorySlug || null);
  }, [categorySlug]);

  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      console.log('[Home] Fetching categories...');
      const response = await fetch("/api/categories", {
        credentials: "include",
      });
      console.log('[Home] Categories response status:', response.status);
      if (!response.ok) {
        console.error('[Home] Failed to fetch categories:', response.status, response.statusText);
        return [];
      }
      const data = await response.json();
      console.log('[Home] Categories loaded:', data.length, 'categories');
      return data;
    },
  });

  useEffect(() => {
    if (categoriesError) {
      console.error('[Home] Categories error:', categoriesError);
    }
    if (!categoriesLoading && categories.length === 0) {
      console.warn('[Home] No categories found');
    }
  }, [categories, categoriesLoading, categoriesError]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts", selectedCategory, sortBy],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (sortBy) params.append("sortBy", sortBy);
      params.append("limit", "5");
      params.append("offset", pageParam.toString());
      
      const response = await fetch(`/api/posts?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.hasMore) return undefined;
      return pages.reduce((acc, page) => acc + page.posts.length, 0);
    },
    initialPageParam: 0,
  });

  // 무한 스크롤 감지
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((page) => page.posts) || [];

  const getCategoryName = (slug: string) => {
    for (const cat of categories) {
      if (cat.slug === slug) return cat.name;
      const subcat = cat.subcategories.find((s: Subcategory) => s.slug === slug);
      if (subcat) return `${cat.name} > ${subcat.name}`;
    }
    return slug;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:block col-span-3 space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">카테고리</h3>
          <div className="flex flex-col space-y-1">
            <Button 
              variant={selectedCategory === null ? "secondary" : "ghost"} 
              className="justify-start font-normal"
              onClick={() => setSelectedCategory(null)}
              data-testid="button-category-all"
            >
              <Grid3x3 className="mr-2 h-4 w-4 text-primary" />
              전체
            </Button>
            
            {categoriesLoading && (
              <div className="text-sm text-muted-foreground py-2">카테고리 로딩 중...</div>
            )}
            
            {!categoriesLoading && categories.length === 0 && (
              <div className="text-sm text-muted-foreground py-2">카테고리가 없습니다.</div>
            )}
            
            {categories.map((cat: Category) => (
              <div key={cat.id} className="space-y-1">
                <Button
                  variant={selectedCategory === cat.slug ? "secondary" : "ghost"}
                  className="w-full justify-start font-normal font-semibold"
                  onClick={() => setSelectedCategory(cat.slug)}
                >
                  {cat.name}
                </Button>
                {cat.subcategories.length > 0 && (
                  <div className="ml-6 space-y-1">
                    {cat.subcategories
                      .sort((a: Subcategory, b: Subcategory) => a.order - b.order)
                      .map((subcat: Subcategory) => (
                        <Button
                          key={subcat.id}
                          variant={selectedCategory === subcat.slug ? "secondary" : "ghost"}
                          className="w-full justify-start font-normal text-sm"
                          onClick={() => setSelectedCategory(subcat.slug)}
                        >
                          {subcat.name}
                        </Button>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Feed */}
      <div className="col-span-1 lg:col-span-9 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight">
            {sortBy === "popular" 
              ? "인기 게시물"
              : selectedCategory 
                ? getCategoryName(selectedCategory)
                : "최신 토론"}
          </h1>
          <div className="flex items-center gap-2">
             <span className="text-sm text-muted-foreground hidden sm:inline-block">정렬:</span>
             <Select defaultValue="new">
                <SelectTrigger className="w-[160px] h-9 bg-background">
                  <div className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="정렬 기준" />
                  </div>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="new">최신순</SelectItem>
                  <SelectItem value="top">인기순</SelectItem>
                  <SelectItem value="discussed">댓글순</SelectItem>
                </SelectContent>
             </Select>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">로딩 중...</div>
          </div>
        )}

        {!isLoading && posts && posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">아직 게시물이 없습니다.</p>
          </div>
        )}

        {!isLoading && posts && posts.map((post: any) => (
          <Card key={post.id} className="group hover:shadow-md transition-all duration-200 border-border/60 hover:border-primary/50">
            <Link href={`/post/${post.id}`}>
              <CardContent className="p-6 cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="rounded-md font-normal text-xs hover:bg-secondary/80">
                        {post.category}
                      </Badge>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                    </div>
                    
                    <div>
                      <h2 className="text-xl font-semibold group-hover:text-primary transition-colors mb-2 leading-tight">
                        {post.title}
                      </h2>
                      <p className="text-muted-foreground line-clamp-2 text-sm md:text-base">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {post.tags.map((tag: string) => (
                        <span key={tag} className="text-xs text-primary/80 bg-primary/5 px-2 py-1 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Link>
            <CardFooter className="px-6 py-3 bg-muted/30 border-t border-border/40 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={post.author?.avatar || undefined} />
                    <AvatarFallback>{post.author?.nickname[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-muted-foreground">
                    {post.author?.name || "익명"}
                  </span>
               </div>

               <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <div className="flex items-center gap-1 hover:text-primary transition-colors">
                    <ThumbsUp className="h-4 w-4" />
                    <span>{post.likesCount}</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-primary transition-colors">
                    <MessageSquare className="h-4 w-4" />
                    <span>{post.commentsCount}</span>
                  </div>
               </div>
            </CardFooter>
          </Card>
        ))}

        {/* 무한 스크롤 트리거 */}
        <div ref={loadMoreRef} className="py-8">
          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>로딩 중...</span>
            </div>
          )}
          {!hasNextPage && posts.length > 0 && (
            <div className="text-center text-muted-foreground text-sm">
              모든 게시물을 불러왔습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
