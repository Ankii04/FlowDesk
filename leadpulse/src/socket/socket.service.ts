import { Server } from 'socket.io';
import { logger } from '../utils/logger';

export class SocketService {
  private io: Server | null = null;

  init(server: any) {
    this.io = new Server(server, {
      cors: { origin: '*' }
    });

    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      socket.on('join_agent_room', (agentId: string) => {
        socket.join(`agent_${agentId}`);
        logger.info(`Socket ${socket.id} joined agent_${agentId}`);
      });

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  emitToAgent(agentId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`agent_${agentId}`).emit(event, data);
    }
  }

  broadcast(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}

export const socketService = new SocketService();
