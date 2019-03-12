const crypto = require('../../../utils/crypto');
const response = require('../../../utils/response');
const db = require('../../../utils/db');
const tokenMgr = require('../../../game/tokenmgr');
const roomMgr = require('../../../game/roommgr');
const userMgr = require('../../../game/usermgr');
const channelUtil = require('../../../utils/channelUtil');

module.exports = function (app) {
  return new Handler(app);
};

const Handler = function (app) {
  this.app = app;
  this.channelService = app.get('channelService');
};

/**
 * 进入游戏
 * @param msg
 * @param session
 * @param next
 */
Handler.prototype.login = function (msg, session, next) {
  (async () => {

    var data = msg;
    if (!session.uid) {
      //已经登陆过的就忽略
      next(null, response(1, '请重新登录'));
      return;
    }
    console.log(msg)
    var roomId = data.roomid;
    var userId = session.uid;
    console.log(msg)
    session.set('roomid', roomId);
    session.push('roomid', function (res) {
      console.log('roomid设置成功')
    });
    const channel = this.channelService.getChannel(roomId, false);
    if (!channel) {
      channelUtil.pushMessageByUids(this.channelService, 'login_result', response(1, "invalid parameters"), channelUtil.getUidsByUid(channel, session.uid));
      next();
      return;
    }
    //检查参数合法性
    if (!roomId) {
      channelUtil.pushMessageByUids(this.channelService, 'login_result', response(1, "invalid parameters"), channelUtil.getUidsByUid(channel, session.uid));
      next();
      return;
    }

    //检查房间合法性
    var roomId = roomMgr.getUserRoom(userId);
    console.log('用户在房间中：' + roomId);

    // 绑定用户信息
    userMgr.bind(userId, session);

    //返回房间信息
    var roomInfo = roomMgr.getRoom(roomId);
    //玩家上线，强制设置为TRUE
    var seatIndex = roomMgr.getUserSeat(userId);
    roomInfo.seats[seatIndex].ip = '127.0.0.1';
    var userData = null;
    var seats = [];
    for (var i = 0; i < roomInfo.seats.length; ++i) {
      var rs = roomInfo.seats[i];
      var online = false;
      if (rs.userId > 0) {
        online = userMgr.isOnline(rs.userId);
      }

      seats.push({
        userid: rs.userId,
        ip: rs.ip,
        score: rs.score,
        name: rs.name,
        online: online,
        ready: rs.ready,
        seatindex: i
      });

      if (userId == rs.userId) {
        userData = seats[i];
      }
    }

    //通知前端
    var ret = {
      errcode: 0,
      errmsg: "ok",
      data: {
        roomid: roomInfo.id,
        conf: roomInfo.conf,
        numofgames: roomInfo.numOfGames,
        seats: seats
      }
    };
    //socket.emit('login_result',ret);
    channelUtil.pushMessageByUids(this.channelService, 'login_result', ret, channelUtil.getUidsByUid(channel, userId));

    //通知其它客户端
    channelUtil.pushMessageByUids(this.channelService, 'new_user_comes_push', userData, channelUtil.getUidsExcludeUid(channel, userId));

    roomInfo.gameMgr.setReady(userId, true);
    channelUtil.pushMessageByUids(this.channelService, 'login_finished', response(0, 'ok'), channelUtil.getUidsByUid(channel, userId));

    if (roomInfo.dr) {
      var dr = roomInfo.dr;
      var ramaingTime = (dr.endTime - Date.now()) / 1000;
      let data = {
        time: ramaingTime,
        states: dr.states
      }
      // userMgr.sendMsg(userId,'dissolve_notice_push',data);
      channelUtil.pushMessageByUids(this.channelService, 'dissolve_notice_push', data, channelUtil.getUidsByUid(channel, userId));

    }

    next();
  })();
};

/**
 * 用户准备游戏
 * @param msg
 * @param session
 * @param next
 */
Handler.prototype.ready = function (msg, session, next) {
  (async () => {

    var userId = msg.uid;
    if (!userId) {
      next();
      return;
    }

    let roomId = session.get('roomid');
    let channel = channelUtil.getChannelByName(this.app, roomId);
    channel.gameMgr.setReady(session.uid);
    //userMgr.broacastInRoom('user_ready_push',{userid:userId,ready:true},userId, true);
    channelUtil.pushMessageByUids('user_ready_push', {
      userid: userId,
      ready: true
    }, channelUtil.getUidsExcludeUid(channel, userId));
    next();
  })();
};

//换牌
Handler.prototype.huanpai = function (msg, session, next) {
  (async () => {

    if (!session.uid) {
      next();
      return;
    }

    var p1 = msg.p1;
    var p2 = msg.p2;
    var p3 = msg.p3;
    if (!p1 || !p2 || !p3) {
      console.log("invalid data");
      next();
      return;
    }

    //socket.gameMgr.huanSanZhang(socket.userId,p1,p2,p3);
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channel.gameMgr.huanSanZhang(session.uid, p1, p2, p3);
    next();
  })();
};

//定缺
Handler.prototype.dingque = function (msg, session, next) {
  let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
  channel.gameMgr.dingQue(session.uid, msg);
  next();
};

//出牌
Handler.prototype.chupai = function (msg, session, next) {
  (async () => {
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channel.gameMgr.chuPai(session.uid, msg);
    next();
  })();
};

//peng
Handler.prototype.peng = function (msg, session, next) {
  (async () => {
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channel.gameMgr.peng(session.uid);
    next();
  })();
};

//gang
Handler.prototype.gang = function (msg, session, next) {
  (async () => {

    var pai = -1;
    if (typeof(msg) == "number") {
      pai = msg;
    }
    else if (typeof(msg) == "string") {
      pai = parseInt(msg);
    }
    else {
      console.log("gang:invalid param");
      return;
    }
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channel.gameMgr.gang(session.uid, pai);
    next();
  })();
};

//hu
Handler.prototype.hu = function (msg, session, next) {
  (async () => {
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channel.gameMgr.hu(session.uid);
    next();
  })();
};

// guo
Handler.prototype.guo = function (msg, session, next) {
  (async () => {
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channel.gameMgr.guo(session.uid);
    next();
  })();
};

// chat
Handler.prototype.chat = function (msg, session, next) {
  (async () => {
    let uid = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channelUtil.pushMessage(channel, 'chat_push', {
      sender: uid,
      content: msg
    });
    next();
  })();
};

// 快速聊天
Handler.prototype.quick_chat = function (msg, session, next) {
  (async () => {
    let uid = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channelUtil.pushMessage(channel, 'quick_chat_push', {
      sender: uid,
      content: msg
    });
    next();
  })();
};

//语音聊天
Handler.prototype.voice_msg = function (msg, session, next) {
  (async () => {
    let uid = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channelUtil.pushMessage(channel, 'voice_msg_push', {
      sender: uid,
      content: msg
    });
    next();
  })();
};

// 表情
Handler.prototype.emoji = function (msg, session, next) {
  (async () => {
    let uid = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    channelUtil.pushMessage(channel, 'emoji_push', {
      sender: uid,
      content: msg
    });
    next();
  })();
};

// 退出房间
Handler.prototype.exit = function (msg, session, next) {
  (async () => {
    let userId = session.uid;

    var roomId = roomMgr.getUserRoom(userId);
    if(!roomId){
      next();
      return;
    }

    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    //如果游戏已经开始，则不可以
    if(channel.gameMgr.hasBegan(roomId)){
      next();
      return;
    }

    //如果是房主，则只能走解散房间
    if(roomMgr.isCreator(userId)){
      next();
      return;
    }

    //通知其它玩家，有人退出了房间
    channelUtil.pushMessageByUids(this.channelService, 'exit_notify_push', userId, channelUtil.getUidsExcludeUid(channel, userId));
    roomMgr.exitRoom(userId);
    userMgr.del(userId);

    //socket.emit('exit_result');
    channelUtil.pushMessageByUids(this.channelService, 'exit_result', {}, channelUtil.getUidsByUid(channel, userId));
    //socket.disconnect();
    next();
  })();
};

// 解散房间
Handler.prototype.dispress = function (msg, session, next) {
  (async () => {
    let userId = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));

    var roomId = roomMgr.getUserRoom(userId);
    if(!roomId){
      next();
      return;
    }

    //如果游戏已经开始，则不可以
    if(channel.gameMgr.hasBegan(roomId)){
      next();
      return;
    }

    //如果不是房主，则不能解散房间
    if(roomMgr.isCreator(roomId) === false){
      next();
      return;
    }

    channelUtil.pushMessage(this.channel, 'dispress_push', {});
    userMgr.kickAllInRoom(roomId);
    roomMgr.destroy(roomId);
    // socket.disconnect();
  })();
};

// 解散房间
Handler.prototype.dissolve_request = function (msg, session, next) {
  (async () => {
    let userId = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));

    var roomId = roomMgr.getUserRoom(userId);
    if(!roomId){
      console.log(3);
      next();
      return;
    }

    //如果游戏未开始，则不可以
    if(channel.gameMgr.hasBegan(roomId) === false){
      console.log(4);
      next();
      return;
    }

    var ret = channel.gameMgr.dissolveRequest(roomId,userId);
    if(ret){
      var dr = ret.dr;
      var ramaingTime = (dr.endTime - Date.now()) / 1000;
      var data = {
        time:ramaingTime,
        states:dr.states
      }
      console.log(5);
      // userMgr.broacastInRoom('dissolve_notice_push',data,userId,true);
      channelUtil.pushMessage(this.channel, 'dissolve_notice_push', data);
    }
  })();
};

Handler.prototype.dissolve_agree = function (msg, session, next) {
  (async () => {
    let userId = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    var roomId = roomMgr.getUserRoom(userId);
    if(!roomId){
      next();
      return;
    }

    var ret = channel.gameMgr.dissolveAgree(roomId, userId,true);
    if(ret){
      var dr = ret.dr;
      var ramaingTime = (dr.endTime - Date.now()) / 1000;
      var data = {
        time:ramaingTime,
        states:dr.states
      }
      // userMgr.broacastInRoom('dissolve_notice_push',data,userId,true);
      channelUtil.pushMessage(channel, 'dissolve_notice_push', data);

      var doAllAgree = true;
      for(var i = 0; i < dr.states.length; ++i){
        if(dr.states[i] == false){
          doAllAgree = false;
          break;
        }
      }

      if(doAllAgree){
        channel.gameMgr.doDissolve(roomId);
      }
    }
  })();
};

Handler.prototype.dissolve_reject = function (msg, session, next) {
  (async () => {
    let userId = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    var roomId = roomMgr.getUserRoom(userId);
    if(!roomId){
      next();
      return;
    }

    var ret = channel.gameMgr.dissolveAgree(roomId,userId,false);
    if(ret){
      channel.pushMessage(channel, 'dissolve_cancel_push', {});
    }
  })();
};

// 断开链接
Handler.prototype.disconnect = function (msg, session, next) {
  (async () => {
    let userId = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    //如果是旧链接断开，则不需要处理。
    if(userMgr.get(userId) !== session){
      next();
      return;
    }

    var data = {
      userid:userId,
      online:false
    };

    //通知房间内其它玩家
    // userMgr.broacastInRoom('user_state_push',data,userId);
    channel.pushMessageByUids(this.channelService, 'user_state_push', data, channelUtil.getUidsExcludeUid(channel, userId));

    //清除玩家的在线信息
    userMgr.del(userId);
    session.unbind(userId, this.getServerId());
  })();
};

Handler.prototype.game_ping = function (msg, session, next) {
  (async () => {
    let userId = session.uid;
    let channel = channelUtil.getChannelByName(this.app, session.get('roomid'));
    //console.log('game_ping');
    channelUtil.pushMessageByUids(this.channelService, 'game_pong', {}, channelUtil.getUidsByUid(channel, userId));
  })();
};