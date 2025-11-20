import DebugPanel from "../components/debug/DebugPanel";
import StateInspector from "../components/debug/StateInspector";
import SocketDebugger from "../components/debug/SocketDebugger";

export default function DebugTools() {
  return (
    <div className="layout">
      <DebugPanel />
      <div className="inspectors">
        <StateInspector />
        <SocketDebugger />
      </div>
    </div>
  );
}
