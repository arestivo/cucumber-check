import * as fc from 'fast-check'
import { expect, assert } from 'chai'
import { FluentCheck } from '.'

export class Stack<T> {
    elements: Array<T> = []

    push = (e: T) => { this.elements.push(e) }
    pop = () => { return this.elements.pop() }
    size = () => { return this.elements.length }
}

/*
  Scenario: An empty stack becomes nonempty when we insert any number of elements
    Given an empty stack
    When we push an array of elements
    Then the stack is not empty
*/

new FluentCheck(() => new Stack())
  .arbitrary('elements', fc.array(fc.nat(), 1, 100))
  .property((stack, tc) => stack.push(tc.elements))
  .assert((stack, _) => expect(stack.size()).gt(0))

// Chains must have a name, and I think that they shouldn't replace the "original" name.
// My rationale is that it is different from chaining an arbitrary into two other arbitraries,
// from creating two independent arbitraries. The chained ones are *dependent*, and there
// might be scenarios where other independent arbitraries might be needed to be addressed.

new FluentCheck()
  .arbitrary('base', fc.integer())
  .chain('test', arb => fc.record({ a: fc.constant(arb.base), b: fc.integer(arb.base) }))
  .assert((_, { test }) => expect(test.a).gte(test.b))

// As it stands, it also doesn't force chain to receive a function that returns a dictionary;
// any Arbitrary will be considered valid. A tuple, for example, allows nice destructuring.

new FluentCheck()
  .arbitrary('base', fc.integer())
  .chain('pair', arb => fc.tuple(fc.constant(arb.base), fc.integer(arb.base)))
  .assert((_, { pair: [a, b] }) => expect(a).gte(b))

// And we can invoke multiple assertions
const scenario = new FluentCheck()
  .arbitrary('base', fc.integer(100))
  .chain('pair', arb => fc.tuple(fc.constant(arb.base), fc.integer(arb.base)))

scenario.assert((_, { pair: [a, b] }) => expect(a).gte(b)) //?
scenario.assert((_, { base }) => expect(base).lte(100))    //?

// Existential Quantifiers FTW

const r = new FluentCheck(() => ({ f: (a: number, b: number) => a + b }))
  .arbitrary('a', fc.integer(0, 10))
  .arbitrary('b', fc.integer(5, 10))
  .exists('b')
  .assert(({ f }, { a, b }) => assert(f(a, b) === a && f(b, a) === a)) //?

  console.log(r)