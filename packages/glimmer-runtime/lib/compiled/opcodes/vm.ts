import { OpcodeJSON, UpdatingOpcode } from '../../opcodes';
import { UpdatingVM } from '../../vm';
import { Reference, ConstReference, VersionedPathReference } from 'glimmer-reference';
import { Option, Opaque, initializeGuid } from 'glimmer-util';
import { CONSTANT_TAG, ReferenceCache, Revision, Tag, isConst, isModified } from 'glimmer-reference';
import Environment from '../../environment';
import { APPEND_OPCODES, Op as Op } from '../../opcodes';
import {
  EvaluatedArgs,
  EvaluatedNamedArgs,
  EvaluatedPositionalArgs,
  Blocks
} from '../expressions/args';

import {
  InlineBlock
} from '../../scanner';

import {
  NULL_REFERENCE,
  UNDEFINED_REFERENCE,
  TRUE_REFERENCE,
  FALSE_REFERENCE,
  PrimitiveReference
} from '../../references';

APPEND_OPCODES.add(Op.ReserveLocals, (vm, { op1: amount }) => {
  vm.reserveLocals(amount);
});

APPEND_OPCODES.add(Op.ReleaseLocals, vm => vm.releaseLocals());

APPEND_OPCODES.add(Op.SetLocal, (vm, { op1: position }) => {
  vm.setLocal(position, vm.evalStack.pop());
});

APPEND_OPCODES.add(Op.GetLocal, (vm, { op1: position }) => {
  vm.evalStack.push(vm.getLocal(position));
});

APPEND_OPCODES.add(Op.PushChildScope, vm => vm.pushChildScope());

APPEND_OPCODES.add(Op.PopScope, vm => vm.popScope());

APPEND_OPCODES.add(Op.PushDynamicScope, vm => vm.pushDynamicScope());

APPEND_OPCODES.add(Op.PopDynamicScope, vm => vm.popDynamicScope());

APPEND_OPCODES.add(Op.PushReifiedArgs, (vm, { op1: positional, op2: _names, op3: blockFlag }) => {
  let stack = vm.evalStack;

  let namedKeys = [];
  let namedValues = [];
  let blocks: Blocks = { default: null, inverse: null };
  let names = vm.constants.getArray(_names).map(n => vm.constants.getString(n));

  if (blockFlag & 0b10) {
    blocks.inverse = stack.pop<InlineBlock>();
  }

  if (blockFlag & 0b01) {
    blocks.default = stack.pop<InlineBlock>();
  }

  for (let i=names.length; i>0; i--) {
    namedKeys.push(names[i - 1]);
    namedValues.push(stack.pop<VersionedPathReference<Opaque>>());
  }

  let positionalArguments = [];
  for (let i=positional; i>0; i--) {
    positionalArguments.push(stack.pop<VersionedPathReference<Opaque>>());
  }

  positionalArguments.reverse();

  stack.push(new EvaluatedArgs(
    new EvaluatedPositionalArgs(positionalArguments),
    new EvaluatedNamedArgs(namedKeys, namedValues),
    blocks
  ));
});

APPEND_OPCODES.add(Op.Constant, (vm, { op1: other }) => {
  vm.evalStack.push(vm.constants.getOther(other));
});

APPEND_OPCODES.add(Op.Primitive, (vm, { op1: primitive }) => {
  let stack = vm.evalStack;
  let flag = (primitive & (3 << 30)) >>> 30;
  let value = primitive & ~(3 << 30);

  switch (flag) {
    case 0:
      stack.push(PrimitiveReference.create(value));
      break;
    case 1:
      stack.push(PrimitiveReference.create(vm.constants.getString(value)));
      break;
    case 2:
      switch (value) {
        case 0: stack.push(FALSE_REFERENCE); break;
        case 1: stack.push(TRUE_REFERENCE); break;
        case 2: stack.push(NULL_REFERENCE); break;
        case 3: stack.push(UNDEFINED_REFERENCE); break;
      }
      break;
  }
});

APPEND_OPCODES.add(Op.Pop, vm => vm.evalStack.pop());

APPEND_OPCODES.add(Op.BindPositionalArgs, (vm, { op1: _symbols }) => {
  let symbols = vm.constants.getArray(_symbols);
  vm.bindPositionalArgs(symbols);
});

APPEND_OPCODES.add(Op.BindNamedArgs, (vm, { op1: _names, op2: _symbols }) => {
  let names = vm.constants.getArray(_names);
  let symbols = vm.constants.getArray(_symbols);
  vm.bindNamedArgs(names, symbols);
});

APPEND_OPCODES.add(Op.BindBlocks, (vm, { op1: _names, op2: _symbols }) => {
  let names = vm.constants.getArray(_names);
  let symbols = vm.constants.getArray(_symbols);
  vm.bindBlocks(names, symbols);
});

APPEND_OPCODES.add(Op.BindPartialArgs, (vm, { op1: symbol }) => {
  vm.bindPartialArgs(symbol);
});

APPEND_OPCODES.add(Op.BindCallerScope, vm => vm.bindCallerScope());

APPEND_OPCODES.add(Op.BindDynamicScope, (vm, { op1: _names }) => {
  let names = vm.constants.getArray(_names);
  vm.bindDynamicScope(names);
});

APPEND_OPCODES.add(Op.Enter, (vm, { op1, op2 }) => vm.enter(op1, op2));

APPEND_OPCODES.add(Op.Exit, (vm) => vm.exit());

APPEND_OPCODES.add(Op.Evaluate, (vm, { op1: _block }) => {
  let block = vm.constants.getBlock(_block);
  let args = vm.frame.getArgs();
  vm.invokeBlock(block, args);
});

APPEND_OPCODES.add(Op.Jump, (vm, { op1: target }) => vm.goto(target));

APPEND_OPCODES.add(Op.JumpIf, (vm, { op1: target }) => {
  let reference = vm.evalStack.pop<VersionedPathReference<Opaque>>();

  if (isConst(reference)) {
    if (reference.value()) {
      vm.goto(target);
    }
  } else {
    let cache = new ReferenceCache(reference);

    if (cache.peek()) {
      vm.goto(target);
    }

    vm.updateWith(new Assert(cache));
  }
});

APPEND_OPCODES.add(Op.JumpUnless, (vm, { op1: target }) => {
  let reference = vm.evalStack.pop<VersionedPathReference<Opaque>>();

  if (isConst(reference)) {
    if (!reference.value()) {
      vm.goto(target);
    }
  } else {
    let cache = new ReferenceCache(reference);

    if (!cache.peek()) {
      vm.goto(target);
    }

    vm.updateWith(new Assert(cache));
  }
});

export type TestFunction = (ref: Reference<Opaque>, env: Environment) => Reference<boolean>;

export const ConstTest: TestFunction = function(ref: Reference<Opaque>, _env: Environment): Reference<boolean> {
  return new ConstReference(!!ref.value());
};

export const SimpleTest: TestFunction = function(ref: Reference<Opaque>, _env: Environment): Reference<boolean> {
  return ref as Reference<boolean>;
};

export const EnvironmentTest: TestFunction = function(ref: Reference<Opaque>, env: Environment): Reference<boolean> {
  return env.toConditionalReference(ref);
};

APPEND_OPCODES.add(Op.ToBoolean, (vm, { op1: _func }) => {
  let stack = vm.evalStack;
  let operand = stack.pop();
  let func = vm.constants.getFunction(_func);
  stack.push(func(operand, vm.env));
});

export class Assert extends UpdatingOpcode {
  public type = "assert";

  private cache: ReferenceCache<Opaque>;

  constructor(cache: ReferenceCache<Opaque>) {
    super();
    this.tag = cache.tag;
    this.cache = cache;
  }

  evaluate(vm: UpdatingVM) {
    let { cache } = this;

    if (isModified(cache.revalidate())) {
      vm.throw();
    }
  }

  toJSON(): OpcodeJSON {
    let { type, _guid, cache } = this;

    let expected;

    try {
      expected = JSON.stringify(cache.peek());
    } catch(e) {
      expected = String(cache.peek());
    }

    return {
      guid: _guid,
      type,
      args: [],
      details: { expected }
    };
  }
}

export class JumpIfNotModifiedOpcode extends UpdatingOpcode {
  public type = "jump-if-not-modified";

  private lastRevision: Revision;

  constructor(tag: Tag, private target: LabelOpcode) {
    super();
    this.tag = tag;
    this.lastRevision = tag.value();
  }

  evaluate(vm: UpdatingVM) {
    let { tag, target, lastRevision } = this;

    if (!vm.alwaysRevalidate && tag.validate(lastRevision)) {
      vm.goto(target);
    }
  }

  didModify() {
    this.lastRevision = this.tag.value();
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: [JSON.stringify(this.target.inspect())]
    };
  }
}

export class DidModifyOpcode extends UpdatingOpcode {
  public type = "did-modify";

  constructor(private target: JumpIfNotModifiedOpcode) {
    super();
    this.tag = CONSTANT_TAG;
  }

  evaluate() {
    this.target.didModify();
  }
}

export class LabelOpcode implements UpdatingOpcode {
  public tag: Tag = CONSTANT_TAG;
  public type = "label";
  public label: Option<string> = null;
  public _guid: number;

  prev: any = null;
  next: any = null;

  constructor(label: string) {
    initializeGuid(this);
    if (label) this.label = label;
  }

  evaluate() {}

  inspect(): string {
    return `${this.label} [${this._guid}]`;
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: [JSON.stringify(this.inspect())]
    };
  }
}