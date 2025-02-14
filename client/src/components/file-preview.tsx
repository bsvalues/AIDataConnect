import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileIcon, FileText } from "lucide-react";
import type { File } from "@shared/schema";

interface FilePreviewProps {
  file: File;
}

export function FilePreview({ file }: FilePreviewProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <FileIcon className="h-8 w-8 text-muted-foreground" />
        <div className="flex-1">
          <CardTitle className="text-lg">{file.name}</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{file.type}</Badge>
            <span className="text-sm text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {file.aiSummary && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">AI Summary</h4>
            <p className="text-sm text-muted-foreground">{file.aiSummary}</p>
          </div>
        )}
        {file.category && (
          <div className="mt-4">
            <Badge>{file.category}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
