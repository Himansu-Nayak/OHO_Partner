import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

let socket: Socket | null = null;

export const initSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
    });
    
    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });
  }
  return socket;
};

export const emitDriverLocation = (lat: number, lng: number) => {
  if (socket?.connected) {
    socket.emit("driver:location:update", { lat, lng, timestamp: Date.now() });
  }
};

export const emitDriverOnline = (isOnline: boolean) => {
  if (socket?.connected) {
    socket.emit(isOnline ? "driver:online" : "driver:offline", { timestamp: Date.now() });
  }
};
