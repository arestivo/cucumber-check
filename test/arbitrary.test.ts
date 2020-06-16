import * as fc from '../src/arbitraries'
import { it } from 'mocha'
import { expect } from 'chai'
import { FluentCheck } from '../src'

describe('Arbitrary tests', () => {
  it("should return has many numbers has asked", () => {
    expect(new FluentCheck()
      .forall('n', fc.integer(0, 100))
      .given('a', () => fc.integer())
      .then(({n, a}) => a.sample(n).length == n)
      .check()
    ).to.have.property('satisfiable', true)
  })

  it("should return values in the specified range", () => {
    expect(new FluentCheck()
      .forall('n', fc.integer(0, 100))
      .given('a', () => fc.integer(0, 50))
      .then(({n, a}) => a.sample(n).every(i => i.value <= 50))
      .and(({n, a}) => a.sampleWithBias(n).every(i => i.value <= 50))
      .check()
    ).to.have.property('satisfiable', true)
  })

  it("should return corner cases if there is space", () => {
    expect(new FluentCheck()
      .forall('n', fc.integer(3, 100))
      .given('a', () => fc.integer(0, 50))
      .then(({n, a}) => a.sampleWithBias(n).some(v => v.value == 0))
      .and(({ n, a }) => a.sampleWithBias(n).some(v => v.value == 50))
      .check()
    ).to.have.property('satisfiable', true)
  })  

  it("should return values smaller than what was shrunk", () => {
    expect(new FluentCheck()
      .forall('n', fc.integer(0, 100))
      .forall('s', fc.integer(0, 100))
      .given('a', () => fc.integer(0, 100))
      .then(({n, s, a}) => a.shrink(s).sample(n).every((i: number) => i < s))
      .and(({n, s, a}) => a.shrink(s).sampleWithBias(n).every((i: number) => i < s))
      .check()
    ).to.have.property('satisfiable', true)
  })    

  it("should allow shrinking of mapped arbitraries", () => {
    expect(new FluentCheck()
      .exists('n', fc.integer(0, 25).map(x => x + 25).map(x => x * 2))
      .forall('a', fc.integer(0, 10))
      .then(({ n, a }) => a <= n)
      .check()
    ).to.deep.include({ satisfiable: true, example: { n: 50 } })
  })    

  describe("Transformations", () => {
    it("should allow booleans to be mappeable", () => {
      expect(new FluentCheck()
        .forall('n', fc.integer(10, 100))
        .given('a', () => fc.boolean().map(e => e ? 'Heads' : 'Tails'))
        .then(({ a, n }) => a.sampleWithBias(n).some(s => s.value == 'Heads') )
        .and(({ a, n }) => a.sampleWithBias(n).some(s => s.value == 'Tails'))
        .check()
      ).to.have.property('satisfiable', true)
    })

    it("should allow integers to be filtered", () => {
      expect(new FluentCheck()
        .forall('n', fc.integer(0, 100).filter(n => n < 10))
        .then(({ n }) => n < 10)
        .check()
      ).to.have.property('satisfiable', true)
    })

    it("should allow integers to be both mapped and filtered", () => {
      expect(new FluentCheck()
        .forall('n', fc.integer(0, 100).map(n => n + 100).filter(n => n < 150))
        .then(({ n }) => n >= 100 && n <= 150)
        .check()
      ).to.have.property('satisfiable', true)
    })
  })

  describe("Sizes", () => {
    it("should return the correct size of bounded integer arbitraries", () => {
      expect(fc.integer(0, 10).size()).equals(11)
      expect(fc.integer(-50, 50).size()).equals(101)
    })

    it("should return the correct size of shrinked integer arbitraries", () => {
      // TODO: This is happening because of the overlap in the Composite
      expect(fc.integer(0, 10).shrink({ value: 5 }).size()).equals(5)
    })

    it("should return the correct size of a composite arbitrary", () => {
      expect(fc.union(fc.boolean(), fc.boolean(), fc.boolean()).size()).equals(6)
    })

    it("should return the correct size of a collection arbitrary", () => {
      expect(fc.array(fc.boolean(), 1, 10).size()).equals(512)
    })
  })

  describe("Unique Arbitraries", () => {
    it("should return all the available values when sample size == size", () => {
      expect(
        fc.integer(0, 10).unique().sample(11).map(v => v.value)
      ).to.include.members([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it("should should be shrinkable and remain unique", () => {
      expect(
        fc.integer(0, 10).unique().shrink({value: 5}).sample(5).map(v => v.value)
      ).to.include.members([0, 1, 2, 3, 4])
    })

    it("should return no more than the number of possible cases", () => {
      expect(new FluentCheck()
        .forall('n', fc.integer(3, 10))
        .given('ub', () => fc.boolean().unique())
        .then(({ n, ub }) => ub.sample(n).length === 2)
        .check()
      ).to.have.property('satisfiable', true)
    })
  })
})

