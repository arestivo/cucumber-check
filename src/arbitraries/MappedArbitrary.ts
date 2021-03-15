import {FluentPick} from './types'
import {Arbitrary} from './internal'

export class MappedArbitrary<A, B> extends Arbitrary<B> {
  constructor(
    public readonly baseArbitrary: Arbitrary<A>,
    public readonly f: (a: A) => B,
    public readonly g?: (b: B) => A | A[]
  ) {
    super()
  }

  mapFluentPick(p: FluentPick<A>): FluentPick<B> {
    const original = ('original' in p && p.original !== undefined) ? p.original : p.value
    return ({value: this.f(p.value), original})
  }

  pick(): FluentPick<B> | undefined {
    const pick = this.baseArbitrary.pick()
    return pick ? this.mapFluentPick(pick) : undefined
  }

  // TODO: This is not strictly true when the mapping function is not bijective. I suppose this is
  // a count-distinct problem, so we should probably either count the cardinality with a Set (for
  // small arbitraries), or use a cardinality estimator such as HyperLogLog for big ones. One
  // interesting information we could leverage here is that the new arbitrary size will never
  // be *above* the baseArbitrary.
  size() { return this.baseArbitrary.size() }

  cornerCases(): FluentPick<B>[] {
    return this.baseArbitrary.cornerCases().map(p => this.mapFluentPick(p))
  }

  shrink(initial: FluentPick<B>): Arbitrary<B> {
    return this.baseArbitrary.shrink({value: initial.original, original: initial.original}).map(v => this.f(v))
  }

  canGenerate(pick: FluentPick<B>) {
    const inverseValues = this.g === undefined ? [pick.original] :
      (Array.isArray(this.g(pick.value)) ? this.g(pick.value) as A[]: [this.g(pick.value)])

    for (const value of inverseValues) {
      if (this.baseArbitrary.canGenerate({value, original: pick.original}))
        return true
    }

    return false
  }

  toString(depth = 0) {
    return ' '.repeat(2 * depth) +
      `Map Arbitrary: f = ${this.f.toString()}\n` + this.baseArbitrary.toString(depth + 1)
  }
}
