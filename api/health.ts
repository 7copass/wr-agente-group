import { saude } from '../src/saude.js';

export function GET(): Response {
  return Response.json(saude());
}
