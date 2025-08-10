// Jest setup file for game-engine integration tests

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console.log to reduce test output noise (optional)
// console.log = jest.fn();

// Global test configuration
beforeAll(() => {
  // Any global setup needed before all tests
});

afterAll(() => {
  // Any global cleanup needed after all tests
});

// Mock WebSocket connections for testing
jest.mock('@nestjs/websockets', () => ({
  WebSocketGateway: () => (target: any) => target,
  WebSocketServer: () => (target: any, key: string) => {},
  SubscribeMessage: () => (target: any, key: string) => {},
  MessageBody: () => (target: any, key: string, index: number) => {},
  ConnectedSocket: () => (target: any, key: string, index: number) => {},
}));