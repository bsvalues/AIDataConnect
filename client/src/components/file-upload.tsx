import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FileUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useFtp, setUseFtp] = useState(false);
  const [ftpConfig, setFtpConfig] = useState({
    host: "",
    port: 21,
    user: "",
    password: "",
    secure: true,
    passive: true
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      if (useFtp) {
        formData.append("transferType", "ftp");
        formData.append("ftpConfig", JSON.stringify(ftpConfig));
      }

      const res = await fetch("/api/files", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File uploaded successfully",
        description: "Your file has been uploaded and analyzed"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="use-ftp"
          checked={useFtp}
          onCheckedChange={setUseFtp}
        />
        <Label htmlFor="use-ftp">Use FTP Transfer</Label>
      </div>

      {useFtp && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Server className="w-4 h-4 mr-2" />
              Configure FTP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>FTP Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  value={ftpConfig.host}
                  onChange={(e) => setFtpConfig(prev => ({
                    ...prev,
                    host: e.target.value
                  }))}
                  placeholder="ftp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={ftpConfig.port}
                  onChange={(e) => setFtpConfig(prev => ({
                    ...prev,
                    port: parseInt(e.target.value)
                  }))}
                  placeholder="21"
                />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={ftpConfig.user}
                  onChange={(e) => setFtpConfig(prev => ({
                    ...prev,
                    user: e.target.value
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={ftpConfig.password}
                  onChange={(e) => setFtpConfig(prev => ({
                    ...prev,
                    password: e.target.value
                  }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="secure-ftp"
                  checked={ftpConfig.secure}
                  onCheckedChange={(checked) => setFtpConfig(prev => ({
                    ...prev,
                    secure: checked
                  }))}
                />
                <Label htmlFor="secure-ftp">Use Secure FTP (FTPS)</Label>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/20"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        {isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <p>Drag & drop files here, or click to select files</p>
        )}
        {uploadMutation.isPending && (
          <div className="mt-4">
            <p>Uploading...</p>
          </div>
        )}
      </div>
    </div>
  );
}