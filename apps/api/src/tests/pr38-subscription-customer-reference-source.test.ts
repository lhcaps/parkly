import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('source regression: subscription creation resolves customers by reference and avoids LAST_INSERT_ID', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const source = fs.readFileSync(
    path.join(repoRoot, 'apps', 'api', 'src', 'modules', 'subscriptions', 'application', 'admin-subscriptions.ts'),
    'utf8',
  )
  const createSubscriptionMatch = source.match(
    /export async function createAdminSubscription[\s\S]*?return detail;\n}/,
  )
  assert.ok(createSubscriptionMatch, 'createAdminSubscription source should be present')
  const createSubscriptionSource = createSubscriptionMatch[0]

  assert.match(source, /async function resolveExistingCustomerReference/)
  assert.match(source, /phone = \?/)
  assert.match(source, /LOWER\(email\) = LOWER\(\?\)/)
  assert.match(createSubscriptionSource, /await resolveExistingCustomerReference\(input\.customerId\)/)
  assert.doesNotMatch(createSubscriptionSource, /SELECT LAST_INSERT_ID\(\) AS id/)
  assert.match(createSubscriptionSource, /SELECT subscription_id/)
  assert.match(createSubscriptionSource, /Created subscription could not be resolved after insert/)
})
