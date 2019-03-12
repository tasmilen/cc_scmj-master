const crypto = require('../../../utils/crypto');
const response = require('../../../utils/response');
const db = require('../../../utils/db');
const tokenMgr = require('../../../game/tokenmgr');
const roomMgr = require('../../../game/roommgr');
const userMgr = require('../../../game/usermgr');

module.exports = function (app) {
  return new Handler(app);
};

const Handler = function (app) {
  this.app = app;
  this.channelService = app.get('channelService');
};

/**
 * New client entry.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.entry = function (msg, session, next) {

  (async () => {
    const knex = this.app.get("knex");
    const user = await knex.table('t_users').where({userid: 10}).first();
    next(null, {code: 200, msg: user});
  })();
};


Handler.prototype.get_serverinfo = function (msg, session, next) {
  (async () => {
    const ret = {
      version: '20161227',
      hall: '127.0.0.1:13010',
      appweb: 'http://fir.im/2f17',
    };
    next(null, ret);
  })();
};

/**
 * 游客登录
 * @param msg
 * @param session
 * @param next
 */
Handler.prototype.guest = function (msg, session, next) {
  (async () => {
    const account = "guest_" + msg.account;
    const sign = crypto.md5(account + '127.0.0.1' + '^&*#$%()@');
    const ret = {
      errcode: 0,
      errmsg: "ok",
      account: account,
      halladdr: '127.0.0.1:13010',
      sign: sign
    };
    next(null, ret);
  })();
};

Handler.prototype.login = function (msg, session, next) {
  (async () => {
    // if(!check_account(msg)){
    //   return;
    // }
    //
    var ip = '127.0.0.1';
    // if(ip.indexOf("::ffff:") != -1){
    //   ip = ip.substr(7);
    // }

    var account = msg.account;

    const user = await db.get_user_data(account);
    if (!user) {
      next(null, response(0, 'ok'));
      return;
    }

    var ret = {
      account: user.account,
      userid: user.userid,
      name: user.name,
      lv: user.lv,
      exp: user.exp,
      coins: user.coins,
      gems: user.gems,
      ip: ip,
      sex: user.sex,
    };

    // 如果用户已经绑定，直接返回
    const sessionService = this.app.get('sessionService');
    if (!sessionService.getByUid(user.userid)) {
      session.bind(user.userid);
    }
    // 用户断开会话时调用
    session.on('closed', onUserLeave.bind(null, this.app));

    //如果用户处于房间中，则需要对其房间进行检查。 如果房间还在，则通知用户进入
    if (!user.roomid) {
      next(null, response(0, "ok", ret));
      return;
    }

    const roomId = user.roomid;
    //检查房间是否存在于数据库中
    const roomsExist = await db.is_room_exist(roomId);
    if (!roomsExist) {
      //如果房间不在了，表示信息不同步，清除掉用户记录
      await db.set_room_id_of_user(user.userid, null);
    }
    ret.roomid = roomId;

    next(null, response(0, "ok", ret));
  })();
};

Handler.prototype.create_user = function (msg, session, next) {
  (async () => {

    // if(!check_account(req,res)){
    //   return;
    // }

    var account = msg.account;
    var name = msg.name;
    var coins = 1000;
    var gems = 21;
    console.log(name);

    const userExist = await db.is_user_exist(account);
    if (userExist) {
      next(null, response(1, "account have already exist."));
      return;
    }

    if (account == null || name == null || coins == null || gems == null) {
      next(null, response(2, "system error."));
      return;
    }

    const res = await db.create_user(account, name, coins, gems, 0, null);
    if (res) {
      next(null, response(0, "ok"));
      return;
    }
    next(null, response(2, "system error."));
  })();
};

Handler.prototype.create_private_room = function (msg, session, next) {
  (async () => {
    const data = msg;
    const account = data.account;
    data.account = null;
    data.sign = null;
    const conf = data.conf;
    const user = await db.get_user_data(account);
    if (!user) {
      next(null, response(1, 'system error'));
      return;
    }
    let userId = user.userid;
    // 判断用户是否正在玩游戏
    let roomId = await db.get_room_id_of_user(userId);
    if (roomId) {
      next(null, response(-1, 'user is playing in room now.'));
      return;
    }

    // 判断用户房卡
    const gems = await db.get_gems(account);
    if (!gems) {
      next(null, response(103, '房卡数量不足'));
      return;
    }

    // 创建房间
    roomId = await roomMgr.createRoom(this.app, userId, conf, gems, '127.0.0.1', '13010');
    if (!roomId) {
      next(null, response(1, 'create failed.'));
      return;
    }

    console.log('创建房间成功 ' + roomId)
    // 安排玩家坐下
    let enterRes = await roomMgr.enterRoom(roomId,userId,user.name);
    if (enterRes === 1) {
      next(null, response(4, 'room is full.'));
      return;
    }
    console.log('安排玩家坐下 ' + enterRes)
    if (enterRes === 1) {
      next(null, response(3, "can't find room."));
      return;
    }

    if (enterRes === 0) {
      // 把用户加入频道中
      let channel = this.channelService.getChannel(roomId + '', true);
      channel.add(userId, this.app.getServerId());
      await db.set_room_id_of_user(userId, roomId);
      next(null, response(0, "ok", {
        roomid: roomId,
        ip: '127.0.0.1',
        port: '10000',
        token: ''
      }));
    }

  })();
};

Handler.prototype.enter_private_room = function (msg, session, next) {
  (async () => {
    var data = msg;
    var roomId = data.roomid;
    if (!roomId) {
      next(null, response(-1, "parameters don't match api requirements."));
      return;
    }
    let account = data.account;
    const user = await db.get_user_data(account);
    if (!user) {
      next(null, response(-1, "system error"));
      return;
    }

    var userId = session.uid;
    // 进入房间
    let enterRes = await roomMgr.enterRoom(roomId, userId, user.name);
    if (enterRes === 1) {
      next(null, response(4, 'room is full.'));
      return;
    }
    console.log('安排玩家坐下 ' + enterRes)
    if (enterRes === 1) {
      next(null, response(3, "can't find room."));
      return;
    }

    if (enterRes === 0) {
      // 把用户加入频道中
      let channel = this.channelService.getChannel(roomId + '', true);
      console.log('房间创建成功 ' + userId + ' ' + roomId)
      channel.add(userId, this.app.getServerId());
      await db.set_room_id_of_user(userId, roomId);
      next(null, response(0, "ok", {
        roomid: roomId,
        ip: '127.0.0.1',
        port: '10000',
        token: ''
      }));
      return;
    }
    next(null, response(400, "进入房间失败"));

  })();
};



const onUserLeave = function (app, session) {

  console.log(`${session.uid} 退出app`);

  if (!session || !session.uid) {
    return;
  }

  // app.rpc.niuniu.niuniuRemote.kick(session, session.uid, app.get('serverId'), session.get('roomId'), null);

};