const { expect } = require('chai');
const sinon = require('sinon');
const hookFactory = require('../lib');

function fakeSails(config = { models: { rejectUndefinedWhere: true } }) {
  return {
    models: {},
    config,
    after: sinon.stub().callsFake((evt, cb) => {
      if (evt === 'hook:orm:loaded') {
        cb();
      }
    })
  };
}

function captureThrow(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('Expected function to throw');
}

function makeDeferred(result = 'ok') {
  const deferred = Promise.resolve(result);
  deferred.meta = sinon.stub().returns(deferred);
  deferred.fetch = sinon.stub().returns(deferred);
  return deferred;
}

describe('sails-hook-waterline-safe-criteria', () => {
  const guardedMethods = ['find', 'findOne', 'destroy', 'destroyOne', 'update', 'updateOne', 'count', 'sum', 'avg'];

  const setupModel = (methodName, { globalConfig, modelOverrides, result } = {}) => {
    const sails = fakeSails(globalConfig || { models: { rejectUndefinedWhere: true } });
    const deferred = makeDeferred(result);
    const stub = sinon.stub().returns(deferred);
    const model = Object.assign({ identity: 'widget' }, modelOverrides, { [methodName]: stub });
    sails.models.widget = model;
    hookFactory(sails).initialize(() => {});
    return { model, stub, deferred };
  };

  guardedMethods.forEach((method) => {
    it(`throws when undefined appears in where for ${method}`, () => {
      const { model } = setupModel(method);
      const err = captureThrow(() => model[method]({ where: { name: undefined } }));
      expect(err.code).to.equal('E_UNDEFINED_WHERE');
      expect(err.message).to.match(new RegExp(`Unsafe ${method.toUpperCase()}`));
    });
  });

  it('detects undefined hidden in nested criteria', () => {
    const { model } = setupModel('destroy');
    const err = captureThrow(() => model.destroy({ where: { or: [{ name: 'foo' }, { status: undefined }] } }));
    expect(err.code).to.equal('E_UNDEFINED_WHERE');
  });

  it('detects undefined inside array constraints', () => {
    const { model } = setupModel('find');
    const err = captureThrow(() => model.find({ where: { tags: { in: ['a', undefined] } } }));
    expect(err.code).to.equal('E_UNDEFINED_WHERE');
  });

  it('allows whitelist via meta.allowUndefinedWhere', async () => {
    const { model, stub, deferred } = setupModel('find');
    const payload = { where: { name: undefined }, meta: { allowUndefinedWhere: true } };
    const result = await model.find(payload);
    expect(result).to.equal('ok');
    expect(stub.calledOnce).to.equal(true);
    expect(stub.firstCall.args[0]).to.deep.equal({ where: { name: undefined } });
    expect(deferred.meta.calledWith(payload.meta)).to.equal(true);
  });

  it('still throws when bypass meta is provided without criteria', () => {
    const { model } = setupModel('destroy');
    const err = captureThrow(() => model.destroy({ meta: { allowUndefinedWhere: true } }));
    expect(err.code).to.equal('E_UNDEFINED_WHERE');
  });

  it('does not mutate incoming criteria object', () => {
    const { model } = setupModel('find');
    const criteria = { where: { name: 'foo' } };
    model.find(criteria);
    expect(criteria).to.deep.equal({ where: { name: 'foo' } });
  });

  it('passes through safe criteria without bypass', async () => {
    const { model, stub } = setupModel('findOne');
    await model.findOne({ where: { name: 'safe' } });
    expect(stub.calledOnce).to.equal(true);
  });

  it('supports per-model override even when global disabled', () => {
    const { model } = setupModel('destroy', {
      globalConfig: { models: { rejectUndefinedWhere: false } },
      modelOverrides: { rejectUndefinedWhere: true }
    });
    const err = captureThrow(() => model.destroy(undefined));
    expect(err.code).to.equal('E_UNDEFINED_WHERE');
  });

  it('leaves legacy models untouched when guard disabled', () => {
    const { model } = setupModel('update', {
      globalConfig: { models: { rejectUndefinedWhere: false } }
    });
    expect(() => model.update({ where: { name: undefined } })).to.not.throw();
  });
});
