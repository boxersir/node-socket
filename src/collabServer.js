import SocketIO from 'socket.io';
import fs from 'fs';
import { join } from 'path';
import Document from './document';


const express = require('express');
export const app = require('express')();
export const http = require('http').Server(app);
const path = require('path');

export default class CollabServer {
  constructor(options) {
    this.options = options || {};
    this.io = new SocketIO(http);

    this.connectionGuard((_param, resolve) => { resolve(); });
    this.initDocument((_param, resolve) => { resolve(); });
    this.leaveDocument((_param, resolve) => { resolve(); });
    this.onClientConnect((_param, resolve) => { resolve(); });
    this.onClientDisconnect((_param, resolve) => { resolve(); });
  }

  serve() {
    // eslint-disable-next-line
    const request = require('request');
    app.use(express.json());
    app.use(express.urlencoded({
      extended: true,
    }));
    app.all('*', (req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'X-Requested-With');
      res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
      res.header('X-Powered-By', ' 3.2.1');
      res.header('Content-Type', 'application/json;charset=utf-8');
      next();
    });
    app.get('/nodeUnidoc/recover', (req, res) => {
      if (!req.headers.authorization) {
        res.send('no-token');
      } else {
        res.send('ok');
        // 分发clients 版本恢复
        fs.promises.readFile(`/upload/${req.query.namespace}/${req.query.docid}-clients.json`, 'utf8')
          .then((data) => JSON.parse(data))
          .catch(() => []).then((clients) => {
            const user = clients && Object.values(clients);
            user.forEach((id, i) => {
              user[i] += `-recover-${req.query.name}`;
            });
            console.log(user, '用户');
            this.io.of(req.query.namespace).in(req.query.docid).emit('getClients', user);
          });
      }
    });
    app.get('/drawio/proxy', (req, res) => {
      console.log(req.query.url, '....文档路径');
      const spath = req.query.url;
      let fileCon = null;
      const dirPath = path.join(__dirname, 'file');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
        console.log('文件夹创建成功');
      } else {
        console.log('文件夹已存在');
      }
      const fileArryNames = spath.split('/');
      const fileArryLen = fileArryNames.length;
      const fileName = fileArryNames[fileArryLen - 1];
      const stream = fs.createWriteStream(path.join(dirPath, `${fileName}.drawio`));
      request(spath).pipe(stream).on('close', (err) => {
        console.log(`文件[${'fileName'}]下载完毕`);
        fs.promises.readFile(`./src/file/${fileName}.drawio`, 'utf-8').then((data) => {
          // res.end(data);
          fileCon = data;
        }).catch(() => console.log(err))
          .then(() => {
            res.set({
              'Content-type': 'application/octet-stream',
            });
            res.send(fileCon);
          });
      });
    });
    app.get('/nodeUnidoc/saved', (req, res) => {
      if (!req.headers.authorization) {
        res.send('no-token');
      } else {
        res.send('ok');
        // 分发clients 版本保存
        fs.promises.readFile(`/upload/${req.query.namespace}/${req.query.docid}-clients.json`, 'utf8')
          .then((data) => JSON.parse(data))
          .catch(() => []).then((clients) => {
            const newClients = {};
            const userKey = clients && Object.keys(clients);
            userKey.forEach((user) => {
              newClients[user] = `${clients[user]}-saved-${req.query.name}`;
            });
            console.log(newClients, '用户保存');
            fs.promises.writeFile(`/upload/${req.query.namespace}/${req.query.docid}-clients.json`, JSON.stringify(newClients), 'utf8');
          });
      }
    });
    // http.listen(this.options.port || 6000);
    
    this.namespaces = this.io.of(this.options.namespaceFilter || /^\/[a-zA-Z0-9_/-]+$/);

    this.namespaces.on('connection', (socket) => {
      const namespace = socket.nsp;

      socket.on('join', ({ roomName, clientID, options }) => {
        socket.join(roomName);
        this.connectionGuardCallback({
          namespaceName: namespace.name,
          roomName,
          clientID,
          requestHeaders: socket.request.headers,
          options,
        })
          .then(() => {
            const document = new Document(
              namespace.name,
              roomName,
              this.options.lockDelay,
              this.options.lockRetries,
              this.options.maxStoredSteps,
              clientID,
            );

            // Document event management
            document
              .onVersionMismatch(({ version, steps }) => {
                // Send to every client in the roomName
                namespace.in(roomName).emit('update', {
                  version,
                  steps,
                });
              })
              .onNewVersion(({ version, steps }) => {
                // Send to every client in the roomName
                console.log(steps, '更新的是什么');
                namespace.in(roomName).emit('update', {
                  version,
                  steps,
                });
              })
              .onSelectionsUpdated((selections) => {
                // Send to every other client in the roomName
                socket.to(roomName).emit('getSelections', selections);
              })
              .onClientsUpdated((clients) => {
                // Send to every client in the roomName
                namespace.in(roomName).emit('getClients', clients);
              });

            // Handle document update
            socket.on('update', (data) => {
              document.updateDoc({ ...data, clientID });
            });

            // Handle update selection
            socket.on('updateSelection', (data) => {
              document.updateSelection({ ...data, clientID }, socket.id);
            });

            // Handle disconnection
            socket.on('disconnect', () => {
              document.leaveDoc(socket.id,
                ({ version, doc }, deleteDatabase) => this.leaveDocumentCallback({
                  namespaceName: namespace.name,
                  roomName,
                  clientID,
                  requestHeaders: socket.request.headers,
                  clientsCount: namespace.adapter.rooms[roomName]
                    ? namespace.adapter.rooms[roomName].length
                    : 0,
                  version,
                  doc,
                  deleteDatabase,
                }))
                .then(() => this.onClientDisconnectCallback({
                  namespaceName: namespace.name,
                  roomName,
                  clientID,
                  requestHeaders: socket.request.headers,
                  clientsCount: namespace.adapter.rooms[roomName]
                    ? namespace.adapter.rooms[roomName].length
                    : 0,
                }));
            });
            socket.on('saySomeone', (id, msg) => {
              console.log(id, msg, '打印一下');
              socket.broadcast.to(id).emit('my message', msg);
            });

            // Init
            return document.cleanUpClientsAndSelections(
              Object.keys(namespace.adapter.rooms[roomName].sockets),
            )
              .then(() => this.onClientConnectCallback({
                namespaceName: namespace.name,
                roomName,
                clientID,
                requestHeaders: socket.request.headers,
                clientsCount: namespace.adapter.rooms[roomName].length,
              }))
              .then(() => document.addClient(clientID, socket.id))
              .then(() => document.initDoc(
                ({ version, doc }) => this.initDocumentCallback({
                  namespaceName: namespace.name,
                  roomName,
                  clientID,
                  requestHeaders: socket.request.headers,
                  clientsCount: namespace.adapter.rooms[roomName].length,
                  version,
                  doc,
                }),
              ))
              .then(({ version, doc }) => {
                socket.emit('init', { version, doc });
                return document.getSelections();
              })
              .then((selections) => {
                socket.emit('getSelections', selections);
              });
          })
          .catch((error) => {
            socket.emit('initFailed', error);
            socket.disconnect();
          });
      });
    });

    return this;
  }

  close() {
    this.io.close();
  }

  connectionGuard(callback) {
    this.connectionGuardCallback = (param) => new Promise((resolve, reject) => {
      callback(param, resolve, reject);
    });
    return this;
  }

  initDocument(callback) {
    this.initDocumentCallback = (param) => new Promise((resolve, reject) => {
      callback(param, resolve, reject);
    });
    return this;
  }

  leaveDocument(callback) {
    this.leaveDocumentCallback = (param) => new Promise((resolve, reject) => {
      callback(param, resolve, reject);
    });
    return this;
  }

  onClientConnect(callback) {
    this.onClientConnectCallback = (param) => new Promise((resolve, reject) => {
      callback(param, resolve, reject);
    });
    return this;
  }

  onClientDisconnect(callback) {
    this.onClientDisconnectCallback = (param) => new Promise((resolve, reject) => {
      callback(param, resolve, reject);
    });
    return this;
  }
}
