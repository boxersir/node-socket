// 强制https
module.exports = function requireHTTPS(req, res, next) {
  console.log('检测请求...',process.env.NODE_ENV);
  if (!req.secure && req.get('x-forwarded-proto') !== 'https'
   &&process.env.NODE_ENV  
  && process.env.NODE_ENV !== 'development'
    && process.env.NODE_ENV !== 'test'
  ) {
    return res.redirect(`https://${req.get('host')}${req.url}`);
  }
  next();
};
