import { useCallback, useState, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Server, Lock, AlertCircle } from "lucide-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = {
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
};

interface UploadError {
  type: 'validation' | 'network' | 'ftp' | 'server';
  message: string;
}

export function FileUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useFtp, setUseFtp] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [ftpConfig, setFtpConfig] = useState({
    host: "",
    port: 2121,
    user: "",
    password: "",
    secure: true,
    passive: true
  });

  const validateFile = useCallback((file: File): UploadError | null => {
    if (file.size > MAX_FILE_SIZE) {
      return {
        type: 'validation',
        message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
      };
    }

    if (!Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)) {
      return {
        type: 'validation',
        message: `Invalid file type: ${file.type}. Supported types: ${Object.values(ACCEPTED_FILE_TYPES).flat().join(', ')}`
      };
    }

    return null;
  }, []);

  const validateFtpConfig = useCallback((): string | null => {
    if (!ftpConfig.host) return "FTP host is required";
    if (!ftpConfig.port || ftpConfig.port < 1 || ftpConfig.port > 65535) return "Invalid FTP port (1-65535)";
    if (!ftpConfig.user) return "FTP username is required";
    if (!ftpConfig.password) return "FTP password is required";
    return null;
  }, [ftpConfig]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadError(null);
      setUploadProgress(0);

      const fileError = validateFile(file);
      if (fileError) {
        throw new Error(fileError.message);
      }

      if (useFtp) {
        const ftpError = validateFtpConfig();
        if (ftpError) {
          throw new Error(ftpError);
        }
      }

      const formData = new FormData();
      formData.append("file", file);

      formData.append("transferType", useFtp ? "ftp" : "local");
      if (useFtp) {
        formData.append("ftpConfig", JSON.stringify({
          ...ftpConfig,
          port: Number(ftpConfig.port)
        }));
      }

      try {
        // Create a custom fetch with progress tracking
        const controller = new AbortController();
        const signal = controller.signal;
        
        // We need to manually implement progress tracking since fetch doesn't support it directly
        const xhr = new XMLHttpRequest();
        const promise = new Promise((resolve, reject) => {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(progress);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.response));
              } catch (error) {
                resolve(xhr.response);
              }
            } else {
              reject(new Error(xhr.response || 'Upload failed'));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Network error occurred'));
          };

          xhr.open('POST', '/api/files');
          xhr.withCredentials = true; // Include credentials (cookies) for authentication
          xhr.send(formData);
        });

        const result = await promise;
        setUploadProgress(100);
        return result;
      } catch (error: any) {
        setUploadError({
          type: error.message.includes('Network') ? 'network' : 'server',
          message: error.message
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File uploaded successfully",
        description: useFtp ? "Your file has been uploaded via FTP and analyzed" : "Your file has been uploaded and analyzed"
      });
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      console.error('File upload error:', error);
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive"
      });
      setUploadProgress(0);
    }
  });

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setUploadError(null);

    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map((file: any) => {
        const errorMessages = file.errors.map((err: any) => {
          switch (err.code) {
            case 'file-too-large':
              return `File "${file.file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
            case 'file-invalid-type':
              return `File "${file.file.name}" has an invalid type. Supported types: ${Object.values(ACCEPTED_FILE_TYPES).flat().join(', ')}`;
            default:
              return err.message;
          }
        }).join(", ");
        return errorMessages;
      }).join("\n");

      setUploadError({
        type: 'validation',
        message: errors
      });
      return;
    }

    if (acceptedFiles.length === 0) {
      setUploadError({
        type: 'validation',
        message: "Please select a valid file to upload"
      });
      return;
    }

    if (useFtp) {
      const error = validateFtpConfig();
      if (error) {
        setUploadError({
          type: 'ftp',
          message: error
        });
        return;
      }
    }

    acceptedFiles.forEach(file => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation, useFtp, validateFtpConfig]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    accept: ACCEPTED_FILE_TYPES,
    multiple: false
  });

  const supportedFileTypes = useMemo(() => {
    return Object.values(ACCEPTED_FILE_TYPES)
      .flat()
      .join(', ');
  }, []);

  return (
    <div className="space-y-4">
      {uploadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>
            {uploadError.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
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
                <DialogDescription>
                  Configure your FTP connection settings for secure file transfers.
                </DialogDescription>
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
          "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors relative",
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
            <p className="text-sm text-muted-foreground">
              Supported file types: {supportedFileTypes}
            </p>
            {useFtp && (
              <p className="text-sm text-muted-foreground">
                Files will be uploaded using FTP
              </p>
            )}
          </div>
        )}
        {uploadMutation.isPending && (
          <div className="mt-4 space-y-2">
            <p>Uploading{useFtp ? " via FTP" : ""}...</p>
            {uploadProgress > 0 && (
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}