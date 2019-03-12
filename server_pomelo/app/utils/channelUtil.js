const channelUtil = {};

/**
 * 给指定的 uids 推送信息
 * @param channelService
 * @param route
 * @param uids
 * @param msg
 * @param callback
 */
channelUtil.pushMessageByUids = function (channelService, route, msg, uids, callback) {
  channelService.pushMessageByUids(route, msg, uids,  function (err) {
    if (callback && typeof callback === 'function') {
      callback(err);
    }
  });
};

/**
 * 给频道内的用户推送信息
 * @param channel
 * @param route
 * @param msg
 * @param callback
 */
channelUtil.pushMessage = function (channel, route, msg, callback) {
  if (!callback || typeof callback !== 'function') {
    callback = function (err) {

    };
  }
  channel.pushMessage(route, msg, callback);
};

/**
 * 根据用户id获取uid和server_id
 * @param channel
 * @returns {Array}
 */
channelUtil.getUidsByUid = function (channel, uid) {
  let uids = [];

  // 获取频道内的所以用户id
  let members = channel.getMembers();

  // 根据用户id获取sid
  for (let i = 0; i < members.length; i++) {
    if (members[i] === uid) {
      let member = channel.getMember(uid);
      uids.push({uid: uid, sid: member.sid});
      continue;
    }
  }

  return uids;
};

/**
 * 获取同频道内用户的 uids，除了 excludeUid 外
 * @param channel
 * @param excludeUid
 * @returns {Array}
 */
channelUtil.getUidsExcludeUid = function (channel, excludeUid) {
  let uids = [];

  // 获取频道内的所以用户id
  let members = channel.getMembers();

  // 根据用户id获取sid
  for (let i = 0; i < members.length; i++) {
    if (excludeUid > 0 && excludeUid === members[i]) {
      continue;
    }
    let member = channel.getMember(members[i]);
    uids.push({uid: members[i], sid: member.sid});
  }

  return uids;
};

/**
 * 获取频道内的全部用户 uids
 * @param channel
 * @returns {Array}
 */
channelUtil.getUids = function (channel) {
  let uids = [];

  // 获取频道内的所以用户id
  let members = channel.getMembers();

  // 根据用户id获取sid
  for (let i = 0; i < members.length; i++) {
    let member = channel.getMember(members[i]);
    uids.push({uid: members[i], sid: member.sid});
  }

  return uids;
};

/**
 * 获取频道
 * @param app
 * @returns {Channel}
 */
channelUtil.getChannelByName = function (app, roomId) {
  return app.get('channelService').getChannel(roomId + '', false);
};

module.exports = channelUtil;