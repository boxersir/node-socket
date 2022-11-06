/*
 * @Author: caixin caixin185@163.com
 * @Date: 2022-05-13 11:54:50
 * @LastEditors: DESKTOP-LTTLG5D
 * @LastEditTime: 2022-09-02 16:06:22
 * @FilePath: /unidoc_nodeserve/example/server.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// import CollabServer from 'tiptap-collab-server';
import CollabServer from '../src/collabServer';
import {app,http} from '../src/collabServer';
import fs from 'fs';
const userInfo = {
  tenantId: null,
  Authorization: null,
  originHost: null,
  drafInfo: {}
};
console.log('开启服务..');

require('dotenv').config();
const passport = require('passport');

const port = process.env.PORT || 6002;

const mongoose = require('mongoose');
const config = require('../src/config');


// const models = join(__dirname, './models');
// fs.readFileSync(models)
//   .filter((file) => ~file.search(/^[^.].*\.js$/))
//   .forEach((file) => require(join(models, file)));

require('../src/models/user.js')
// 路由设置
require('../src/config/passport')(passport);
require('../src/config/express')(app, passport);
require('../src/config/routes')(app, passport);

// 监听端口
function listenTip() {
  console.log('监听端口...');
  if (app.get('env') === 'test') return;
  app.listen(port);
  console.log(`Express app started on port${port}`);
}

// 连接数据库
function connectDb() {
  console.log('开始连接数据库..');
  mongoose.connection.on('error', console.log).on('disconnected', connectDb)
    .once('open', listenTip);
    console.log(config.db,'..数据库');
  return mongoose.connect(config.db, {
    keepAlive: true, // 毫秒级别连接
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}
connectDb(http);
new CollabServer({
  port: 6002,
  namespaceFilter: /^\/[a-zA-Z0-9_/-]+$/,
  lockDelay: 1000,
  lockRetries: 10,
})
  .connectionGuard(({
    namespaceName, roomName, clientID, requestHeaders, options,
  }, resolve) => {
    userInfo.tenantId = options.tenantId;
    userInfo.Authorization = options.Authorization;
    userInfo.originHost = options.originHost;
    Object.assign(userInfo.drafInfo, JSON.parse(options.drafInfo))
    console.log('connectionGuard', namespaceName, roomName, clientID, requestHeaders, options);
    // 异常时解锁
    let errorData = ' '
    fs.promises.readFile(`/upload${namespaceName}/${roomName}_lock.json`, 'utf8')
      .then((data) => {
        errorData = JSON.parse(data)
      })
      .catch(() => []).then(() => {
        console.log('需要解锁', errorData);
        if (errorData) {
          let docNames = ['_lock']
          Promise.all(docNames.map((docName) =>
            fs.promises.unlink(`/upload${namespaceName}/${roomName}${docName}.json`).catch((e) => {
              console.log(`/upload${namespaceName}/${roomName}${docName}.json`, '解鎖中。。')
              console.log('解鎖成功');
            })
          )).then(() => {
            console.log('開始連接');
            resolve();
          })
        } else {
          resolve();
        }
      });
  })
  .onClientConnect(({
    namespaceName, roomName, clientID, requestHeaders, clientsCount,
  }, resolve) => {
    console.log('onClientConnect', namespaceName, roomName, clientID, requestHeaders, clientsCount);
    resolve();
  })
  .initDocument(({
    namespaceName, roomName, clientID, requestHeaders, clientsCount, version, doc,
  }, resolve) => {
    console.log('initDocument', {
      namespaceName, roomName, clientID, requestHeaders, clientsCount, version, doc,
    });
    // Load from backend if first user connected
    console.log('当前的version', version);
    if (version === 0 && clientsCount === 1 || clientID.indexOf('recover') > -1) {
      const http = require('https');
      const querystring = require('querystring')
      // eslint-disable-next-line
      const apiType = userInfo.drafInfo?.doc_type
      const apiNow = apiType.indexOf('template') > -1 ?'template':'document'
      const getData = apiNow === 'template' ? querystring.stringify({
        template_id: apiType.indexOf("_") > -1 ? (apiType.split("_")?.[1] * 1) : roomName
      }):querystring.stringify({
        document_id: roomName,
        space_identify: namespaceName.substr(1),
        isMainPage: false,
        action: 'edit'
      })
      const optionQ = {
        host: userInfo.originHost,
        path: `/api/unidoc/v1/${apiNow}/info?${getData}`,
        method: 'GET',
        headers: {
          tenantId: userInfo.tenantId * 1,
          Authorization: userInfo.Authorization
        }
      };
      var BufferHelper = require('bufferhelper');
      var iconv = require('iconv-lite');
      var bufferHelper = new BufferHelper();
      console.log('开始请求')
      console.log(optionQ)
      const req = http.request(optionQ, res => {
        console.log(`状态码: ${res.statusCode}`);
        res.on('data', d => {
          bufferHelper.concat(d);
        });
        res.on('end', () => {
          var dataStr = iconv.decode(bufferHelper.toBuffer(), "utf-8");
          if (dataStr && (JSON.parse(dataStr)?.data?.content_json)) {
            let embed = JSON.parse(dataStr).data.content_json && JSON.parse(JSON.parse(dataStr).data.content_json)
            console.log(embed, '查到输出的内容');
            resolve({
              version: 1,
              doc: embed
            })
          } else {
            resolve({
              version: 1,
              doc: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph'
                  },
                ],
              },
            })
          }
        });
      });
      req.on('error', error => {
        console.log(error)
        resolve()
      });
      req.end();
    } else {
      resolve()
    }
    // resolve();
  })
  .leaveDocument(({
    namespaceName, roomName, clientID, requestHeaders, clientsCount, version, doc, deleteDatabase,
  }, resolve) => {
    console.log('leaveDocument', {
      namespaceName, roomName, clientID, requestHeaders, clientsCount, version, doc, deleteDatabase,
    });
    // Save to backend if last user disconnected
    if (clientsCount === 0) {
      deleteDatabase().then(() => resolve());
    }
    resolve();
  })
  .onClientDisconnect(({
    namespaceName, roomName, clientID, requestHeaders, clientsCount,
  }, resolve) => {
    console.log('onClientDisconnect', namespaceName, roomName, clientID, requestHeaders, clientsCount);
    resolve();
  })
  .serve();
