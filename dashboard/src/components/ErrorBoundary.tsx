import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from '@/lib/icon-map';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopy = async () => {
    if (!this.state.error) return;
    try {
      const text = this.state.error.stack || this.state.error.toString();
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* clipboard unavailable — details stay readable on screen */
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="w-full max-w-sm text-center animate-fade-in">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border">
              <AlertTriangle className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground/70 uppercase">Something broke</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              This view ran into a problem
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your files are safe — nothing was changed. Try again, or reload the page for a clean start.
            </p>

            {this.state.error && (
              <details className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-left">
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground flex items-center justify-between">
                  Error details
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.handleCopy(); }}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-live="polite"
                  >
                    {this.state.copied
                      ? (<><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</>)
                      : (<><Copy className="w-3.5 h-3.5" /> Copy</>)}
                  </button>
                </summary>
                <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all mt-3 max-h-48 overflow-y-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      {'\n\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="mt-6 grid gap-2">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="w-full h-11 rounded-xl active:scale-[0.99] transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="ghost"
                className="w-full h-11 rounded-xl active:scale-[0.99] transition-all"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
