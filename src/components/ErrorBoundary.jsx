import React from "react";
import { createRuntimeErrorPayload, reportError } from "../monitoring/errorReporter.js";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    void reportError(
      createRuntimeErrorPayload({
        kind: "react-render",
        error,
        extra: {
          componentStack: errorInfo?.componentStack,
        },
      }),
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
          Ocurrio un error inesperado. Recarga la pagina.
        </div>
      );
    }

    return this.props.children;
  }
}
