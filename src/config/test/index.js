'use-strict';

const port = process.env.PORT || 6002;

module.exports = {
  db: process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/noobjs_test',
};
