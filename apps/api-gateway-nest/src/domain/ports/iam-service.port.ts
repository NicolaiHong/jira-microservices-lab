export const IAM_SERVICE_PORT = 'IIamServicePort';

export interface IIamServicePort {
  register(body: unknown, correlationId: string): Promise<unknown>;

  login(body: unknown, correlationId: string): Promise<unknown>;
}
