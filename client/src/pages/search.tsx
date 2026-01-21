import { useState, useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ThumbsUp, Loader2, SearchX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export default function SearchPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const query = params.get("q") || "";
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["search-posts", query],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (query) params.append("search", query);
      params.append("limit", "10");
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
    staleTime: 0,
    enabled: !!query,
  });

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
  const total = data?.pages[0]?.total || 0;

  if (!query) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16">
          <SearchX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">검색어를 입력해주세요</h1>
          <p className="text-muted-foreground">상단 검색창에서 제목이나 내용으로 검색할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          "{query}" 검색 결과
        </h1>
        <p className="text-muted-foreground mt-1">
          {isLoading ? "검색 중..." : `${total}개의 게시물을 찾았습니다.`}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <div className="text-center py-12">
          <SearchX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            "{query}"에 대한 검색 결과가 없습니다.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            다른 검색어로 다시 시도해보세요.
          </p>
        </div>
      )}

      {!isLoading && posts.map((post: any) => (
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
                  
                  {post.isHidden ? (
                    <div className="py-4">
                      <p className="text-muted-foreground italic">
                        규칙에 위반되어 숨김 처리 되었습니다.
                      </p>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold leading-tight group-hover:text-primary transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-muted-foreground text-sm line-clamp-2">
                        {post.excerpt}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  {post.likesCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {post.commentsCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={post.author?.avatar} />
                  <AvatarFallback className="text-xs">
                    {post.author?.nickname?.[0] || post.author?.name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {post.author?.nickname || post.author?.name || "익명"}
                </span>
              </div>
            </CardFooter>
          </Link>
        </Card>
      ))}

      <div ref={loadMoreRef} className="py-4">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
