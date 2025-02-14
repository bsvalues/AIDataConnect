import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  insertDataSourceSchema, 
  type InsertDataSource,
  sqlConfigSchema,
  apiConfigSchema,
  cloudStorageConfigSchema
} from "@shared/schema";
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage,
  FormDescription 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { 
  Database,
  Globe,
  HardDrive,
  Key,
  Lock,
  Server,
  User
} from "lucide-react";

const sourceTypes = [
  { 
    value: "sql", 
    label: "SQL Database",
    icon: Database,
    description: "Connect to SQL databases like PostgreSQL, MySQL, etc."
  },
  { 
    value: "api", 
    label: "REST API",
    icon: Globe,
    description: "Connect to REST APIs with custom authentication"
  },
  { 
    value: "cloud_storage", 
    label: "Cloud Storage",
    icon: HardDrive,
    description: "Connect to S3, Google Cloud Storage, or Azure Blob"
  }
];

const sqlDialects = [
  { value: "sqlserver", label: "SQL Server", icon: Database },
  { value: "postgres", label: "PostgreSQL", icon: Database },
  { value: "mysql", label: "MySQL", icon: Database }
];

export function DataSourceForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState("sql");

  const form = useForm<InsertDataSource>({
    resolver: zodResolver(insertDataSourceSchema),
    defaultValues: {
      name: "",
      type: "sql",
      config: {
        type: "sql",
        config: {
          dialect: "sqlserver",
          host: "",
          port: 1433,
          database: "",
          username: "",
          password: "",
          encrypt: true,
          trustedConnection: false,
          instanceName: ""
        }
      },
      userId: 1 // Mock user ID
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: InsertDataSource) => {
      console.log('Submitting data source:', values);
      const res = await apiRequest("POST", "/api/data-sources", values);
      const data = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Data source created",
        description: "Your data source has been created successfully"
      });
      form.reset();
    },
    onError: (error: Error) => {
      console.error('Data source creation error:', error);
      toast({
        title: "Error creating data source",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const renderConfigFields = () => {
    switch (sourceType) {
      case "sql":
        return (
          <>
            <FormField
              control={form.control}
              name="config.config.dialect"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select database type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sqlDialects.map((dialect) => (
                        <SelectItem key={dialect.value} value={dialect.value}>
                          <div className="flex items-center gap-2">
                            <dialect.icon className="w-4 h-4" />
                            <span>{dialect.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server Name/IP</FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Server className="w-4 h-4 text-muted-foreground" />
                      <Input placeholder="localhost or server name" {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>
                    For SQL Server, you can use server name or IP address
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.instanceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instance Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="SQLEXPRESS" {...field} />
                  </FormControl>
                  <FormDescription>
                    Leave empty for default instance
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="1433" 
                      {...field} 
                      onChange={e => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.database"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Name</FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <Input placeholder="master" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.trustedConnection"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Windows Authentication</FormLabel>
                    <FormDescription>
                      Use Windows integrated security
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {!form.watch("config.config.trustedConnection") && (
              <>
                <FormField
                  control={form.control}
                  name="config.config.username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <Input placeholder="sa" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.config.password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-2">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                          <Input type="password" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="config.config.encrypt"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Encrypt Connection</FormLabel>
                    <FormDescription>
                      Use encryption for data sent between client and server
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        );

      // Add other connector types here
      default:
        return null;
    }
  };

  async function onSubmit(values: InsertDataSource) {
    try {
      await createMutation.mutate(values);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Data Source" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select 
                onValueChange={(value) => {
                  field.onChange(value);
                  setSourceType(value);
                  form.reset({
                    ...form.getValues(),
                    config: {
                      type: value,
                      config: {}
                    }
                  });
                }} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sourceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        <div>
                          <div>{type.label}</div>
                          <p className="text-xs text-muted-foreground">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          {renderConfigFields()}
        </div>

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Data Source"}
        </Button>
      </form>
    </Form>
  );
}