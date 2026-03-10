import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Convert Zod -> JSON Schema for internal OpenAPI projection.
export function schemaFromZod(schema: z.ZodTypeAny, name: string): any {
  return zodToJsonSchema(schema as any, {
    name,
    target: 'openApi3',
    $refStrategy: 'none',
  });
}

export const ApiErrorCodeEnum = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const;

export function okEnvelope(dataSchema: any, example?: any) {
  const schema: any = {
    type: 'object',
    additionalProperties: false,
    required: ['requestId', 'data'],
    properties: {
      requestId: { type: 'string' },
      data: dataSchema,
    },
  };
  if (example !== undefined) schema.example = example;
  return schema;
}

export function errEnvelope(example?: any) {
  const schema: any = {
    type: 'object',
    additionalProperties: false,
    required: ['requestId', 'error'],
    properties: {
      requestId: { type: 'string' },
      error: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', enum: [...ApiErrorCodeEnum] },
          message: { type: 'string' },
          details: {},
        },
      },
    },
  };
  if (example !== undefined) schema.example = example;
  return schema;
}

export function bearerSecurity() {
  return [{ bearerAuth: [] }];
}
