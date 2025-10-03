const { expect } = require('chai');
const path = require('path');
const { URL } = require('url');
const { capture, loadWithTimeout, lowerSails } = require('./integration/helpers');

const ADAPTERS = [
  {
    name: 'MySQL',
    env: 'TEST_MYSQL_URL',
    defaultUrl: 'mysql://root:example@127.0.0.1:3316/safecriteria',
    buildDatastore(urlString) {
      const url = new URL(urlString);
      return {
        adapter: 'sails-mysql',
        host: url.hostname,
        port: Number(url.port || 3306),
        user: url.username,
        password: url.password,
        database: url.pathname.replace(/^\//, '') || 'safecriteria'
      };
    }
  },
  {
    name: 'PostgreSQL',
    env: 'TEST_POSTGRES_URL',
    defaultUrl: 'postgres://postgres:example@127.0.0.1:5436/safecriteria',
    buildDatastore(urlString) {
      const url = new URL(urlString);
      return {
        adapter: 'sails-postgresql',
        host: url.hostname,
        port: Number(url.port || 5432),
        user: url.username,
        password: url.password,
        database: url.pathname.replace(/^\//, '') || 'safecriteria'
      };
    }
  },
  {
    name: 'MongoDB',
    env: 'TEST_MONGO_URL',
    defaultUrl: 'mongodb://root:example@127.0.0.1:27117/safecriteria?authSource=admin',
    buildDatastore(urlString) {
      return {
        adapter: 'sails-mongo',
        url: urlString
      };
    }
  }
];

ADAPTERS.forEach((entry) => {
  describe(`adapter smoke test | ${entry.name}`, function () {
    this.timeout(50000);

    let sailsApp;
    const connString = process.env[entry.env] || entry.defaultUrl;

    before(async function () {
      if (!connString) {
        this.skip();
        return;
      }

      const datastore = entry.buildDatastore(connString);
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
          'waterline-safe-criteria': require('..')
        },
        datastores: {
          default: datastore
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
          models: path.resolve(__dirname, 'integration/fixtures/api/models')
        }
      }, 40000);
    });

    after(async () => {
      await lowerSails(sailsApp);
      sailsApp = null;
    });

    it('throws on unsafe criteria', function () {
      if (!sailsApp) {
        this.skip();
        return;
      }
      const err = capture(() => sailsApp.models.widget.destroy({ where: { name: undefined } }));
      expect(err.code).to.equal('E_UNDEFINED_WHERE');
    });

    it('allows safe destroy', async function () {
      if (!sailsApp) {
        this.skip();
        return;
      }
      await sailsApp.models.widget.createEach([
        { name: 'alpha' },
        { name: 'beta' }
      ]);
      const destroyed = await sailsApp.models.widget.destroy({ where: { name: 'alpha' } }).fetch();
      expect(destroyed).to.have.length(1);
    });
  });
});
