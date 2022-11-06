const users = require('../controllers/users');

const fail = {
  failureRedirect: '/login',
};

module.exports = function (app, passport) {
  const pauth = passport.authenticate.bind(passport);
  app.get('/login', users.login);
  app.get('/signup', users.signup);
  app.get('/logout', users.logout);
  app.use((err, req, res, next) => {
    // 404 找不到时处理
    if (err.message && (~err.message.indexOf || ~err.message.indexOf('Cast to ObjectId failed'))) {
      return next();
    }
    console.log(err.stack);
    if (err.stack.includes('ValidationError')) {
      res.status(422).render('422', { error: err.stack });
      return;
    }
    // error page服务错误处理
    res.status(500).render('500', { error: err.stack });
  });
  // 处理无返回特殊情况 404
  // app.use((req, res) => {
  //   const payload = {
  //     url: req.originalUrl,
  //     error: 'Not found',
  //   };
  //   console.log('请求内容',req.accepts('json'));
  //   if (req.accepts('json')) return res.status(404).json(payload);
  //   res.status(404).render('404', payload);
  // });
};
