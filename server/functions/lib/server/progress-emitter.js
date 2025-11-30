import { EventEmitter } from 'events';
const progressEmitter = new EventEmitter();
export const emitProgress = (update) => {
    progressEmitter.emit('progress', update);
};
export const onProgress = (listener) => {
    progressEmitter.on('progress', listener);
    return () => progressEmitter.off('progress', listener);
};
//# sourceMappingURL=progress-emitter.js.map