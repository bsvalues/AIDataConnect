import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { FilePreview } from "@/components/file-preview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, FileX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { File } from "@shared/schema";

export default function FileExplorer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [queryResults, setQueryResults] = useState<number[]>([]);
  const { toast } = useToast();
  
  const filesQuery = useQuery<File[]>({
    queryKey: ["/api/files"]
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/search", { query });
      return response.json();
    },
    onSuccess: (data) => {
      setQueryResults(data.map((result: any) => result.id));
      if (data.length === 0) {
        toast({
          title: "No results found",
          description: "Try a different search term"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setQueryResults([]);
      return;
    }
    searchMutation.mutate(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredFiles = searchQuery && queryResults.length > 0 
    ? filesQuery.data?.filter(file => queryResults.includes(file.id)) 
    : filesQuery.data;

  const renderFileGrid = () => {
    if (filesQuery.isLoading) {
      return Array(6).fill(0).map((_, index) => (
        <div key={index} className="rounded-lg border p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-3 w-[150px]" />
            </div>
          </div>
          <Skeleton className="mt-4 h-24 w-full" />
        </div>
      ));
    }

    if (filesQuery.error) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
          <FileX className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Error loading files</h3>
          <p className="text-muted-foreground">
            There was a problem loading your files. Please try again.
          </p>
        </div>
      );
    }

    if (!filteredFiles?.length) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
          <FileX className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No files found</h3>
          <p className="text-muted-foreground">
            {searchQuery ? "No files match your search criteria" : "Upload files to get started"}
          </p>
        </div>
      );
    }

    return filteredFiles.map((file) => (
      <FilePreview key={file.id} file={file} />
    ));
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">File Explorer</h1>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={searchMutation.isPending}
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : "Search"}
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <FileUpload />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {renderFileGrid()}
      </div>
    </div>
  );
}
