const mongoose = require('mongoose');
const { wrap: async } = require('co');
// 解放自动执行
const User = mongoose.model('User');

/** load加载 */
exports.load = async(function* (req, res, next, _id) {
  const criteria = { _id };
  try {
    req.profile = yield User.load({ criteria });
    if (!req.profile) return next(new Error('Users not found'));
  } catch (err) {
    return next(err);
  }
  next();
});

/** create user 创建 */
exports.create = async(function* (req, res) {
  const user = new User(req.body);
  user.provider = 'local';
  try {
    yield user.save();
    req.logIn(user, (err) => {
      if (err) req.flash('info', 'sorry you are not able to log you in');
      res.redirect('/');
    });
  } catch (error) {
    const errors = Object.keys(err.erros).map(
      (field) => err.errors[field].message,
    );
    res.render('users/signup', {
      title: 'sign up',
      errors,
      user,
    });
  }
});

exports.show = function(req,res){
  const user = req.profile
  res.render('users/show',{
    title: user.name,
    user:user
  })
}

exports.signin - function() {}

/**权限 */
exports.authCallback = login

/**signup */
exports.signup = function(req,res){
  res.render('users/signup',{
    title:'Sign up',
    user:new User()
  })
}

/**login */
exports.login = function(req,res){
  res.render('/login',{
    title:'Login'
  })
}
/**logout */
exports.logout =  function(req,res){
  req.logout()
  res.redirect('/login')
}

/**session */
exports.session = login

function login(req,res) {
  const redirectTo = req.session.returnTo ? req.session.returnTo:'/'
  delete req.session.returnTo
  res.redirect(redirectTo)
}