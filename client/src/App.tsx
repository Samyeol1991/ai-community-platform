import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import AdminLayout from "@/components/admin-layout";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Editor from "@/pages/editor";
import PostDetail from "@/pages/post";
import Profile from "@/pages/profile";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminPosts from "@/pages/admin-posts";
import AdminUsers from "@/pages/admin-users";
import AdminCategories from "@/pages/admin-categories";
import AdminFlaggedPosts from "@/pages/admin-flagged-posts";
import AdminComments from "@/pages/admin-comments";
import AdminAiManagement from "@/pages/admin-ai-management";
import AdminGptCosts from "@/pages/admin-gpt-costs";
import ForgotPassword from "@/pages/forgot-password";
import SearchPage from "@/pages/search";

function Router() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/posts">
        <AdminLayout>
          <AdminPosts />
        </AdminLayout>
      </Route>
      <Route path="/admin/users">
        <AdminLayout>
          <AdminUsers />
        </AdminLayout>
      </Route>
      <Route path="/admin/categories">
        <AdminLayout>
          <AdminCategories />
        </AdminLayout>
      </Route>
      <Route path="/admin/flagged-posts">
        <AdminLayout>
          <AdminFlaggedPosts />
        </AdminLayout>
      </Route>
      <Route path="/admin/comments">
        <AdminLayout>
          <AdminComments />
        </AdminLayout>
      </Route>
      <Route path="/admin/ai-management">
        <AdminLayout>
          <AdminAiManagement />
        </AdminLayout>
      </Route>
      <Route path="/admin/gpt-costs">
        <AdminLayout>
          <AdminGptCosts />
        </AdminLayout>
      </Route>
      <Route path="/admin">
        <AdminLayout>
          <AdminDashboard />
        </AdminLayout>
      </Route>
      <Route path="/">
        <Layout>
          <Home />
        </Layout>
      </Route>
      <Route path="/latest">
        <Layout>
          <Home sortBy="latest" />
        </Layout>
      </Route>
      <Route path="/popular">
        <Layout>
          <Home sortBy="popular" />
        </Layout>
      </Route>
      <Route path="/category/:slug">
        <Layout>
          <Home />
        </Layout>
      </Route>
      <Route path="/search">
        <Layout>
          <SearchPage />
        </Layout>
      </Route>
      <Route path="/login">
        <Layout>
          <Login />
        </Layout>
      </Route>
      <Route path="/signup">
        <Layout>
          <Signup />
        </Layout>
      </Route>
      <Route path="/forgot-password">
        <Layout>
          <ForgotPassword />
        </Layout>
      </Route>
      <Route path="/editor">
        <Layout>
          <Editor />
        </Layout>
      </Route>
      <Route path="/profile">
        <Layout>
          <Profile />
        </Layout>
      </Route>
      <Route path="/post/:id">
        <Layout>
          <PostDetail />
        </Layout>
      </Route>
      <Route>
        <Layout>
          <NotFound />
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <SonnerToaster position="bottom-right" richColors />
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
