import React from 'react';
export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('Error al mostrar un reporte:', error); }
  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <div role="alert" className="report-error">
      <h3></h3>
      <p>{this.state.error.message}</p>
      <p>Empeza otra vez pibe</p>
      <button onClick={() => this.setState({ error: null })}>otra vez</button>
    </div>;
    return this.props.children;
  }
}