import { useQuery } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { FilePreview } from "@/components/file-preview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { File } from "@shared/schema";

export default function FileExplorer() {
  const filesQuery = useQuery<File[]>({
    queryKey: ["/api/files"]
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">File Explorer</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-8"
            />
          </div>
          <Button>Search</Button>
        </div>
      </div>

      <div className="mb-8">
        <FileUpload />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filesQuery.isLoading ? (
          <p>Loading files...</p>
        ) : filesQuery.error ? (
          <p>Error loading files</p>
        ) : (
          filesQuery.data?.map((file) => (
            <FilePreview key={file.id} file={file} />
          ))
        )}
      </div>
    </div>
  );
}
