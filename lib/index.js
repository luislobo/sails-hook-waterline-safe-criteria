/**
 * sails-hook-waterline-safe-criteria
 *
 * Guards Waterline model methods against criteria that would expand to "match everything" because
 * of undefined values or missing where-clauses.  Enable globally via `sails.config.models` or per
 * model via `rejectUndefinedWhere: true`.
 */

const flaverr = require('flaverr');
const _ = require('@sailshq/lodash');

const GUARDED_METHODS = [
  'find', 'findOne',
  'destroy', 'destroyOne',
  'update', 'updateOne',
  'count', 'sum', 'avg'
];

const KNOWN_STAGE1_KEYS = new Set([
  'where', 'limit', 'skip', 'sort', 'select', 'omit',
  'meta', 'populate', 'populates'
]);

module.exports = function waterlineSafeCriteriaHook(sails) {
  function hasUndefined(value) {
    if (value === undefined) {
      return true;
    }
    if (!value || typeof value !== 'object') {
      return false;
    }
    if (value instanceof Date || Buffer.isBuffer(value)) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some(hasUndefined);
    }
    return Object.keys(value).some((key) => hasUndefined(value[key]));
  }

  function extractWhere(criteria) {
    if (!criteria || typeof criteria !== 'object') {
      return null;
    }
    if (criteria.where && typeof criteria.where === 'object') {
      return criteria.where;
    }
    const bare = {};
    for (const key of Object.keys(criteria)) {
      if (!KNOWN_STAGE1_KEYS.has(key)) {
        bare[key] = criteria[key];
      }
    }
    return Object.keys(bare).length ? bare : null;
  }

  function shouldBypass(criteria) {
    return Boolean(criteria && criteria.meta && criteria.meta.allowUndefinedWhere);
  }

  function guardCriteria(modelIdentity, methodName, criteria, { ignoreUndefined } = {}) {
    if (typeof criteria === 'function') {
      return; // implicit "find(cb)"
    }
    if (criteria === undefined) {
      throw flaverr('E_UNDEFINED_WHERE', new Error(
        'Unsafe ' + methodName.toUpperCase() + ' on `' + modelIdentity + '` would hit every record. ' +
        'Pass an explicit WHERE or include `meta: { allowUndefinedWhere: true }` to bypass intentionally.'
      ));
    }
    if (criteria === null || typeof criteria === 'number' || typeof criteria === 'string' || Array.isArray(criteria)) {
      return; // PK shorthand is fine
    }
    const where = extractWhere(criteria);
    const nonMetaKeys = Object.keys(criteria).filter((key) => key !== 'meta');
    const hasExplicitFilters = Boolean(where) || nonMetaKeys.some((key) => !KNOWN_STAGE1_KEYS.has(key));
    if (!hasExplicitFilters) {
      throw flaverr('E_UNDEFINED_WHERE', new Error(
        'Unsafe ' + methodName.toUpperCase() + ' on `' + modelIdentity + '` would match every record. ' +
        'Include a WHERE clause or use explicit filters.'
      ));
    }
    if (!ignoreUndefined && where && hasUndefined(where)) {
      throw flaverr('E_UNDEFINED_WHERE', new Error(
        'Unsafe ' + methodName.toUpperCase() + ' on `' + modelIdentity + '` detected undefined inside WHERE clause. ' +
        'Undefined values cause Waterline to remove predicates and match everything. Scrub the criteria first, or bypass with `meta: { allowUndefinedWhere: true }`.'
      ));
    }
  }

  function wrapModel(model) {
    GUARDED_METHODS.forEach((methodName) => {
      const original = model[methodName];
      if (typeof original !== 'function') {
        return;
      }
      model[methodName] = function wrappedStageOne(criteria, ...rest) {
        const bypass = shouldBypass(criteria);

        let meta;
        if (criteria && typeof criteria === 'object' && criteria.meta) {
          meta = criteria.meta;
          criteria = Object.assign({}, criteria);
          delete criteria.meta;
        }

        guardCriteria(model.identity || model.globalId, methodName, criteria, { ignoreUndefined: bypass });

        const deferred = original.call(this, criteria, ...rest);
        if (meta && deferred && typeof deferred.meta === 'function') {
          return deferred.meta(meta);
        }
        return deferred;
      };
    });
  }

  return {
    defaults: {
      __configKey__: {
        enabled: true
      }
    },

    initialize(done) {
      sails.after('hook:orm:loaded', () => {
        const cfg = sails.config[this.configKey] || {};
        let globalFlag = _.get(sails, ['config', 'models', 'rejectUndefinedWhere']);
        if (typeof globalFlag !== 'boolean') {
          const hookSetting = _.get(cfg, 'enabled');
          if (typeof hookSetting === 'boolean') {
            globalFlag = hookSetting;
          } else {
            globalFlag = true;
          }
        }

        _.each(sails.models, (model) => {
          const modelSetting = _.get(model, 'rejectUndefinedWhere');
          if (typeof modelSetting === 'boolean') {
            if (modelSetting) {
              wrapModel(model);
            }
            return;
          }

          if (globalFlag) {
            wrapModel(model);
          }
        });
      });

      return done();
    }
  };
};
