"use client";
import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error("TigerMove error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: "24px", textAlign: "center", color: "#4a3820" }}>
          <h2 style={{ fontFamily: "Georgia, serif", marginBottom: "8px" }}>Something went wrong</h2>
          <p style={{ fontSize: "14px", marginBottom: "16px" }}>{this.state.error?.message || "An unexpected error occurred"}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid #c7a14e",
              background: "#fff8df",
              color: "#4a3820",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
