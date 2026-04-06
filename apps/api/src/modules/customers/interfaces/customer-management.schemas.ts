/**
 * Re-export customer-management Zod schemas from @parkly/contracts (single source of truth).
 */
export {
  ListCustomersQuerySchema,
  CustomerIdParamSchema,
  CreateCustomerBodySchema,
  UpdateCustomerBodySchema,
} from '@parkly/contracts'

export type {
  ListCustomersQuery,
  CreateCustomerBody,
  UpdateCustomerBody,
} from '@parkly/contracts'
