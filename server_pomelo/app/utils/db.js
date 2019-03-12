const crypto = require('./crypto');

let knex = null;

exports.init = function(mysqlConfig){
  knex = require('knex')({
    client: 'mysql2',
    connection: {
      host : mysqlConfig.host,
      user : mysqlConfig.user,
      password : mysqlConfig.password,
      database : mysqlConfig.database
    },
    pool: { min: 2, max: 10 }
  });

  return knex;
};

/**
 * 根据账号查找用户信息
 * @param account
 * @returns {Promise.<*>}
 */
exports.get_user_data = async (account) => {
  if(!account){
    return false;
  }

  const user = await knex.table('t_users').where({account: account}).first();
  if (!user) {
    return;
  }

  user.name = crypto.fromBase64(user.name);
  return user;
};

/**
 * 查看用户是否在房间中
 * @param userId
 * @returns {Promise.<boolean>}
 */
exports.get_room_id_of_user = async (userId) => {
  const hasRoom = await knex.table('t_users').select('roomid').where({userid: userId}).first();
  if (!hasRoom || !hasRoom.roomid) {
    return false;
  }

  return hasRoom.roomid;
};

/**
 * 检查房间是否存在于数据库中
 * @param roomId
 * @returns {Promise.<boolean>}
 */
exports.is_room_exist = async (roomId) => {
  const roomsInfo = await knex.table('t_rooms').where({id: roomId}).first();

  if (!roomsInfo) {
    return false;
  }

  return true;
};

/**
 * 更新用户的房间
 * @param userId
 * @param roomId
 * @returns {Promise.<*>}
 */
exports.set_room_id_of_user = async (userId,roomId) => {
  if(roomId != null){
    roomId = '"' + roomId + '"';
  }
  const res = await knex.table('t_users').where({userid: userId}).update({roomid: roomId});
  console.log(res)
  return res;
};

exports.is_user_exist = async (account) => {
  if(account == null){
    return false;
  }

  const user = await knex.table('t_users').where({account: account}).first();
  if (user) {
    return true;
  }

  return false;
};

/**
 * 创建用户
 * @param account
 * @param name
 * @param coins
 * @param gems
 * @param sex
 * @param headimg
 * @returns {Promise.<boolean>}
 */
exports.create_user = async (account,name,coins,gems,sex,headimg) => {
  if(account == null || name == null || coins==null || gems==null){
    return false;
  }
  if(headimg) {
    headimg = '"' + headimg + '"';
  } else {
    headimg = 'null';
  }
  name = crypto.toBase64(name);
  const userData = {
    account: account,
    name: name,
    coins: coins,
    gems: gems,
    sex: sex,
    headimg: headimg
  };
  const res = await knex.table('t_users').insert(userData);
  if (res) {
    return true;
  }

  return false;
};

exports.get_gems = async (account) => {
  if(account == null){
    return false;
  }

  const user = await knex.table('t_users').select('gems').where({account: account}).first();
  if (!user || !user.gems) {
    return false;
  }

  return user.gems;
};

/**
 * 创建房间
 * @param roomId
 * @param conf
 * @param ip
 * @param port
 * @param create_time
 * @returns {Promise.<*>}
 */
exports.create_room = async (roomId,conf,ip,port,create_time) => {
  var uuid = Date.now() + roomId;
  var baseInfo = JSON.stringify(conf);
  const roomData = {
    uuid: uuid,
    id: roomId,
    base_info: baseInfo,
    ip: ip,
    port: port,
    create_time: create_time
  };
  const res = await knex.table('t_rooms').insert(roomData);
  if (!res) {
    return false;
  }

  return uuid;
};

exports.get_room_addr = async (roomId) => {
  if (roomId == null) {
    return false;
  }

  const room = await knex.table('t_rooms').select('ip', 'port').where({id: roomId}).first();
  if (!room || room.ip || room.port) {
    return false;
  }

  return room;
};

exports.set_room_id_of_user = async (userId,roomId) => {
  if (roomId) {
    roomId = '"' + roomId + '"';
  }
  let res = knex.table('t_users').where({userid: userId}).update({roomid: roomId});
  return res;
};

exports.delete_room = async (roomId) => {
  if (!roomId) {
    return false;
  }
  let res = await knex.table('t_rooms').where({id: roomId}).delete();
  return res;
};

exports.update_seat_info = async (roomId,seatIndex,userId,icon,name) => {
  name = crypto.toBase64(name);
  const data = {};
  data['user_id'+seatIndex] = userId;
  data['user_icon'+seatIndex] = icon;
  data['user_name'+seatIndex] = name;
  return await knex.table('t_rooms').where({id: roomId}).update(data);
};

exports.get_room_data = async (roomId) => {
  if (!roomId) {
    return false;
  }

  let room = await knex.table('t_rooms').where({id: roomId}).first();
  if (!room) {
    return false;
  }

  room.user_name0 = crypto.fromBase64(room.user_name0);
  room.user_name1 = crypto.fromBase64(room.user_name1);
  room.user_name2 = crypto.fromBase64(room.user_name2);
  room.user_name3 = crypto.fromBase64(room.user_name3);
  return room;
};
