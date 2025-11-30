
import { EventEmitter } from 'events';

interface ProgressUpdate {
  sessionId: string;
  progress: number;
  step: string;
}

const progressEmitter = new EventEmitter();

export const emitProgress = (update: ProgressUpdate) => {
  progressEmitter.emit('progress', update);
};

export const onProgress = (listener: (update: ProgressUpdate) => void) => {
  progressEmitter.on('progress', listener);
  return () => progressEmitter.off('progress', listener);
};
