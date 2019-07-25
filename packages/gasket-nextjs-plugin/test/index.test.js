/* eslint-disable no-sync */

const { spy, stub } = require('sinon');
const assume = require('assume');
const path = require('path');
const proxyquire = require('proxyquire');

describe('next', () => {
  let next, nextHandler, plugin, expressApp;

  beforeEach(() => {
    expressApp = {
      set: spy(),
      all: spy()
    };
    nextHandler = {
      prepare: stub().resolves(),
      getRequestHandler: stub().resolves({})
    };
    next = stub().returns(nextHandler);

    plugin = proxyquire('../', { next });
  });

  it('executes the `next` lifecycle', async function () {
    const gasket = mockGasketApi();
    await plugin.hooks.express(gasket, expressApp, false);

    assume(gasket.exec).has.been.calledWith('next', nextHandler);
  });

  it('executes the `nextExpress` lifecycle', async function () {
    const gasket = mockGasketApi();
    await plugin.hooks.express(gasket, expressApp, false);

    assume(gasket.exec).has.been.calledWith('nextExpress', { next: nextHandler, express: expressApp });
  });

  it('does not derive a webpack config if not running a dev server', async () => {
    await plugin.hooks.express(mockGasketApi(), expressApp, false);

    const nextOptions = next.lastCall.args[0];
    assume(nextOptions.conf).to.not.haveOwnProperty('webpack');
  });
});

describe('create', () => {

  let plugin, mockContext;

  function assumeCreatedWith(assertFn) {
    return async function assumeCreated() {
      await plugin.hooks.create({}, mockContext);
      assertFn(mockContext);
    };
  }

  beforeEach(() => {
    plugin = require('../');

    mockContext = {
      pkg: { add: spy() },
      files: { add: spy() }
    };
  });

  it('adds the appropriate globs', assumeCreatedWith(({ files }) => {
    const root = path.join(__dirname, '..');
    assume(files.add).calledWith(
      `${root}/generator/.*`,
      `${root}/generator/*`,
      `${root}/generator/**/*`
    );
  }));

  it('adds appropriate dependencies', assumeCreatedWith(({ pkg }) => {
    assume(pkg.add).calledWith('dependencies', {
      'next': '^8.0.3',
      'react': '^16.4.1',
      'react-dom': '^16.4.1'
    });
  }));
});

describe('workbox hook', () => {

  let gasketAPI, plugin;

  beforeEach(() => {
    gasketAPI = mockGasketApi();
    plugin = require('../');
  });

  it('returns workbox config partial', async () => {
    const results = await plugin.hooks.workbox(gasketAPI);

    assume(results).to.be.an('object');
  });

  it('config partial contains expected properties', async () => {
    const results = await plugin.hooks.workbox(gasketAPI);

    assume(results).to.have.property('globDirectory', '.');
    assume(results).to.have.property('globPatterns');
    assume(results).to.have.property('modifyURLPrefix');
  });

  it('config modifies urls from to _next', async () => {
    const results = await plugin.hooks.workbox(gasketAPI);

    assume(results.modifyURLPrefix).to.have.property('.next/', '_next/');
  });

  it('config modifies urls to use assetPrefix with https', async () => {
    const assetPrefix = 'https://some-cdn.com/';
    gasketAPI.config.next = { assetPrefix };
    const results = await plugin.hooks.workbox(gasketAPI);
    assume(results.modifyURLPrefix).to.have.property('.next/', assetPrefix + '_next/');
  });

  it('config modifies urls to use assetPrefix with http', async () => {
    const assetPrefix = 'http://some-cdn.com/';
    gasketAPI.config.next = { assetPrefix };
    const results = await plugin.hooks.workbox(gasketAPI);
    assume(results.modifyURLPrefix).to.have.property('.next/', assetPrefix + '_next/');
  });

  it('config modifies urls to use assetPrefix with https but no trailing slash', async () => {
    const assetPrefix = 'https://some-cdn.com';
    gasketAPI.config.next = { assetPrefix };
    const results = await plugin.hooks.workbox(gasketAPI);
    assume(results.modifyURLPrefix).to.have.property('.next/', `${assetPrefix}/_next/`);
  });

  it('config modifies urls to use assetPrefix relative path with trailing slash', async () => {
    const assetPrefix = '/some/asset/prefix/';
    gasketAPI.config.next = { assetPrefix };
    const results = await plugin.hooks.workbox(gasketAPI);
    assume(results.modifyURLPrefix).to.have.property('.next/', `${assetPrefix}_next/`);
  });

  it('config modifies urls to use assetPrefix relative path without trailing slash', async () => {
    const assetPrefix = '/some/asset/prefix';
    gasketAPI.config.next = { assetPrefix };
    const results = await plugin.hooks.workbox(gasketAPI);
    assume(results.modifyURLPrefix).to.have.property('.next/', `${assetPrefix}/_next/`);
  });
});

function mockGasketApi() {
  return {
    execWaterfall: stub().returnsArg(1),
    exec: stub().resolves({}),
    execSync: stub().returns([]),
    config: {
      webpack: {},  // user specified webpack config
      next: {},      // user specified next.js config
      root: '/app/path'
    },
    next: {}
  };
}