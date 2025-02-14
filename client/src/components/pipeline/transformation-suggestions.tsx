import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wand2, InfoIcon, Copy } from "lucide-react";

interface Transformation {
  name: string;
  description: string;
  transformation: string;
}

interface TransformationSuggestionsProps {
  data: any;
  onApply: (transformation: string) => void;
}

export function TransformationSuggestions({ data, onApply }: TransformationSuggestionsProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Transformation[]>([]);

  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!data) {
        throw new Error("No data available for analysis");
      }
      const res = await apiRequest("POST", "/api/suggest-transformations", { data });
      return res.json();
    },
    onSuccess: (data: Transformation[]) => {
      setSuggestions(data);
      toast({
        title: "AI Suggestions Ready",
        description: "Our AI has analyzed your data and suggested transformations",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error getting suggestions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!data) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <InfoIcon className="w-6 h-6 mx-auto mb-2" />
        <p>Connect a data source to get AI-powered suggestions</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">AI Suggestions</h3>
            <p className="text-sm text-muted-foreground">
              Get smart transformation suggestions based on your data
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => suggestMutation.mutate()}
                  disabled={suggestMutation.isPending}
                  variant="secondary"
                  className="w-[200px]"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {suggestMutation.isPending ? "Analyzing..." : "Get AI Suggestions"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Let AI analyze your data and suggest useful transformations</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Suggested Transformations</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSuggestions([])}
        >
          Clear Suggestions
        </Button>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="space-y-4 pr-4">
          {suggestions.map((suggestion, index) => (
            <Card key={index} className="relative group">
              <CardHeader>
                <CardTitle className="text-sm">{suggestion.name}</CardTitle>
                <CardDescription className="text-xs">
                  {suggestion.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                  <code>{suggestion.transformation}</code>
                </pre>
              </CardContent>
              <CardFooter className="justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(suggestion.transformation);
                    toast({
                      title: "Copied",
                      description: "Transformation copied to clipboard",
                    });
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onApply(suggestion.transformation)}
                >
                  Apply
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}