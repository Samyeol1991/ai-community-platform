import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function AdminCategories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [subcategoryDialog, setSubcategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", tags: "", order: 0 });
  const [subcategoryForm, setSubcategoryForm] = useState({ categoryId: "", name: "", slug: "", tags: "", order: 0 });

  useEffect(() => {
    // AdminLayout이 이미 인증을 확인했으므로, 바로 데이터를 로드
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await authFetch("/api/admin/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      toast({
        title: "데이터 로드 실패",
        description: "카테고리를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCreateCategory = async () => {
    try {
      const tags = categoryForm.tags.split(',').map(t => t.trim()).filter(t => t);
      // 한글 지원: 공백을 하이픈으로, 특수문자만 제거
      const slug = categoryForm.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w가-힣-]/g, '')  // 한글, 영문, 숫자, 하이픈만 허용
        || `category-${Date.now()}`;
      
      const response = await authFetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          slug: slug,
          tags,
          order: categoryForm.order,
        }),
      });

      if (!response.ok) {
        throw new Error("카테고리 생성에 실패했습니다.");
      }

      toast({
        title: "생성 완료",
        description: "카테고리가 생성되었습니다.",
      });

      setCategoryDialog(false);
      setCategoryForm({ name: "", slug: "", tags: "", order: 0 });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      const tags = categoryForm.tags.split(',').map(t => t.trim()).filter(t => t);
      // 한글 지원: 공백을 하이픈으로, 특수문자만 제거
      const slug = categoryForm.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w가-힣-]/g, '')  // 한글, 영문, 숫자, 하이픈만 허용
        || categoryForm.slug;
      
      const response = await authFetch(`/api/admin/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          slug: slug,
          tags,
          order: categoryForm.order,
        }),
      });

      if (!response.ok) {
        throw new Error("카테고리 수정에 실패했습니다.");
      }

      toast({
        title: "수정 완료",
        description: "카테고리가 수정되었습니다.",
      });

      setCategoryDialog(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", slug: "", tags: "", order: 0 });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "수정 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const response = await authFetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("카테고리 삭제에 실패했습니다.");
      }

      toast({
        title: "삭제 완료",
        description: "카테고리가 삭제되었습니다.",
      });

      loadCategories();
    } catch (error: any) {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateSubcategory = async () => {
    try {
      const tags = subcategoryForm.tags.split(',').map(t => t.trim()).filter(t => t);
      // 한글 지원: 공백을 하이픈으로, 특수문자만 제거
      const slug = subcategoryForm.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w가-힣-]/g, '')  // 한글, 영문, 숫자, 하이픈만 허용
        || `subcategory-${Date.now()}`;
      
      const response = await authFetch("/api/admin/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: subcategoryForm.categoryId,
          name: subcategoryForm.name,
          slug: slug,
          tags,
          order: subcategoryForm.order,
        }),
      });

      if (!response.ok) {
        throw new Error("소카테고리 생성에 실패했습니다.");
      }

      toast({
        title: "생성 완료",
        description: "소카테고리가 생성되었습니다.",
      });

      setSubcategoryDialog(false);
      setSubcategoryForm({ categoryId: "", name: "", slug: "", tags: "", order: 0 });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateSubcategory = async () => {
    if (!editingSubcategory) return;

    try {
      const tags = subcategoryForm.tags.split(',').map(t => t.trim()).filter(t => t);
      // 한글 지원: 공백을 하이픈으로, 특수문자만 제거
      const slug = subcategoryForm.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w가-힣-]/g, '')  // 한글, 영문, 숫자, 하이픈만 허용
        || subcategoryForm.slug;
      
      const response = await authFetch(`/api/admin/subcategories/${editingSubcategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: subcategoryForm.categoryId,
          name: subcategoryForm.name,
          slug: slug,
          tags,
          order: subcategoryForm.order,
        }),
      });

      if (!response.ok) {
        throw new Error("소카테고리 수정에 실패했습니다.");
      }

      toast({
        title: "수정 완료",
        description: "소카테고리가 수정되었습니다.",
      });

      setSubcategoryDialog(false);
      setEditingSubcategory(null);
      setSubcategoryForm({ categoryId: "", name: "", slug: "", tags: "", order: 0 });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "수정 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const response = await authFetch(`/api/admin/subcategories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("소카테고리 삭제에 실패했습니다.");
      }

      toast({
        title: "삭제 완료",
        description: "소카테고리가 삭제되었습니다.",
      });

      loadCategories();
    } catch (error: any) {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">카테고리 관리</h2>
        <p className="text-sm text-muted-foreground">대카테고리와 소카테고리를 관리할 수 있습니다.</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>대카테고리 관리</CardTitle>
                <CardDescription>카테고리를 추가하고 관리할 수 있습니다.</CardDescription>
              </div>
            <Button
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: "", slug: "", tags: "", order: 0 });
                setCategoryDialog(true);
              }}
              data-testid="button-add-category"
            >
              <Plus className="h-4 w-4 mr-2" />
              카테고리 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>태그</TableHead>
                <TableHead>순서</TableHead>
                <TableHead>소카테고리 수</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    카테고리가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.tags?.join(', ') || '-'}</TableCell>
                    <TableCell>{category.order}</TableCell>
                    <TableCell>{category.subcategories.length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryForm({ 
                              name: category.name, 
                              slug: category.slug, 
                              tags: category.tags?.join(', ') || '', 
                              order: category.order 
                            });
                            setCategoryDialog(true);
                          }}
                          data-testid={`button-edit-category-${category.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                          data-testid={`button-delete-category-${category.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>소카테고리 관리</CardTitle>
              <CardDescription>소카테고리를 추가하고 관리할 수 있습니다.</CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingSubcategory(null);
                setSubcategoryForm({ categoryId: "", name: "", slug: "", tags: "", order: 0 });
                setSubcategoryDialog(true);
              }}
              data-testid="button-add-subcategory"
            >
              <Plus className="h-4 w-4 mr-2" />
              소카테고리 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>대카테고리</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>태그</TableHead>
                <TableHead>순서</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.flatMap(cat => cat.subcategories).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    소카테고리가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                categories.flatMap(cat =>
                  cat.subcategories.map(sub => (
                    <TableRow key={sub.id} data-testid={`row-subcategory-${sub.id}`}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>{sub.name}</TableCell>
                      <TableCell>{sub.tags?.join(', ') || '-'}</TableCell>
                      <TableCell>{sub.order}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSubcategory(sub);
                              setSubcategoryForm({ 
                                categoryId: sub.categoryId, 
                                name: sub.name, 
                                slug: sub.slug, 
                                tags: sub.tags?.join(', ') || '', 
                                order: sub.order 
                              });
                              setSubcategoryDialog(true);
                            }}
                            data-testid={`button-edit-subcategory-${sub.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSubcategory(sub.id)}
                            data-testid={`button-delete-subcategory-${sub.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "카테고리 수정" : "카테고리 추가"}</DialogTitle>
            <DialogDescription>카테고리 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">이름</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="예: AI 뉴스"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label htmlFor="category-tags">태그 (쉼표로 구분)</Label>
              <Input
                id="category-tags"
                value={categoryForm.tags}
                onChange={(e) => setCategoryForm({ ...categoryForm, tags: e.target.value })}
                placeholder="예: AI, 뉴스, GPT"
                data-testid="input-category-tags"
              />
              <p className="text-sm text-muted-foreground mt-1">여러 태그를 쉼표로 구분하여 입력하세요</p>
            </div>
            <div>
              <Label htmlFor="category-order">순서</Label>
              <Input
                id="category-order"
                type="number"
                value={categoryForm.order}
                onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                data-testid="input-category-order"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(false)} data-testid="button-cancel-category">
              취소
            </Button>
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              data-testid="button-save-category"
            >
              {editingCategory ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subcategoryDialog} onOpenChange={setSubcategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? "소카테고리 수정" : "소카테고리 추가"}</DialogTitle>
            <DialogDescription>소카테고리 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subcategory-category">대카테고리</Label>
              <Select
                value={subcategoryForm.categoryId}
                onValueChange={(value) => setSubcategoryForm({ ...subcategoryForm, categoryId: value })}
                disabled={!!editingSubcategory}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subcategory-name">이름</Label>
              <Input
                id="subcategory-name"
                value={subcategoryForm.name}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                placeholder="예: GPT-4"
                data-testid="input-subcategory-name"
              />
            </div>
            <div>
              <Label htmlFor="subcategory-tags">태그 (쉼표로 구분)</Label>
              <Input
                id="subcategory-tags"
                value={subcategoryForm.tags}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, tags: e.target.value })}
                placeholder="예: 챗봇, 번역, 생성"
                data-testid="input-subcategory-tags"
              />
              <p className="text-sm text-muted-foreground mt-1">여러 태그를 쉼표로 구분하여 입력하세요</p>
            </div>
            <div>
              <Label htmlFor="subcategory-order">순서</Label>
              <Input
                id="subcategory-order"
                type="number"
                value={subcategoryForm.order}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, order: parseInt(e.target.value) || 0 })}
                data-testid="input-subcategory-order"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubcategoryDialog(false)} data-testid="button-cancel-subcategory">
              취소
            </Button>
            <Button
              onClick={editingSubcategory ? handleUpdateSubcategory : handleCreateSubcategory}
              data-testid="button-save-subcategory"
            >
              {editingSubcategory ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
