import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import logoUrl from "@assets/generated_images/modern_abstract_ai_community_logo.png";

const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대 이상"];

export default function Signup() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    ageGroup: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);

  useEffect(() => {
    if (formData.password && formData.passwordConfirm) {
      setPasswordMatch(formData.password === formData.passwordConfirm);
    } else {
      setPasswordMatch(true);
    }
  }, [formData.password, formData.passwordConfirm]);

  const isFormValid = 
    formData.name.trim() !== "" &&
    formData.nickname.trim() !== "" &&
    formData.ageGroup !== "" &&
    formData.email.trim() !== "" &&
    formData.password.trim() !== "" &&
    formData.passwordConfirm.trim() !== "" &&
    passwordMatch &&
    termsAccepted;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!isFormValid) return;

    setIsLoading(true);

    try {
      await register({
        name: formData.name,
        nickname: formData.nickname,
        email: formData.email,
        password: formData.password,
        ageGroup: formData.ageGroup,
      });
      toast({
        title: "회원가입 성공!",
        description: "AI Nexus에 오신 것을 환영합니다.",
        duration: 2000,
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: error.message,
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-xl shadow-lg" />
        <h1 className="text-2xl font-bold tracking-tight">AI Nexus 회원가입</h1>
        <p className="text-muted-foreground">생성형 AI 시대를 위한 커뮤니티</p>
      </div>

      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader>
          <CardTitle className="text-center">계정 만들기</CardTitle>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름 <span className="text-destructive">*</span></Label>
              <Input 
                id="name" 
                name="name" 
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="홍길동"
                required 
                data-testid="input-name" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">닉네임 <span className="text-destructive">*</span></Label>
              <Input 
                id="nickname" 
                name="nickname" 
                value={formData.nickname}
                onChange={(e) => handleChange("nickname", e.target.value)}
                placeholder="멋진닉네임"
                required 
                autoCapitalize="off"
                autoCorrect="off"
                data-testid="input-nickname" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ageGroup">연령대 <span className="text-destructive">*</span></Label>
              <Select 
                value={formData.ageGroup} 
                onValueChange={(value) => handleChange("ageGroup", value)}
                required
              >
                <SelectTrigger id="ageGroup" data-testid="select-age-group">
                  <SelectValue placeholder="연령대를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_GROUPS.map((age) => (
                    <SelectItem key={age} value={age}>
                      {age}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">이메일 <span className="text-destructive">*</span></Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="name@example.com" 
                required 
                autoCapitalize="off"
                autoCorrect="off"
                data-testid="input-email" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 <span className="text-destructive">*</span></Label>
              <Input 
                id="password" 
                name="password" 
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required 
                data-testid="input-password" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">비밀번호 확인 <span className="text-destructive">*</span></Label>
              <Input 
                id="passwordConfirm" 
                name="passwordConfirm" 
                type="password"
                value={formData.passwordConfirm}
                onChange={(e) => handleChange("passwordConfirm", e.target.value)}
                required 
                data-testid="input-password-confirm" 
              />
              {!passwordMatch && formData.passwordConfirm && (
                <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>비밀번호가 일치하지 않습니다.</span>
                </div>
              )}
            </div>

            <div className="flex items-start space-x-2 pt-2">
              <Checkbox 
                id="terms" 
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                data-testid="checkbox-terms"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="link" 
                        className="h-auto p-0 text-sm font-medium"
                        type="button"
                      >
                        이용약관
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>이용약관</DialogTitle>
                        <DialogDescription>
                          AI Nexus 서비스 이용약관입니다.
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="h-[400px] w-full pr-4">
                        <div className="space-y-4 text-sm">
                          <section>
                            <h3 className="font-semibold mb-2">제1조 (목적)</h3>
                            <p className="text-muted-foreground">
                              이 약관은 AI Nexus(이하 "회사")가 제공하는 커뮤니티 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
                            </p>
                          </section>
                          <section>
                            <h3 className="font-semibold mb-2">제2조 (정의)</h3>
                            <p className="text-muted-foreground">
                              1. "서비스"란 회사가 제공하는 AI 관련 커뮤니티 플랫폼을 의미합니다.<br />
                              2. "회원"이란 회사와 서비스 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 자를 말합니다.<br />
                              3. "게시물"이란 회원이 서비스를 이용함에 있어 서비스에 게시한 글, 사진, 동영상 및 각종 파일과 링크 등을 의미합니다.
                            </p>
                          </section>
                          <section>
                            <h3 className="font-semibold mb-2">제3조 (약관의 게시와 개정)</h3>
                            <p className="text-muted-foreground">
                              회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.
                            </p>
                          </section>
                          <section>
                            <h3 className="font-semibold mb-2">제4조 (회원가입)</h3>
                            <p className="text-muted-foreground">
                              1. 회원가입은 이용자가 약관의 내용에 대하여 동의를 한 다음 회원가입신청을 하고 회사가 이러한 신청에 대하여 승낙함으로써 체결됩니다.<br />
                              2. 회사는 다음 각 호에 해당하는 신청에 대하여는 승낙을 하지 않거나 사후에 이용계약을 해지할 수 있습니다.<br />
                              - 타인의 명의를 이용한 경우<br />
                              - 허위의 정보를 기재하거나, 회사가 제시하는 내용을 기재하지 않은 경우
                            </p>
                          </section>
                          <section>
                            <h3 className="font-semibold mb-2">제5조 (개인정보보호)</h3>
                            <p className="text-muted-foreground">
                              회사는 관련법령이 정하는 바에 따라 회원 등록정보를 포함한 회원의 개인정보를 보호하기 위해 노력합니다. 회원 개인정보의 보호 및 사용에 대해서는 관련법령 및 회사의 개인정보처리방침이 적용됩니다.
                            </p>
                          </section>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                  {" "}에 동의합니다. <span className="text-destructive">*</span>
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              className="w-full" 
              type="submit" 
              disabled={!isFormValid || isLoading} 
              data-testid="button-signup"
            >
              {isLoading ? "가입 중..." : "회원가입"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                로그인
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
