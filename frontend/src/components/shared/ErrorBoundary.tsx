import React, { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusAlert } from '@/components/shared/StatusAlert';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Bug01Icon } from '@hugeicons/core-free-icons';
import { OpenBugReport } from '../../../wailsjs/go/main/App';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">
                Something went wrong
              </CardTitle>
              <CardDescription>
                An unexpected error occurred
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusAlert
                variant="destructive"
                icon={
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    className="size-4"
                    strokeWidth={2}
                  />
                }
              >
                <span className="font-mono break-words">
                  {this.state.error.message}
                </span>
              </StatusAlert>
              <div className="flex gap-2">
                <Button onClick={this.reset} className="flex-1">
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => OpenBugReport()}
                  className="flex-1"
                >
                  <HugeiconsIcon
                    icon={Bug01Icon}
                    className="size-4 mr-2"
                    strokeWidth={2}
                  />
                  Report Bug
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
