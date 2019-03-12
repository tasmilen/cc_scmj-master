var db = require('../utils/db');

var rooms = {};
var creatingRooms = {};

var userLocation = {};
var totalRooms = 0;

var DI_FEN = [1, 2, 5];
var MAX_FAN = [3, 4, 5];
var JU_SHU = [4, 8];
var JU_SHU_COST = [2, 3];

function generateRoomId() {
  var roomId = "";
  for (var i = 0; i < 6; ++i) {
    roomId += Math.floor(Math.random() * 10);
  }
  return roomId;
}

function constructRoomFromDb(dbdata) {
  var roomInfo = {
    uuid: dbdata.uuid,
    id: dbdata.id,
    numOfGames: dbdata.num_of_turns,
    createTime: dbdata.create_time,
    nextButton: dbdata.next_button,
    seats: new Array(4),
    conf: JSON.parse(dbdata.base_info)
  };


  if (roomInfo.conf.type == "xlch") {
    roomInfo.gameMgr = require("./gamemgr_xlch");
  }
  else {
    roomInfo.gameMgr = require("./gamemgr_xzdd");
  }
  var roomId = roomInfo.id;

  for (let i = 0; i < 4; ++i) {
    const s = roomInfo.seats[i] = {};
    s.userId = dbdata["user_id" + i];
    s.score = dbdata["user_score" + i];
    s.name = dbdata["user_name" + i];
    s.ready = false;
    s.seatIndex = i;
    s.numZiMo = 0;
    s.numJiePao = 0;
    s.numDianPao = 0;
    s.numAnGang = 0;
    s.numMingGang = 0;
    s.numChaJiao = 0;

    if (s.userId > 0) {
      userLocation[s.userId] = {
        roomId: roomId,
        seatIndex: i
      };
    }
  }
  rooms[roomId] = roomInfo;
  totalRooms++;
  return roomInfo;
}

exports.createRoom = async function (app, creator, roomConf, gems, ip, port) {
  roomConf = JSON.parse(roomConf);
  if (
    roomConf.type === null
    || roomConf.difen === null
    || roomConf.zimo === null
    || roomConf.jiangdui === null
    || roomConf.huansanzhang === null
    || roomConf.zuidafanshu === null
    || roomConf.jushuxuanze === null
    || roomConf.dianganghua === null
    || roomConf.menqing === null
    || roomConf.tiandihu === null) {
    // callback(1,null);
    return false;
  }

  if (roomConf.difen < 0 || roomConf.difen > DI_FEN.length) {
    // callback(1,null);
    return false;
  }

  if (roomConf.zimo < 0 || roomConf.zimo > 2) {
    // callback(1,null);
    return false;
  }

  if (roomConf.zuidafanshu < 0 || roomConf.zuidafanshu > MAX_FAN.length) {
    // callback(1,null);
    return false;
  }

  if (roomConf.jushuxuanze < 0 || roomConf.jushuxuanze > JU_SHU.length) {
    // callback(1,null);
    return false;
  }

  const cost = JU_SHU_COST[roomConf.jushuxuanze];
  if (cost > gems) {
    // callback(2222,null);
    return false;
  }
  console.log('createRoom fnCreate')
  let roomId = generateRoomId();
  // 生成房间号并判断房间号是否存在
  let existRoomId = true;
  while (existRoomId) {
    if (!rooms[roomId] || !creatingRooms[roomId]) {
      let roomExist = await db.is_room_exist(roomId);
      if (!roomExist) {
        existRoomId = false;
      } else {
        roomId = generateRoomId();
      }
    } else {
      roomId = generateRoomId();
    }
  }
  console.log('createRoom fnCreate 房间不存在 1 ' + roomId)
  creatingRooms[roomId] = true;

  var createTime = Math.ceil(Date.now() / 1000);
  var roomInfo = {
    uuid: "",
    id: roomId,
    numOfGames: 0,
    createTime: createTime,
    nextButton: 0,
    seats: [],
    conf: {
      type: roomConf.type,
      baseScore: DI_FEN[roomConf.difen],
      zimo: roomConf.zimo,
      jiangdui: roomConf.jiangdui,
      hsz: roomConf.huansanzhang,
      dianganghua: parseInt(roomConf.dianganghua),
      menqing: roomConf.menqing,
      tiandihu: roomConf.tiandihu,
      maxFan: MAX_FAN[roomConf.zuidafanshu],
      maxGames: JU_SHU[roomConf.jushuxuanze],
      creator: creator,
    }
  };
  if (roomConf.type == "xlch") {
    roomInfo.gameMgr = require("./gamemgr_xlch");
  }
  else {
    roomInfo.gameMgr = require("./gamemgr_xzdd");
  }

  // 创建频道，并加入到房间
  const channel = app.get('channelService').getChannel(roomId, true);
  roomInfo.channel = channel;
  channel.gameMgr = roomInfo.gameMgr;

  for (let i = 0; i < 4; ++i) {
    roomInfo.seats.push({
      userId: 0,
      score: 0,
      name: "",
      ready: false,
      seatIndex: i,
      numZiMo: 0,
      numJiePao: 0,
      numDianPao: 0,
      numAnGang: 0,
      numMingGang: 0,
      numChaJiao: 0,
    });
  }

  //写入数据库
  let conf = roomInfo.conf;
  const uuid = await db.create_room(roomInfo.id, conf, ip, port, createTime);
  if (!uuid) {
    // callback(3,null);
    return false;
  }

  delete creatingRooms[roomId];
  if (uuid) {
    roomInfo.uuid = uuid;
    console.log('uuid: ' + uuid);
    rooms[roomId] = roomInfo;
    totalRooms++;
    // callback(0,roomId);
    return roomId;
  }

};

exports.destroy = async function (roomId) {
  var roomInfo = rooms[roomId];
  if (roomInfo == null) {
    return;
  }

  for (var i = 0; i < 4; ++i) {
    var userId = roomInfo.seats[i].userId;
    if (userId > 0) {
      delete userLocation[userId];
      await db.set_room_id_of_user(userId);
    }
  }

  delete rooms[roomId];
  totalRooms--;
  await db.delete_room(roomId);
}

exports.getTotalRooms = function () {
  return totalRooms;
}

/**
 * 根据房间id获取房间
 * @param roomId
 * @returns {*}
 */
exports.getRoom = function (roomId) {
  return rooms[roomId];
};

/**
 * 判断是否是房主
 * @param roomId
 * @returns {boolean}
 */
exports.isCreator = function (roomId) {
  const roomInfo = rooms[roomId];
  if (!roomInfo) {
    return false;
  }
  return roomInfo.conf.creator === userId;
};


exports.enterRoom = async function (roomId, userId, userName) {
  var fnTakeSeat = async function (room) {
    if (exports.getUserRoom(userId) == roomId) {
      //已存在
      return 0;
    }

    for (var i = 0; i < 4; ++i) {
      var seat = room.seats[i];
      if (seat.userId <= 0) {
        seat.userId = userId;
        seat.name = userName;
        userLocation[userId] = {
          roomId: roomId,
          seatIndex: i
        };
        //console.log(userLocation[userId]);
        await db.update_seat_info(roomId, i, seat.userId, "", seat.name);
        //正常
        return 0;
      }
    }
    //房间已满
    return 1;
  }
  var room = rooms[roomId];
  if (room) {
    var ret = fnTakeSeat(room);
    return ret;
  }
  else {
    let roomData = await db.get_room_data(roomId);
    if (!roomData) {
      return 2;
    }
    room = constructRoomFromDb(roomData);
    return await fnTakeSeat(room);
  }
};

exports.setReady = function (userId, value) {
  var roomId = exports.getUserRoom(userId);
  if (roomId == null) {
    return;
  }

  var room = exports.getRoom(roomId);
  if (room == null) {
    return;
  }

  var seatIndex = exports.getUserSeat(userId);
  if (seatIndex == null) {
    return;
  }

  var s = room.seats[seatIndex];
  s.ready = value;
}

exports.isReady = function (userId) {
  var roomId = exports.getUserRoom(userId);
  if (roomId == null) {
    return;
  }

  var room = exports.getRoom(roomId);
  if (room == null) {
    return;
  }

  var seatIndex = exports.getUserSeat(userId);
  if (seatIndex == null) {
    return;
  }

  var s = room.seats[seatIndex];
  return s.ready;
}


exports.getUserRoom = function (userId) {
  var location = userLocation[userId];
  if (location != null) {
    return location.roomId;
  }
  return null;
};

exports.getUserSeat = function (userId) {
  var location = userLocation[userId];
  //console.log(userLocation[userId]);
  if (location != null) {
    return location.seatIndex;
  }
  return null;
};

exports.getUserLocations = function () {
  return userLocation;
};

exports.exitRoom = async function (userId) {
  var location = userLocation[userId];
  if (location == null)
    return;

  var roomId = location.roomId;
  var seatIndex = location.seatIndex;
  var room = rooms[roomId];
  delete userLocation[userId];
  if (room == null || seatIndex == null) {
    return;
  }

  var seat = room.seats[seatIndex];
  seat.userId = 0;
  seat.name = "";

  var numOfPlayers = 0;
  for (var i = 0; i < room.seats.length; ++i) {
    if (room.seats[i].userId > 0) {
      numOfPlayers++;
    }
  }

  await db.set_room_id_of_user(userId, null);

  if (numOfPlayers == 0) {
    exports.destroy(roomId);
  }
};