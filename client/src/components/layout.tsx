import { Link, useLocation, useSearch } from "wouter";
import { useState, useEffect } from "react";
import { Search, Bell, Menu, PenSquare, LogOut, User as UserIcon, Sparkles, Folder, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import logoUrl from "/logo.jpg";

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

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const isHome = location === "/" || location.startsWith("/category/") || location.startsWith("/search");
  const currentCategory = location.startsWith("/category/") 
    ? location.split("/category/")[1]
    : null;
  
  // 현재 선택된 대 카테고리 찾기
  const selectedParentCategory = categories.find(cat => {
    if (cat.slug === currentCategory) return true;
    return cat.subcategories?.some(sub => sub.slug === currentCategory);
  });

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

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center px-4">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">메뉴 열기</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] sm:w-[300px]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link href="/" className="flex items-center gap-2 text-lg font-semibold" onClick={() => document.body.click()}>
                   <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-lg" />
                   <span>AI Nexus</span>
                </Link>
                <div className="space-y-1">
                  <h4 className="px-2 py-2 text-sm font-medium text-muted-foreground">카테고리</h4>
                  {categories.map((cat) => (
                    <Link key={cat.id} href={`/category/${cat.slug}`}>
                      <Button variant="ghost" className="w-full justify-start" onClick={() => document.body.click()}>
                        <Folder className="mr-2 h-4 w-4" />
                        {cat.name}
                      </Button>
                    </Link>
                  ))}
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="mr-6 flex items-center gap-2 hidden md:flex">
            <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-lg" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
              AI Nexus
            </span>
          </Link>

          {/* Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/latest" className={location === "/latest" ? "text-foreground" : "hover:text-foreground transition-colors"}>
              최신
            </Link>
            <Link href="/popular" className={location === "/popular" ? "text-foreground" : "hover:text-foreground transition-colors"}>
              인기
            </Link>
          </nav>

          <form onSubmit={handleSearch} className="flex-1 ml-4 md:ml-8 max-w-md hidden md:block">
             <div className="relative">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input 
                 type="search" 
                 placeholder="제목이나 내용으로 검색..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-muted/50 pl-9 pr-8 focus-visible:ring-1"
                 data-testid="input-gnb-search"
               />
               {searchQuery && (
                 <button
                   type="button"
                   onClick={clearSearch}
                   className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                 >
                   <X className="h-4 w-4" />
                 </button>
               )}
             </div>
          </form>

          {/* Right Side Actions */}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                 <Link href="/editor">
                  <Button size="sm" className="flex gap-2" data-testid="button-write">
                    <PenSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">글쓰기</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Bell className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-user-menu">
                      <Avatar className="h-8 w-8 border border-border">
                        <AvatarImage src={user.avatar || undefined} alt={user.name} />
                        <AvatarFallback>{user.nickname?.[0] || user.name?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <UserIcon className="mr-2 h-4 w-4" />
                        마이페이지
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive" data-testid="button-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="button-login-nav">로그인</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" data-testid="button-signup-nav">회원가입</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Category Navigation (SNB) - Shows only on home/category pages */}
      {isHome && (
        <div className="sticky top-16 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
          <div className="container mx-auto px-4">
            {/* 대 카테고리 */}
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-2 py-3 w-max">
                <Link href="/">
                  <Badge
                    variant={!currentCategory ? "default" : "outline"}
                    className="cursor-pointer whitespace-nowrap"
                    data-testid="badge-category-all"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    전체
                  </Badge>
                </Link>
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/category/${cat.slug}`}>
                    <Badge
                      variant={selectedParentCategory?.id === cat.id ? "default" : "outline"}
                      className="cursor-pointer whitespace-nowrap font-semibold"
                      data-testid={`badge-category-${cat.slug}`}
                    >
                      <Folder className="mr-1 h-3 w-3" />
                      {cat.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
            
            {/* 소 카테고리 (선택된 대 카테고리가 있고 소 카테고리가 있을 때만 표시) */}
            {selectedParentCategory && selectedParentCategory.subcategories && selectedParentCategory.subcategories.length > 0 && (
              <div className="border-t border-border/40">
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <div className="flex gap-2 py-2.5 w-max">
                    <Link href={`/category/${selectedParentCategory.slug}`}>
                      <Badge
                        variant={currentCategory === selectedParentCategory.slug ? "secondary" : "outline"}
                        className="cursor-pointer whitespace-nowrap text-xs"
                        data-testid={`badge-subcategory-all-${selectedParentCategory.slug}`}
                      >
                        전체
                      </Badge>
                    </Link>
                    {selectedParentCategory.subcategories
                      .sort((a, b) => a.order - b.order)
                      .map((subcat) => (
                        <Link key={subcat.id} href={`/category/${subcat.slug}`}>
                          <Badge
                            variant={currentCategory === subcat.slug ? "secondary" : "outline"}
                            className="cursor-pointer whitespace-nowrap text-xs"
                            data-testid={`badge-subcategory-${subcat.slug}`}
                          >
                            {subcat.name}
                          </Badge>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="container mx-auto py-6 px-4 md:py-8">
        {children}
      </main>
    </div>
  );
}
