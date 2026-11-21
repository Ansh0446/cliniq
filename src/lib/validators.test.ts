import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coordsError, emailError, nameError, passwordError, phoneError } from './validators'

test('email', () => {
  assert.equal(emailError('a@b.co'), null)
  assert.equal(emailError('  a@b.co  '), null)
  assert.equal(emailError('', { required: true }), 'Enter your email address.')
  assert.equal(emailError(''), null)
  for (const bad of ['a', 'a@b', 'a@b.', '@b.com', 'a b@c.com', 'a@@b.com']) assert.notEqual(emailError(bad), null, bad)
  assert.notEqual(emailError(`${'x'.repeat(170)}@b.com`), null)
})

test('phone accepts international formats and rejects letters or odd lengths', () => {
  for (const ok of ['+91 98765 43210', '(011) 555-0100', '9876543210', '+1-202-555-0175']) assert.equal(phoneError(ok), null, ok)
  for (const bad of ['abc', '12345', '1'.repeat(16), '98765x43210']) assert.notEqual(phoneError(bad), null, bad)
  assert.equal(phoneError(''), null)
  assert.notEqual(phoneError('', { required: true }), null)
})

test('password rules', () => {
  assert.equal(passwordError('correct horse battery'), null)
  assert.notEqual(passwordError('short'), null)
  assert.notEqual(passwordError('aaaaaaaaaa'), null)
  assert.notEqual(passwordError('Me@Example.com', 'me@example.com'), null)
  assert.notEqual(passwordError('x'.repeat(73)), null)
})

test('name and coordinates', () => {
  assert.equal(nameError('Asha Rao', { required: true }), null)
  assert.notEqual(nameError('', { required: true }), null)
  assert.notEqual(nameError('A'), null)
  assert.notEqual(nameError('x'.repeat(121)), null)
  assert.equal(coordsError('', ''), null)
  assert.equal(coordsError('28.6', '77.2'), null)
  for (const [a, b] of [['28.6', ''], ['x', '1'], ['91', '0'], ['0', '181']] as const) assert.notEqual(coordsError(a, b), null, `${a},${b}`)
})
