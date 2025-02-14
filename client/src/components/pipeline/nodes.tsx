import { memo, type ReactNode } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BaseNodeProps extends NodeProps {
  children?: ReactNode;
  className?: string;
}

const BaseNode = memo(({ data, children, className }: BaseNodeProps) => {
  return (
    <Card className={cn("w-[200px]", className)}>
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
});

export const SourceNode = memo(({ data, ...props }: NodeProps) => (
  <BaseNode data={data} {...props} className="border-blue-500">
    <Handle type="source" position={Position.Right} />
    <div className="text-xs">Data Source</div>
  </BaseNode>
));

export const TransformNode = memo(({ data, ...props }: NodeProps) => (
  <BaseNode data={data} {...props} className="border-green-500">
    <Handle type="target" position={Position.Left} />
    <div className="text-xs">Transform Data</div>
    <Handle type="source" position={Position.Right} />
  </BaseNode>
));

export const FilterNode = memo(({ data, ...props }: NodeProps) => (
  <BaseNode data={data} {...props} className="border-yellow-500">
    <Handle type="target" position={Position.Left} />
    <div className="text-xs">Filter Data</div>
    <Handle type="source" position={Position.Right} />
  </BaseNode>
));

export const JoinNode = memo(({ data, ...props }: NodeProps) => (
  <BaseNode data={data} {...props} className="border-purple-500">
    <Handle type="target" position={Position.Left} />
    <div className="text-xs">Join Data</div>
    <Handle type="source" position={Position.Right} />
  </BaseNode>
));

export const OutputNode = memo(({ data, ...props }: NodeProps) => (
  <BaseNode data={data} {...props} className="border-red-500">
    <Handle type="target" position={Position.Left} />
    <div className="text-xs">Output</div>
  </BaseNode>
));

BaseNode.displayName = 'BaseNode';
SourceNode.displayName = 'SourceNode';
TransformNode.displayName = 'TransformNode';
FilterNode.displayName = 'FilterNode';
JoinNode.displayName = 'JoinNode';
OutputNode.displayName = 'OutputNode';