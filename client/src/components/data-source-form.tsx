import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertDataSourceSchema, type InsertDataSource } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const sourceTypes = [
  { value: "csv", label: "CSV File" },
  { value: "json", label: "JSON" },
  { value: "api", label: "REST API" }
];

export function DataSourceForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertDataSource>({
    resolver: zodResolver(insertDataSourceSchema),
    defaultValues: {
      name: "",
      type: "csv",
      config: {},
      userId: 1 // Mock user ID
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: InsertDataSource) => {
      const res = await apiRequest("POST", "/api/data-sources", values);
      return res.json();
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
      toast({
        title: "Error creating data source",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-6">
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sourceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Data Source"}
        </Button>
      </form>
    </Form>
  );
}