import { useCallback, useState, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Server, Lock } from "lucide-react";
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useFtp, setUseFtp] = useState(false);
  const [ftpConfig, setFtpConfig] = useState({
    host: "",
    port: 2121,
    user: "",
    password: "",
    secure: true,
    passive: true
  });

  const validateFtpConfig = useCallback(() => {
    if (!ftpConfig.host) return "FTP host is required";
    if (!ftpConfig.port || ftpConfig.port < 1) return "Invalid FTP port";
    if (!ftpConfig.user) return "FTP username is required";
    if (!ftpConfig.password) return "FTP password is required";
    return null;
  }, [ftpConfig]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const validationError = useFtp ? validateFtpConfig() : null;
      if (validationError) {
        throw new Error(validationError);
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      }

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
        throw new Error(error.message || "Upload failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File uploaded successfully",
        description: useFtp ? "Your file has been uploaded via FTP and analyzed" : "Your file has been uploaded and analyzed"
      });
    },
    onError: (error: Error) => {
      console.error('File upload error:', error);
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      toast({
        title: "Invalid file",
        description: "Please select a valid file to upload",
        variant: "destructive"
      });
      return;
    }

    if (useFtp) {
      const error = validateFtpConfig();
      if (error) {
        toast({
          title: "FTP Configuration Error",
          description: error,
          variant: "destructive"
        });
        return;
      }
    }

    acceptedFiles.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
          variant: "destructive"
        });
        return;
      }
      uploadMutation.mutate(file);
    });
  }, [uploadMutation, useFtp, validateFtpConfig, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
              <Button variant="outline">
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
                      host: e.target.value.trim()
                    }))}
                    placeholder="ftp.example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={ftpConfig.port}
                    onChange={(e) => setFtpConfig(prev => ({
                      ...prev,
                      port: parseInt(e.target.value) || 2121
                    }))}
                    placeholder="2121"
                    required
                    min={1}
                    max={65535}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={ftpConfig.user}
                    onChange={(e) => setFtpConfig(prev => ({
                      ...prev,
                      user: e.target.value.trim()
                    }))}
                    required
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
                    required
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
                <div className="flex items-center space-x-2">
                  <Switch
                    id="passive-ftp"
                    checked={ftpConfig.passive}
                    onCheckedChange={(checked) => setFtpConfig(prev => ({
                      ...prev,
                      passive: checked
                    }))}
                  />
                  <Label htmlFor="passive-ftp">Use Passive Mode</Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/20",
          uploadMutation.isPending && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} disabled={uploadMutation.isPending} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        {isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <div className="space-y-2">
            <p>Drag & drop files here, or click to select files</p>
            <p className="text-sm text-muted-foreground">
              Maximum file size: {MAX_FILE_SIZE / 1024 / 1024}MB
            </p>
            {useFtp && (
              <p className="text-sm text-muted-foreground">
                Files will be uploaded using FTP
              </p>
            )}
          </div>
        )}
        {uploadMutation.isPending && (
          <div className="mt-4">
            <p>Uploading{useFtp ? " via FTP" : ""}...</p>
          </div>
        )}
      </div>
    </div>
  );
}