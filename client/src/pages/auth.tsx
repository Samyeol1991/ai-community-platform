import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import logoUrl from "@assets/generated_images/modern_abstract_ai_community_logo.png";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
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
      toast({
        title: "로그인 성공!",
        description: "환영합니다.",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const handle = formData.get("handle") as string;

    try {
      await register({ name, email, password, handle });
      toast({
        title: "회원가입 성공!",
        description: "AI Nexus에 오신 것을 환영합니다.",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: error.message,
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
        <Tabs defaultValue="login" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input id="email" name="email" type="email" placeholder="name@example.com" required data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">비밀번호</Label>
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs">비밀번호를 잊으셨나요?</Button>
                  </div>
                  <Input id="password" name="password" type="password" required data-testid="input-password" />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isLoading} data-testid="button-login">
                  {isLoading ? "로그인 중..." : "로그인"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input id="name" name="name" required data-testid="input-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="handle">사용자명 (@handle)</Label>
                  <Input id="handle" name="handle" placeholder="yourusername" required data-testid="input-handle" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input id="signup-email" name="email" type="email" placeholder="name@example.com" required data-testid="input-signup-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input id="signup-password" name="password" type="password" required data-testid="input-signup-password" />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isLoading} data-testid="button-signup">
                  {isLoading ? "계정 생성 중..." : "계정 만들기"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
      
      <p className="mt-6 text-center text-sm text-muted-foreground">
        계속 진행하면 <a href="#" className="underline hover:text-primary">이용약관</a> 및 <a href="#" className="underline hover:text-primary">개인정보 처리방침</a>에 동의하는 것으로 간주됩니다.
      </p>
    </div>
  );
}
