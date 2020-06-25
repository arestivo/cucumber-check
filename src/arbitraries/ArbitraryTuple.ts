import { ArbitrarySize, FluentPick } from './types'
import { Arbitrary, NoArbitrary } from './internal'
import * as fc from './index'
import { FluentCheck } from '../FluentCheck'

type Replace<T> = { [P in keyof T]: T[P] extends fc.Arbitrary<infer E> ? E : T[P] }

export class ArbitraryTuple<U extends Arbitrary<any>[]> extends Arbitrary<Replace<U>[]> {
  constructor(public readonly arbitraries: U) {
    super()
  }

  size(): ArbitrarySize {
    let value = 1
    let type: 'exact' | 'estimated' = 'exact'

    for (const a of this.arbitraries) {
      const size = a.size()
      type = (size.type === 'exact') ? type : 'estimated'
      value *= a.size().value
    }

    return { value, type }
  }

  pick() {
    const value: Replace<U>[] = []
    const original: any[] = []
    for (const a of this.arbitraries) {
      const pick = a.pick()
      if (pick === undefined) return undefined
      else {
        value.push(pick.value)
        original.push(pick.original)
      }
    }

    return { value, original }
  }

  cornerCases(): FluentPick<Replace<U>[]>[] {
    const cornerCases = this.arbitraries.map(a => a.cornerCases())

    const result = cornerCases.reduce((acc, cc) => {
      const result : FluentPick<Replace<U>[]>[] = []
      acc.forEach((a: FluentPick<any>) => {
        cc.forEach((b: FluentPick<any>) => result.push({
          value: Array.isArray(a.value) ? [...a.value, b.value] : [a.value, b.value],
          original: Array.isArray(a.original) ? [...a.original, b.original] : [a.original, b.original] }))
      })
      return result
    })

    return result
  }

  shrink(initial: FluentPick<any[]>): Arbitrary<any[]> {
    // TODO: Make this compatible with pick()
    const arbitraries : Arbitrary<any>[] = []

    for (let i = 0; i < this.arbitraries.length; i++) {
      initial.value[i].original ?
        arbitraries.push(this.arbitraries[i].shrink({ value : initial.value[i].value, original: initial.value[i].original })) :
        arbitraries.push(this.arbitraries[i].shrink({ value : initial.value[i].value }))
    }

    if (arbitraries.some(a => a === NoArbitrary))
      return NoArbitrary

    return fc.tuple(...arbitraries)
  }

  canGenerate(pick: FluentPick<any[]>) {
    if (pick.value.length !== this.arbitraries.length) return false

    for (let i = 0; i < pick.value.length; i++) {
      if (!this.arbitraries[i].canGenerate({ value: pick.value[i], original: pick.original[i] })) //?
        return false
    }

    return true
  }
}
