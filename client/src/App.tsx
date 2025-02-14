
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { SidebarNav } from "@/components/sidebar-nav";
import Dashboard from "@/pages/dashboard";
import FileExplorer from "@/pages/file-explorer";
import DataSources from "@/pages/data-sources";
import NotFound from "@/pages/not-found";
import PipelineBuilder from "@/pages/pipeline-builder";

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
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/files" component={FileExplorer} />
          <Route path="/data-sources" component={DataSources} />
          <Route path="/pipeline" component={PipelineBuilder} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
