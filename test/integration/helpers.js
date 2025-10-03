const util = require('util');
const Sails = require('sails').Sails;

function capture(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('Expected function to throw');
}

async function loadWithTimeout(options, ms = 10000) {
  let timer;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Sails.load timed out after ${ms}ms. Hooks: ${Object.keys(options.hooks || {}).join(', ')}`));
    }, ms);

    const app = new Sails();
    app.load(options, (err) => {
      clearTimeout(timer);
      if (err) {
        return reject(err);
      }
      return resolve(app);
    });
  });
}

async function lowerSails(app) {
  if (!app) {
    return;
  }
  await util.promisify(app.lower).call(app);
}

module.exports = {
  capture,
  loadWithTimeout,
  lowerSails
};
