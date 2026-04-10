/**
 * Holds the Socket.IO server instance after listen() so workers/services can emit
 * without Redis pub/sub (single-node dev).
 */
let ioRef = null;

export const setSocketIo = (io) => {
  ioRef = io;
};

export const getSocketIo = () => ioRef;

export const emitDialpadSmsDelta = (data) => {
  if (ioRef) ioRef.emit('dialpad_sms_delta', data);
};

export const emitDialpadCallDelta = (data) => {
  if (ioRef) ioRef.emit('dialpad_call_delta', data);
};
