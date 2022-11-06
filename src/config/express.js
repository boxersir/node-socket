'use strict'

//依赖中间件
const express = require('express')
const session = require('express-session') //会话数据存储在服务器上
const compression = require('compression') // 压缩请求
const morgan = require('morgan')           // express日志模块
const cookieParse = require('cookie-parser')//浏览器cookie解析
const bodyParse = require('body-parser')    //浏览器请求body解析
const methodOverride = require('method-override') //扩展http请求
const csrf = require('csurf') // node防攻击
const cors = require('cors')  //处理复杂请求
const helmet = require('helmet')//安全防护中间件 用于http保护
const upload = require('multer')() // 支持单个 多个

const MongoStore = require('connect-mongo') // 连接数据库
const flash = require('connect-flash')  // 对数据暂存
const winston = require('winston')      // 操作日志
const helpers = require('view-helpers') // 帮助方法
const ultimatePagination = require('ultimate-pagination') // 分页处理
const requireHttps = require('./middlewares/require-https')
const config = require('./')
const pkg = require('../../package.json')

const env = process.env.NODE_ENV || 'development'

module.exports = function(app,passport){
  console.log('路由监听...');
  app.use(
    helmet({
      contentSecurityPolicy:{
        useDefaults: true,
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'","'unsafe-inline'",'netdna.bootstrapcdn.com'],
          'img-src':["'self'",'data:','img.shields.io'],
          'object-src': ["'none'"],
        }
      }
    })
  )


  app.use(requireHttps)

  //请求前压缩
  app.use(compression({
    threshold:512
  }))

  app.use(cors({
    origin: ['http://127.0.0.1:6002'],
    optionsSuccessStatus: 200,
    credentials:true
  }))

  app.use(express.static(config.root+'/public'))
  let log = 'dev'
  if(env!=='development'){
    log = {
      stream:{
        write: message=> winston.info(message)
      }
    }
  }
  // 测试环境只输出
  if(env!=='test') app.use(morgan(log))

  app.set('views', config.root+'/app/views')
  app.set('view engine', 'pug')

  app.use(function(req,res,next){
    res.locals.pkg = pkg // package.json
    res.locals.env = env
    next()
  })

  // 接口请求参数
  app.use(bodyParse.json())
  app.use(bodyParse.urlencoded({extend:true}))
  app.use(upload.single('image'))
  app.use(
    methodOverride(function(req){
      if(req.body && typeof req.body === 'object'){
        // 对编码的post的处理
        var method = req.body._method
        delete req.body._method
        return method
      }
    })
  )

  app.use(cookieParse())
  app.use(
    session({
      resave: false,
      saveUninitialized: true,
      secret: pkg.name,
      store: MongoStore.create({
        mongoUrl:config.db,
        collection:'sessions'
      })
    })
  )

  //use passport session
  app.use(passport.initialize())
  app.use(passport.session())

  //缓存数据 与session同步删除
  app.use(flash())
  app.use(helpers(pkg.name))

  if(env !== 'test'){
    app.use(csrf()) //安全防护
    app.use(function(req,res,next){
      res.locals.csrf_token = req.csrf_token
      res.locals.paginate = ultimatePagination.getPaginationModel
      next()
    })
  }
  if(env === 'development'){
    app.locals.pretty = true
  }
}
