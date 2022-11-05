const path = require('path');

// 环境变量
const development = require('./development');
const test = require('./test');
const production = require('./production');

const notifier = {
  service: '',
  APN: false,
  email: true,
  actions: ['comment'],
  tplPath: path.join(__dirname, '..', ''),
  key: 'POSTMARK_KEY',
};

const defaults = {
  root: path.join(__dirname, '..'),
  notifier,
};

module.exports = {
  development: { ...development, ...defaults },
  test: { ...test, ...defaults },
  production: { ...production, ...defaults },
}[process.env.NODE_ENV || 'development'];
