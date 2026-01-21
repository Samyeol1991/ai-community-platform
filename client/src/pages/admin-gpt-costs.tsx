import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Zap, Activity, Calendar } from "lucide-react";
import { authFetch } from "@/lib/api";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface MonthlyStats {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { calls: number; tokens: number; cost: number }>;
  byFunction: Record<string, { calls: number; tokens: number; cost: number }>;
}

interface UsageLog {
  id: string;
  model: string;
  functionName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCost: string;
  outputCost: string;
  totalCost: string;
  createdAt: string;
}

const FUNCTION_NAMES: Record<string, string> = {
  analyzePostWithGPT4oMini: "게시글 분석",
  generateCommentWithGPT51: "댓글 생성",
  analyzeReplyNeed: "답글 필요성 분석",
  generateConstructiveFeedback: "건설적 피드백",
  analyzeUserCommentWithGPT51: "사용자 댓글 분석",
  generateInterventionResponse: "개입 응답",
  generateAggressiveIntervention: "적극적 개입",
  generateBotReplyToUserComment: "봇 답글",
};

export default function AdminGptCosts() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, logsRes] = await Promise.all([
        authFetch(`/api/admin/gpt-usage/monthly?year=${selectedYear}&month=${selectedMonth}`),
        authFetch(`/api/admin/gpt-usage/logs?startDate=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&endDate=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31`)
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (logsRes.ok) {
        setLogs(await logsRes.json());
      }
    } catch (error) {
      console.error("Failed to load GPT usage data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">GPT 비용 관리</h2>
          <p className="text-sm text-muted-foreground">OpenAI API 사용량 및 비용을 모니터링합니다</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-20" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month} value={String(month)}>{month}월</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 비용</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-cost">
              ${stats?.totalCost.toFixed(4) || "0.0000"}
            </div>
            <p className="text-xs text-muted-foreground">{selectedYear}년 {selectedMonth}월</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API 호출 수</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-calls">
              {stats?.totalCalls.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">총 호출 횟수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">사용 토큰</CardTitle>
            <Zap className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tokens">
              {stats?.totalTokens.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">입력 + 출력 토큰</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">모델별 사용량</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byModel && Object.keys(stats.byModel).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>모델</TableHead>
                    <TableHead className="text-right">호출</TableHead>
                    <TableHead className="text-right">토큰</TableHead>
                    <TableHead className="text-right">비용</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(stats.byModel).map(([model, data]) => (
                    <TableRow key={model}>
                      <TableCell className="font-mono text-xs">{model}</TableCell>
                      <TableCell className="text-right">{data.calls}</TableCell>
                      <TableCell className="text-right">{data.tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${data.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">기능별 사용량</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byFunction && Object.keys(stats.byFunction).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>기능</TableHead>
                    <TableHead className="text-right">호출</TableHead>
                    <TableHead className="text-right">토큰</TableHead>
                    <TableHead className="text-right">비용</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(stats.byFunction).map(([func, data]) => (
                    <TableRow key={func}>
                      <TableCell>{FUNCTION_NAMES[func] || func}</TableCell>
                      <TableCell className="text-right">{data.calls}</TableCell>
                      <TableCell className="text-right">{data.tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${data.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            상세 사용 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-4">로딩 중...</p>
          ) : logs.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>기능</TableHead>
                    <TableHead>모델</TableHead>
                    <TableHead className="text-right">입력 토큰</TableHead>
                    <TableHead className="text-right">출력 토큰</TableHead>
                    <TableHead className="text-right">비용</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                      <TableCell className="text-xs">
                        {format(new Date(log.createdAt), "M/d HH:mm", { locale: ko })}
                      </TableCell>
                      <TableCell>{FUNCTION_NAMES[log.functionName] || log.functionName}</TableCell>
                      <TableCell className="font-mono text-xs">{log.model}</TableCell>
                      <TableCell className="text-right">{log.promptTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{log.completionTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${parseFloat(log.totalCost).toFixed(6)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">선택한 기간에 사용 기록이 없습니다</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
