import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, UserCog, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface User {
  id: string;
  name: string;
  nickname: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ userId: string; currentRole: string } | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", nickname: "" });

  useEffect(() => {
    // AdminLayout이 이미 인증을 확인했으므로, 바로 데이터를 로드
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    try {
      const response = await authFetch("/api/auth/me");
      if (response.ok) {
        const user = await response.json();
        setCurrentUser(user);
      }
      await loadUsers();
    } catch (error) {
      console.error("Failed to load user and data:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await authFetch("/api/admin/users");

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      toast({
        title: "데이터 로드 실패",
        description: "회원 정보를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const response = await authFetch(`/api/admin/users/${deleteTarget}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast({
        title: "삭제 완료",
        description: "회원이 삭제되었습니다.",
      });

      setDeleteTarget(null);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget) return;

    try {
      const newRole = roleChangeTarget.currentRole === "admin" ? "user" : "admin";
      
      const response = await authFetch(`/api/admin/users/${roleChangeTarget.userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast({
        title: "역할 변경 완료",
        description: `사용자 역할이 ${newRole === "admin" ? "관리자" : "일반 사용자"}로 변경되었습니다.`,
      });

      setRoleChangeTarget(null);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "역할 변경 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: User) => {
    setEditTarget(user);
    setEditForm({ name: user.name, nickname: user.nickname });
  };

  const handleEdit = async () => {
    if (!editTarget) return;

    if (!editForm.name.trim() || !editForm.nickname.trim()) {
      toast({
        title: "입력 오류",
        description: "이름과 닉네임을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await authFetch(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          nickname: editForm.nickname.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast({
        title: "수정 완료",
        description: "사용자 정보가 수정되었습니다.",
      });

      setEditTarget(null);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "수정 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">회원 관리</h2>
        <p className="text-sm text-muted-foreground">모든 회원을 확인하고 관리할 수 있습니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>회원 목록</CardTitle>
          <CardDescription>총 {users.length}명의 회원</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>닉네임</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    회원이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.nickname}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span
                        className={
                          user.role === "admin"
                            ? "px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                            : "px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        }
                      >
                        {user.role === "admin" ? "관리자" : "일반"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(user.createdAt), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Edit className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRoleChangeTarget({ userId: user.id, currentRole: user.role })}
                          data-testid={`button-role-user-${user.id}`}
                        >
                          <UserCog className="h-4 w-4 text-blue-600" />
                        </Button>
                        {currentUser && user.id !== currentUser.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(user.id)}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 취소할 수 없습니다. 회원이 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!roleChangeTarget} onOpenChange={() => setRoleChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 변경</AlertDialogTitle>
            <AlertDialogDescription>
              사용자 역할을 {roleChangeTarget?.currentRole === "admin" ? "일반 사용자" : "관리자"}로 변경하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-role-change">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange} data-testid="button-confirm-role-change">
              변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>사용자 정보 수정</DialogTitle>
            <DialogDescription>
              사용자의 이름과 닉네임을 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">이름</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-nickname">닉네임</Label>
              <Input
                id="edit-nickname"
                value={editForm.nickname}
                onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                data-testid="input-edit-nickname"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} data-testid="button-cancel-edit">
              취소
            </Button>
            <Button onClick={handleEdit} data-testid="button-confirm-edit">
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
