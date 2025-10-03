const { expect } = require('chai');
const path = require('path');
const { capture, loadWithTimeout, lowerSails } = require('./helpers');

describe('integration | sails-hook-waterline-safe-criteria', function () {
  this.timeout(20000);

  let sailsApp;

  before(async () => {
    sailsApp = await loadWithTimeout({
      log: { level: 'error' },
      hooks: {
        http: false,
        grunt: false,
        pubsub: false,
        blueprints: false,
        sockets: false,
        views: false,
        policies: false,
        orm: require('sails-hook-orm'),
        'waterline-safe-criteria': require('../..')
      },
      datastores: {
        default: {
          adapter: 'sails-disk'
        }
      },
      models: {
        migrate: 'drop',
        datastore: 'default',
        rejectUndefinedWhere: true,
        attributes: {
          createdAt: { type: 'number', autoCreatedAt: true },
          updatedAt: { type: 'number', autoUpdatedAt: true }
        }
      },
      paths: {
        models: path.resolve(__dirname, 'fixtures/api/models')
      }
    });
  });

  after(async () => {
    await lowerSails(sailsApp);
    sailsApp = null;
  });

  it('throws synchronously when undefined appears in where', () => {
    const err = capture(() => sailsApp.models.widget.destroy({ where: { name: undefined } }));
    expect(err.code).to.equal('E_UNDEFINED_WHERE');
  });

  it('throws when criteria is omitted', () => {
    const err = capture(() => sailsApp.models.widget.destroy());
    expect(err.code).to.equal('E_UNDEFINED_WHERE');
  });

  it('allows bypass via meta.allowUndefinedWhere', async () => {
    const destroyed = await sailsApp.models.widget
      .destroy({ where: { name: undefined }, meta: { allowUndefinedWhere: true } })
      .fetch();
    expect(destroyed).to.be.an('array');
  });

  it('permits safe criteria', async () => {
    await sailsApp.models.widget.createEach([
      { name: 'alpha' },
      { name: 'beta' }
    ]);

    const destroyed = await sailsApp.models.widget
      .destroy({ where: { name: 'alpha' } })
      .fetch();
    expect(destroyed).to.have.length(1);
    expect(destroyed[0].name).to.equal('alpha');
  });
});

describe('integration | baseline without hook', function () {
  this.timeout(20000);

  let sailsApp;

  before(async () => {
    sailsApp = await loadWithTimeout({
      log: { level: 'error' },
      hooks: {
        http: false,
        grunt: false,
        pubsub: false,
        blueprints: false,
        sockets: false,
        views: false,
        policies: false,
        orm: require('sails-hook-orm')
      },
      datastores: {
        default: {
          adapter: 'sails-disk'
        }
      },
      models: {
        migrate: 'drop',
        datastore: 'default',
        attributes: {
          createdAt: { type: 'number', autoCreatedAt: true },
          updatedAt: { type: 'number', autoUpdatedAt: true }
        }
      },
      paths: {
        models: path.resolve(__dirname, 'fixtures/baseline/api/models')
      }
    });
  });

  after(async () => {
    await lowerSails(sailsApp);
    sailsApp = null;
  });

  it('silently matches everything when where contains undefined', async () => {
    await sailsApp.models.unsafewidget.createEach([
      { name: 'foo' },
      { name: 'bar' }
    ]);
    const destroyed = await sailsApp.models.unsafewidget
      .destroy({ where: { name: undefined } })
      .fetch();
    expect(destroyed).to.have.length(2);
  });
});

describe('integration | per-model configuration', function () {
  this.timeout(20000);

  let sailsApp;

  before(async () => {
    sailsApp = await loadWithTimeout({
      log: { level: 'error' },
      hooks: {
        http: false,
        grunt: false,
        pubsub: false,
        blueprints: false,
        sockets: false,
        views: false,
        policies: false,
        orm: require('sails-hook-orm'),
        'waterline-safe-criteria': require('../..')
      },
      datastores: {
        default: {
          adapter: 'sails-disk'
        }
      },
      models: {
        migrate: 'drop',
        datastore: 'default',
        attributes: {
          createdAt: { type: 'number', autoCreatedAt: true },
          updatedAt: { type: 'number', autoUpdatedAt: true }
        }
      },
      paths: {
        models: path.resolve(__dirname, 'fixtures/perModel/api/models')
      }
    });
  });

  after(async () => {
    await lowerSails(sailsApp);
    sailsApp = null;
  });

  it('leaves non-protected model untouched', async () => {
    await sailsApp.models.openwidget.createEach([
      { name: 'foo' },
      { name: 'bar' }
    ]);
    const destroyed = await sailsApp.models.openwidget
      .destroy({ where: { name: undefined } })
      .fetch();
    expect(destroyed).to.have.length(2);
  });

  it('blocks undefined where on protected model', () => {
    const err = capture(() => sailsApp.models.securewidget.destroy({ where: { name: undefined } }));
    expect(err.code).to.equal('E_UNDEFINED_WHERE');
  });

  it('still processes safe criteria on protected model', async () => {
    await sailsApp.models.securewidget.createEach([
      { name: 'alpha' },
      { name: 'beta' }
    ]);
    const destroyed = await sailsApp.models.securewidget
      .destroy({ where: { name: 'alpha' } })
      .fetch();
    expect(destroyed).to.have.length(1);
    expect(destroyed[0].name).to.equal('alpha');
  });
});
