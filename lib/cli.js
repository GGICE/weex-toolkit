'use strict';

const debug = require('debug')('weex:cli');

const pkg = require('../package.json');
const colors = require('colors/safe');
const semver = require('semver');
const spawn = require('cross-spawn');
const path = require('path');
const userhome = require('userhome');
const yargsParser = require('yargs-parser');
const fse = require('fs-extra');
const got = require('got');

const { getNodeArgs, readJson, install, confirm } = require('../lib/utils');

const { installUncaughtExceptionListener } = require('../lib/errors');

// first, do a sniff test to ensure our dependencies are met
const sniff = require('../lib/sniff')
const tabtab = require('./completion')
const argv = yargsParser(process.argv.slice(2))

const coreName = '@weex-cli/core';
const homePrefix = '.wx';

// environment for running prepare
const env = {
  coreName: coreName,
  coreRoot: userhome(homePrefix, 'core'),
  corePath: process.env.WEEX_CORE_PATH ? process.env.WEEX_CORE_PATH : userhome(homePrefix, 'core/node_modules', coreName),
  moduleRoot: process.env.WEEX_MODULE_PATH ? process.env.WEEX_MODULE_PATH : userhome(homePrefix, 'weex_modules'),
  registry: argv.registry || process.env.NPM_REGISTRY || 'https://registry.npm.taobao.org',
  moduleConfigFileName: 'stores.json',
  globalConfigFileName: 'config.json',
  home: userhome(homePrefix),
  trash: userhome(homePrefix, 'trash')
};

// data for cli instance
const coreData = Object.assign({
  corePath: process.env.WEEX_CORE_PATH ? process.env.WEEX_CORE_PATH : userhome(env.coreRoot, 'node_modules', coreName),
  modules: {},
  argv: ''
}, env);

// check the node version
if (!sniff.isNewEnough) {
  debug('local node version: %s', sniff.nodeVersion);
  console.log('Node.js 7.6+ is required to run. You have ' + sniff.nodeVersion + '.');
  process.exit(1);
}

installUncaughtExceptionListener();

// check if user has use `sudo` or not
if (process.env.WEEX_ALLOW_SUDO) {
  console.log('root privileges downgrade skipped');
} else {
  require('root-check')(`
  ${colors.red('Please don\'t use `sudo` to run the command.')}

  If you can't run without sudo, you may have problems during installation.
  Try to run ${colors.underline('sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}')} command to empower your folders.
  `
  );
}

// check if there has userhome floder
if (!userhome()) {
  console.error(colors.red('ERROR: can not find HOME directory.'));
  this.process.exit(1);
}

const cli = async (processArgv) => {
  // check if we're running in dev mode
  const devMode = await fse.exists(`${coreData.corePath}/src`);
  const wantsCompiled = argv.compiled;
  const command = argv._[0];

  coreData.argv = processArgv;
  // prepare for running cli
  try {
    await prepare(command, env)
  }
  catch(error) {
    // TODO: pipe error to solutions.
    console.error(colors.red(`ERROR: ${error.stack || error}`))
  }

  if (command === 'completion') {
    // Register complete command
    tabtab.start()
  }
  else {
    if (devMode && !wantsCompiled) {
      // hook into ts-node so we can run typescript on the fly
      require('ts-node').register({ project: `${coreData.corePath}/tsconfig.json` })
      const TSCli = require(`${coreData.corePath}/src/cli/cli`).default;
      (new TSCli(coreData)).start()
    }
    else {
      try {
        const Cli = require(`${coreData.corePath}/lib/cli/cli`).default;
        (new Cli(coreData)).start()
      }
      catch(error) {
        // await prepare(repair)
      }
    }
  }
}

const prepare = async (command, config) => {
  // TODO: check there has a new version of `weex-toolkit` or not
  let corePackageJson = {}
  let coreVersion
  let coreName = config.coreName;
  let needInstall = false

  if (fse.existsSync(path.join(config.corePath, 'package.json'))) {
    corePackageJson = await readJson(path.join(config.corePath, 'package.json'))
  }
  if (fse.existsSync(path.join(config.moduleRoot, config.moduleConfigFileName))) {
    coreData['modules'] = await readJson(path.join(config.moduleRoot, config.moduleConfigFileName))
  }
  if (command === 'repair') {
    const repairModule = argv._[1];
    if (repairModule) {
      const arg = repairModule.split('@');
      if (arg.length > 1) {
        coreVersion = arg.pop();
        coreName = arg.join('@');
        
      }
      else {
        coreName = arg;
        coreVersion = 'latest';
      }
    }
    else {
      coreName = config.coreName
      coreVersion = 'latest'
    }
    // If repair module isn't the core module, pipe argv to the @weex-cli/core
    if (coreName !== config.coreName) {
      needInstall = false;
    }
    else {
      needInstall = true;
      debug(`start repair ${config.coreName}`)
      console.log(colors.yellow(`Start repair ${config.coreName}, please wait ...`));
    }
  }
  else {
    // checking if there has weex-cli/core
    if (!corePackageJson.name || !corePackageJson.version) {
      coreVersion = process.env.WEEX_CORE_VERSION || 'latest'
      debug('start install a new core')
      console.log(colors.yellow('Start installing Core, please wait ...'));
      needInstall = true;
    }
    // fetching if there has new version
    else {
      const latest = await got.get(
        config.registry + '/' + config.coreName + '/latest', {
          'json': true, 'timeout': 60 * 1000, 'retries': 0
        }
      );
      if (latest && latest.body) {
        debug('coreData from %s: %o', config.registry, latest.body);
        if (latest.body.version) {
          coreVersion = latest.body.version;
        }
        if (semver.gt(coreVersion, corePackageJson.version)) {
          const result = await confirm(
            'New version detected ' + colors.green(coreVersion) +
            ', the local version is ' + colors.dim(corePackageJson.version) +
            ', upgrade now？[Y/n]'
          );
          if (result) {
            console.log(colors.yellow(`upgrading Core from ${corePackageJson.version} -> ${coreVersion} ...`));
            debug('start upgrade to latest core')
            console.log(colors.yellow('Upgrading Core, please wait ...'));
            needInstall = true;
          }
        }
      }
    }
  }

  if (needInstall) {
    await install(coreName, coreVersion, {
      root: config.coreRoot,
      trash: config.trash,
      force: argv.force || argv.f,
      registry: config.registry
    });
    return ;
  }
}

module.exports = cli;
