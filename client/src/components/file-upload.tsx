import { useCallback, useState } from "react";
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

export function FileUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useFtp, setUseFtp] = useState(false);
  const [ftpConfig, setFtpConfig] = useState({
    host: "",
    port: 2121, // Updated to match our FTP server port
    user: "",
    password: "",
    secure: true,
    passive: true
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log('Starting file upload with FTP:', useFtp); // Debug log
      const formData = new FormData();
      formData.append("file", file);

      if (useFtp) {
        console.log('Adding FTP config:', { ...ftpConfig, password: '[REDACTED]' }); // Debug log
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
        description: useFtp ? "Your file has been uploaded via FTP and analyzed" : "Your file has been uploaded and analyzed"
      });
    },
    onError: (error: Error) => {
      console.error('File upload error:', error); // Debug log
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (useFtp && (!ftpConfig.host || !ftpConfig.user || !ftpConfig.password)) {
      toast({
        title: "FTP Configuration Required",
        description: "Please configure FTP settings before uploading",
        variant: "destructive"
      });
      return;
    }

    acceptedFiles.forEach(file => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation, useFtp, ftpConfig]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

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
                    placeholder="2121"
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