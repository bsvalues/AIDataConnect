import React, { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { SidebarNav } from "@/components/sidebar-nav";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load components for better performance
const Dashboard = lazy(() => import("@/pages/dashboard"));
const FileExplorer = lazy(() => import("@/pages/file-explorer"));
const DataSources = lazy(() => import("@/pages/data-sources"));
const PipelineBuilder = lazy(() => import("@/pages/pipeline-builder"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading component
function PageLoader() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function Router() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-background">
        <div className="p-6">
          <h1 className="text-xl font-bold">RAG Drive</h1>
        </div>
        <SidebarNav />
      </aside>
      <main className="flex-1 p-6">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/files" component={FileExplorer} />
            <Route path="/data-sources" component={DataSources} />
            <Route path="/pipeline" component={PipelineBuilder} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <button
              className="mt-4 rounded bg-primary px-4 py-2 text-white"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;