'use-strict';

const port = process.env.PORT || 3006;

module.exports = {
  db: process.env.MONGODB_URL || 'mongodb://local/noobjs_dev',
};
