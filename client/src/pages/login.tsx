import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import logoUrl from "@assets/generated_images/modern_abstract_ai_community_logo.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await login(email, password);
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: error.message,
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-xl shadow-lg" />
        <h1 className="text-2xl font-bold tracking-tight">AI Nexus에 오신 것을 환영합니다</h1>
        <p className="text-muted-foreground">생성형 AI 시대를 위한 커뮤니티</p>
      </div>

      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader>
          <CardTitle className="text-center">로그인</CardTitle>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="name@example.com" 
                required 
                autoCapitalize="off"
                autoCorrect="off"
                data-testid="input-email" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                data-testid="input-password" 
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              className="w-full" 
              type="submit" 
              disabled={isLoading} 
              data-testid="button-login"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              계정이 없으신가요?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                회원가입
              </Link>
            </div>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline" data-testid="link-forgot-password">
              비밀번호를 잊으셨나요?
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
