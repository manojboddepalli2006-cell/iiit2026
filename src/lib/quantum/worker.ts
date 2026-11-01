/// <reference lib="webworker" />
// Runs quantum simulations off the main thread so the UI stays responsive.
import { runQuantumJob, type QuantumJob } from "./workspace";

self.onmessage = (e: MessageEvent<QuantumJob>) => {
  try {
    const result = runQuantumJob(e.data, (frac, msg) => self.postMessage({ type: "progress", frac, msg }));
    self.postMessage({ type: "done", result });
  } catch (err) {
    self.postMessage({ type: "error", message: (err as Error).message });
  }
};
