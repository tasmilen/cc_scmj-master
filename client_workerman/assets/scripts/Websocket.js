var Global = cc.Class({
    extends: cc.Component,
    statics: {
        ip:"",
        sio:null,
        isPinging:false,
        fnDisconnect:null,
        handlers:{},
        on:function(event,fn){
            if(this.handlers[event]){
                console.log("event:" + event + "' handler has been registered.");
                return;
            }

            var handler = function(data){
                //console.log(event + "(" + typeof(data) + "):" + (data? data.toString():"null"));
                if(event != "disconnect" && typeof(data) == "string"){
                    data = JSON.parse(data);
                }
                fn(data);
            };
            
            this.handlers[event] = handler; 
            cc.log('注册事件' + event)
        },
        connect:function(fnConnect,fnError) {
            var self = this;
            
            var opts = {
                'reconnection':false,
                'force new connection': true,
                'transports':['websocket', 'polling']
            }

            let ws = new WebSocket("ws://127.0.0.1:8282");
            ws.onopen = function (event) {
                console.log("Send Text WS was opened.");
                self.sio.connected = true;
                fnConnect(event);
            };
            ws.onmessage = function (event) {
                console.log("response text msg: ");
                const data = JSON.parse(event.data);
                cc.log(data.type)
                
                // 监听事件
                cc.log(self.handlers)
                for(var key in self.handlers){
                    cc.log('有事件吗')
                    var callback = self.handlers[key];
                    if(key == data.type && typeof(callback) == "function"){
                        cc.log('回调了吗' + key)
                        
                        console.log("register:function " + key);
                        // this.sio.on(key,value);    
                        // 触发事件
                        callback(data);
                        break;
                    }
                }
            };
            ws.onerror = function (event) {
                console.log("Send Text fired an error");
            };
            ws.onclose = function (event) {
                console.log("WebSocket instance closed.");
                console.log("disconnect");
                self.sio.connected = false;
                self.close();
            };

            this.sio = ws;
           
            // 发送心跳
            setTimeout(function () {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send("Hello WebSocket, I'm a text message.");

                }
                else {
                    console.log("WebSocket instance wasn't ready...");
                }
            }, 3);
        },

        // on:function(event, callback){
        //     this.addHandler(event, callback);
        // },

        send:function(event,data){
            if(this.sio.connected){
                if(data != null && (typeof(data) == "object")){
                    data = JSON.stringify(data);
                    //console.log(data);              
                }
                // this.sio.emit(event,data);  
                this.sio.send(JSON.stringify({type: event, message: data}));              
            }
        },
        close:function(){
            console.log('close');
            this.delayMS = null;
            if(this.sio && this.sio.connected){
                this.sio.connected = false;
                // this.sio.disconnect();
            }
            this.sio = null;
            if(this.fnDisconnect){
                this.fnDisconnect();
                this.fnDisconnect = null;
            }
        },
    },
});