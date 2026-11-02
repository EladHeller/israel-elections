import { analyzeScenarios, type AnalysisInput } from '../lib/automatic-scenarios';

self.onmessage = ({ data }: MessageEvent<AnalysisInput>) => {
  try { self.postMessage({ analysis: analyzeScenarios(data) }); }
  catch { self.postMessage({ error: true }); }
};
