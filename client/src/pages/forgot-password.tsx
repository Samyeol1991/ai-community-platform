import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import logoUrl from "@assets/generated_images/modern_abstract_ai_community_logo.png";

const AGE_GROUPS = [
  { value: "10대", label: "10대" },
  { value: "20대", label: "20대" },
  { value: "30대", label: "30대" },
  { value: "40대", label: "40대" },
  { value: "50대", label: "50대" },
  { value: "60대 이상", label: "60대 이상" },
];

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"verify" | "reset" | "complete">("verify");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [verifyForm, setVerifyForm] = useState({
    email: "",
    name: "",
    ageGroup: "",
  });

  const [resetForm, setResetForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const data = await response.json();
      setUserId(data.userId);
      setStep("reset");
      toast({
        title: "본인 확인 완료",
        description: "새로운 비밀번호를 설정해주세요.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "본인 확인 실패",
        description: error.message || "입력하신 정보와 일치하는 계정을 찾을 수 없습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast({
        variant: "destructive",
        title: "비밀번호 불일치",
        description: "새 비밀번호가 일치하지 않습니다.",
      });
      return;
    }

    if (resetForm.newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "비밀번호 오류",
        description: "비밀번호는 최소 6자 이상이어야 합니다.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          newPassword: resetForm.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      setStep("complete");
      toast({
        title: "비밀번호 변경 완료",
        description: "새로운 비밀번호로 로그인해주세요.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "비밀번호 변경 실패",
        description: error.message || "비밀번호 변경 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-xl shadow-lg" />
        <h1 className="text-2xl font-bold tracking-tight">비밀번호 찾기</h1>
        <p className="text-muted-foreground">등록된 정보로 본인 확인 후 비밀번호를 재설정합니다</p>
      </div>

      <Card className="w-full max-w-md border-border/60 shadow-xl">
        {step === "verify" && (
          <>
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <KeyRound className="h-5 w-5" />
                본인 확인
              </CardTitle>
              <CardDescription className="text-center">
                가입 시 등록한 이메일, 이름, 연령대를 입력해주세요
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleVerify}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={verifyForm.email}
                    onChange={(e) => setVerifyForm({ ...verifyForm, email: e.target.value })}
                    required
                    autoCapitalize="off"
                    autoCorrect="off"
                    data-testid="input-verify-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="실명을 입력하세요"
                    value={verifyForm.name}
                    onChange={(e) => setVerifyForm({ ...verifyForm, name: e.target.value })}
                    required
                    data-testid="input-verify-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ageGroup">연령대</Label>
                  <Select
                    value={verifyForm.ageGroup}
                    onValueChange={(value) => setVerifyForm({ ...verifyForm, ageGroup: value })}
                    required
                  >
                    <SelectTrigger data-testid="select-verify-age-group">
                      <SelectValue placeholder="연령대를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_GROUPS.map((group) => (
                        <SelectItem key={group.value} value={group.value}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  className="w-full"
                  type="submit"
                  disabled={isLoading || !verifyForm.email || !verifyForm.name || !verifyForm.ageGroup}
                  data-testid="button-verify"
                >
                  {isLoading ? "확인 중..." : "본인 확인"}
                </Button>
                <Link href="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-4 w-4" />
                  로그인으로 돌아가기
                </Link>
              </CardFooter>
            </form>
          </>
        )}

        {step === "reset" && (
          <>
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <KeyRound className="h-5 w-5" />
                새 비밀번호 설정
              </CardTitle>
              <CardDescription className="text-center">
                새로운 비밀번호를 입력해주세요
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleResetPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">새 비밀번호</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="최소 6자 이상"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    required
                    minLength={6}
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    required
                    data-testid="input-confirm-password"
                  />
                  {resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword && (
                    <p className="text-sm text-destructive">비밀번호가 일치하지 않습니다.</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  className="w-full"
                  type="submit"
                  disabled={isLoading || !resetForm.newPassword || !resetForm.confirmPassword}
                  data-testid="button-reset-password"
                >
                  {isLoading ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </CardFooter>
            </form>
          </>
        )}

        {step === "complete" && (
          <>
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                비밀번호 변경 완료
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-6">
              <p className="text-muted-foreground">
                비밀번호가 성공적으로 변경되었습니다.<br />
                새로운 비밀번호로 로그인해주세요.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-go-login"
              >
                로그인하러 가기
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
