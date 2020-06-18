import { FluentPick, Arbitrary } from './arbitraries'

interface TestCase { [k: string]: any }

export class FluentResult {
  constructor(public readonly satisfiable = false, public example: TestCase = {}) { }

  addExample<A>(name: string, value: A) {
    this.example[name] = value
    return this
  }
}

export class FluentCheck {
  constructor(protected readonly parent: FluentCheck = undefined) { }

  given<A>(name: string, a: (args: TestCase) => A): FluentCheckGivenMutable<A>
  given<A>(name: string, a: A): FluentCheckGivenMutable<A> | FluentCheckGivenConstant<A> {
    return (a instanceof Function) ?
      new FluentCheckGivenMutable(this, name, a as unknown as ((args: TestCase) => A)) :
      new FluentCheckGivenConstant(this, name, a)
  }

  when(f: (givens: TestCase) => void) {
    return new FluentCheckWhen(this, f)
  }

  forall<A>(name: string, a: Arbitrary<A>) {
    return new FluentCheckUniversal(this, name, a)
  }

  exists<A>(name: string, a: Arbitrary<A>)  {
    return new FluentCheckExistential(this, name, a)
  }

  then(f: (arg: TestCase) => boolean) {
    return new FluentCheckAssert(this, f)
  }

  protected run(testCase: TestCase, callback: (arg: TestCase) => FluentResult, _partial: FluentResult = undefined): FluentResult {
    return callback(testCase)
  }

  protected pathFromRoot(): FluentCheck[] {
    const path = []

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: FluentCheck = this
    while (node !== undefined) {
      path.unshift(node)
      node = node.parent
    }
    return path
  }

  protected pathToRoot() {
    return this.pathFromRoot().reverse()
  }

  check(child: (testCase: TestCase) => FluentResult = () => new FluentResult(true)) {
    if (this.parent !== undefined) return this.parent.check((testCase: TestCase) => this.run(testCase, child))
    else {
      const r = this.run({}, child)
      return new FluentResult(r.satisfiable, FluentCheck.unwrapFluentPick(r.example))
    }
  }

  static unwrapFluentPick(testCase: TestCase): TestCase {
    const result: TestCase = {}
    for (const k in testCase)
      result[k] = testCase[k].value
    return result
  }
}

class FluentCheckWhen extends FluentCheck {
  constructor(protected readonly parent: FluentCheck, public readonly f: (givens: TestCase) => void) {
    super(parent)
  }

  and(f: (givens: TestCase) => void) { return this.when(f) }
}

class FluentCheckGivenMutable<A> extends FluentCheck {
  constructor(protected readonly parent: FluentCheck, public readonly name: string, public readonly factory: (args: TestCase) => A) {
    super(parent)
  }

  and(name: string, a: (args: TestCase) => A) { return this.given(name, a) }
}

class FluentCheckGivenConstant<A> extends FluentCheck {
  constructor(protected readonly parent: FluentCheck, public readonly name: string, public readonly value: A) {
    super(parent)
  }

  and(name: string, a: (args: TestCase) => A) { return this.given(name, a) }

  protected run(testCase: TestCase, callback: (arg: TestCase) => FluentResult) {
    testCase[this.name] = this.value
    return callback(testCase)
  }
}

class FluentCheckUniversal<A> extends FluentCheck {
    private cached: Array<FluentPick<A>> = undefined
    private dedup: Arbitrary<A>

    constructor(protected readonly parent: FluentCheck, public readonly name: string, public readonly a: Arbitrary<A>) {
      super(parent)
      this.dedup = a.unique()
      this.cached = this.dedup.sampleWithBias(1000)
    }

    protected run(testCase: TestCase, callback: (arg: TestCase) => FluentResult, partial: FluentResult = undefined): FluentResult {
      const newCase = { ...testCase }
      const example = partial || new FluentResult(true)
      const collection = partial === undefined ? this.cached : this.dedup.shrink(partial.example[this.name]).sampleWithBias(1000)

      for (const tp of collection) {
        newCase[this.name] = tp
        const result = callback(newCase)
        if (!result.satisfiable) {
          result.addExample(this.name, tp)
          return this.run(testCase, callback, result)
        }
      }

      return example
    }
}

class FluentCheckExistential<A> extends FluentCheck {
    private cached: Array<FluentPick<A>> = undefined
    private dedup: Arbitrary<A>

    constructor(protected readonly parent: FluentCheck, public readonly name: string, public readonly a: Arbitrary<A>) {
      super(parent)
      this.dedup = a.unique()
      this.cached = this.dedup.sampleWithBias(1000)
    }

    protected run(testCase: TestCase, callback: (arg: TestCase) => FluentResult, partial: FluentResult = undefined): FluentResult {
      const newCase = { ...testCase }
      const example = partial || new FluentResult(false)
      const collection = partial === undefined ? this.cached : this.dedup.shrink(partial.example[this.name]).sampleWithBias(1000)

      for (const tp of collection) {
        newCase[this.name] = tp
        const result = callback(newCase)
        if (result.satisfiable) {
          result.addExample(this.name, tp)
          return this.run(testCase, callback, result)
        }
      }

      return example
    }
}

class FluentCheckAssert extends FluentCheck {
    preliminaries: FluentCheck[] = undefined

    constructor(protected readonly parent: FluentCheck, public readonly assertion: (args: TestCase) => boolean) {
      super(parent)
    }

    and(assertion: (args: TestCase) => boolean) {
      return this.then(assertion)
    }

    private runPreliminaries(testCase: TestCase) {
      if (this.preliminaries === undefined)
        this.preliminaries = this.pathFromRoot().filter(node =>
          (node instanceof FluentCheckGivenMutable) ||
                (node instanceof FluentCheckWhen))

      const data = { }

      this.preliminaries.forEach(node => {
        if (node instanceof FluentCheckGivenMutable) data[node.name] = node.factory({ ...testCase, ...data })
        else if (node instanceof FluentCheckWhen) node.f({ ...testCase, ...data })
      })

      return data
    }

    protected run(testCase: TestCase, callback: (arg: TestCase) => FluentResult) {
      const unwrappedTestCase = FluentCheck.unwrapFluentPick(testCase)
      return (this.assertion({ ...unwrappedTestCase, ...this.runPreliminaries(unwrappedTestCase) })) ? callback(testCase) : new FluentResult(false)
    }
}
