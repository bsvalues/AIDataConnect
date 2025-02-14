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
import { Wand2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      const res = await apiRequest("POST", "/api/suggest-transformations", { data });
      return res.json();
    },
    onSuccess: (data: Transformation[]) => {
      setSuggestions(data);
      toast({
        title: "Suggestions Ready",
        description: "AI has analyzed your data and suggested transformations",
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

  if (suggestions.length === 0) {
    return (
      <Button
        onClick={() => suggestMutation.mutate()}
        disabled={suggestMutation.isPending}
        variant="secondary"
        className="w-full"
      >
        <Wand2 className="w-4 h-4 mr-2" />
        {suggestMutation.isPending ? "Analyzing..." : "Get AI Suggestions"}
      </Button>
    );
  }

  return (
    <ScrollArea className="h-[300px] pr-4">
      <div className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-sm">{suggestion.name}</CardTitle>
              <CardDescription className="text-xs">
                {suggestion.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-xs bg-muted p-2 rounded block">
                {suggestion.transformation}
              </code>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onApply(suggestion.transformation)}
              >
                Apply Transformation
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
