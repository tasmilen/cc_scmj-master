/**
 * 封装返回的数据
 * @param errno
 * @param errmsg
 * @param data
 * @constructor
 */
const response = function(errcode, errmsg = '', data = null) {
  let returnData = {};
  if (data) {
    returnData = data;
  }
  returnData.errcode = errcode || 0;
  returnData.errmsg = errmsg || '';
  return returnData;
};

module.exports = response;