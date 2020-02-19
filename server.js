/*
 * Copyright 2020 Google LLC
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var multer = require('multer');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var database = require(__dirname + '/./modules/database');
var cron = require('node-cron')
var sha256 = require('js-sha256');
var utils = require('./modules/utils');

var stationManager = require('./modules/stationManager');
var carManager = require('./modules/carManager');
var processor = require('./modules/processor');

const multerConfig = {
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, './static/images');
        },
        filename: function (req, file, cb) {
            cb(null, file.fieldname + '-' + Date.now()+ '.jpg');
        }
    })
};

function checkAuth(req, res, next){
    const auth = req.headers.auth
    if(auth==="3dbc9079979044fbf7b7c5529c77871d1537ab6acc0c76399d894396214282ae") next()
    else res.status(400).send('Auth fail');
}

var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use('/static', express.static('static'));

// Add headers
app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-access-token,auth');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

app.get('/', function(req, res) {
	res.status(200).send('success');
});

cron.schedule('*/30 * * * * *', async () => {
    utils.debuglog('##### Start CRON job #####');
    try{
        await processor.checkCarAlive()
        await processor.checkStationAlive()
        utils.debuglog('##### CRON job finish #####')
    }
    catch(err){
        utils.debuglog('##### CRON job error #####')
    }
});

//Station
app.post('/connect_station', function(req, res)  {
    let station = {
        station_id: req.body.station_id,
        device_id: req.body.device_id,
        ip_address: req.body.ip_address
    }
    utils.debuglog( "================connect_station======================");
  
    stationManager.connectStation(station, function(err, results){
        if(err) {
            res.status(500).send();
        }else {
            res.status(200).send(results);
        }
    });
});

app.post('/wait_for_car_to_connect', function(req, res) {
    let station = {
        device_id: req.body.device_id,
        station_id: req.body.station_id,
    }
    utils.debuglog("wait_for_car_to_connnect");
    utils.debuglog(station);
    processor.waitForCarToConnection(station, function(err, results) {
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
    
});

app.post('/select_start', function(req, res) {
    utils.debuglog("select start");
    let station = {
        device_id: req.body.device_id,
        station_id: req.body.station_id,
    }
    processor.selectStart(station, function(err, results) {
        utils.debuglog(results);
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

app.post('/wait_for_start', function(req, res) {
    let car = {
        device_id: req.body.device_id,
        station_id: req.body.station_id,
    }
    processor.waitForStart(car, function(err, results) {
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

app.post('/wait_for_place_selection', function(req, res) {
    processor.waitForPlaceSelection(req.body.device_id, req.body.car_id, function(err, results){
        if (err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

app.post('/select_place', function(req, res) {
    processor.selectPlace(req.body, function(err, success) {
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(success);
        }
    });
});

app.post('/wait_for_car_to_arrive_at_destination', function(req, res) {
    processor.waitForCarArriveDestination(req.body, function(err, results){
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    })
   
});

app.post('/disconnect_station', function(req, res) {
    let device_id = req.body.device_id;
    utils.debuglog( "================disconnect_station======================");
  
    stationManager.disconnectStation(req.body, function(err, results) {
        if (err) {
            res.status(500).send();
        } else{
            processor.endSession({device_id: device_id, app_type: "station"}, function(err2, results2){
                if (err2) {
                    utils.debuglog(err2);
                    res.status(500).send();
                } else {
                    res.status(200).send(results2);
                }
            });
        }
    })
});

app.post('/wait_for_car_disconnect', function(req, res) {
    processor.waitForCarDisconnect(req.body.device_id, req.body.car_id, function(err, results){
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

app.post('/end_session', function(req, res) {
    processor.endSession(req.body, function(err, success){
        if(err) {
            utils.debuglog(err);
            res.status(500).send();
        } else {
            utils.debuglog(success);
            res.status(200).send(success);
        }
    });
});

//Car
app.post('/connect_car', function(req, res) {
    let car = {
        car_id: req.body.car_id,
        device_id: req.body.device_id,
        ip_address: req.body.ip_address
    }
    utils.debuglog( "================connect_car======================");
  
    carManager.connectCar(car, function(err, results) {
        if(err) {
            res.status(500).send();
        }else {
            res.status(200).send({success: true});           
        }
    });

});

app.post('/wait_for_connect_station', function(req, res) {
    let car = req.body;
    processor.waitForConnectStation(car, function(err, results){
        if(err){
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

app.post('/wait_for_cancel_place', function(req, res) {
    let obj = {
        device_id: req.body.device_id,
    }
    processor.waitForCancelPlace(obj, function(err, results) {
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    }) 
});

app.post('/cancel_place', function(req, res) {
    let obj = {
        device_id: req.body.device_id,
    }
    processor.cancelPlace(obj)
    .then((results)=>{
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
});

app.post('/request_route_to_destination', function(req, res) {
    let obj = {
        device_id: req.body.device_id,
        destination_node_id: req.body.destination_node_id,
        destination_path_id: req.body.destination_path_id
    }
    utils.debuglog("#### REQUEST PATH ####")
    processor.requestRouteToDestination(obj)
    .then((results)=>{
        utils.debuglog("#### RETURN REQUEST PATH ####")
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
});

app.post('/request_route_to_random_destination', function(req, res) {
    let obj = {
        device_id: req.body.device_id
    }
    utils.debuglog("#### REQUEST RANDOM ####")
    processor.requestRouteToRandomDestination(obj)
    .then((results)=>{
        utils.debuglog('#### RETURN RANDOM PATH')
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
});

app.post('/arrive_at_node', (req, res)=>{
    let obj = {
        device_id: req.body.device_id,
        car_id: req.body.car_id,
        node_id: req.body.node_id
    }
    utils.debuglog('########################')
    utils.debuglog("OOOO Arrive at node OOOO")
    utils.debuglog('########################')
    utils.debuglog(obj.car_id+"=> I'm at node "+obj.node_id)
    processor.arriveAtNode(obj)
    .then((results)=>{
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.post('/arrive_wrong_node', (req, res)=>{
    let obj = {
        device_id: req.body.device_id,
        car_id: req.body.car_id,
        node_id: req.body.node_id,
        object_class: req.body.object_class,
    }
    utils.debuglog('###########################')
    utils.debuglog("XXXX ARRIVE WRONG NODE XXXX")
    utils.debuglog('###########################')
    utils.debuglog(obj.car_id+" => I see "+obj.object_class)
    utils.debuglog(obj.car_id+" => I'm at node "+obj.node_id)
    processor.arriveWrongNode(obj)
    .then((results)=>{
            utils.debuglog(results)
            utils.debuglog(">>Return Wrong node")
            res.status(200).send(results);

    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.post('/wait_for_traffic', (req, res)=>{
    let obj = {
        device_id: req.body.device_id,
        car_id: req.body.car_id,
        node_id: req.body.node_id,
    }
    utils.debuglog("#### WAIT FOR TRAFFIC ####")
    processor.waitForTraffic(obj)
    .then((results)=>{
        utils.debuglog("#### WAIT RESULT "+results.can_go+" ####")
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.post('/finish_auto_turn_command', (req, res)=>{
    let obj = {
        device_id: req.body.device_id,
        car_id: req.body.car_id,
        node_id: req.body.node_id,
    }
    utils.debuglog("#### START FINISH TURN ####")
    processor.finishTurnCommand(obj)
    .then((results)=>{
        utils.debuglog("#### FINISH TURN ####")
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.get('/clear_car_from_node', (req, res)=>{

    processor.clearCarFromNode(req.body.car_id)
    .then((results)=>{
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.get('/clear_car_from_path', (req, res)=>{
    processor.clearCarFromPath(req.body.car_id)
    .then((results)=>{
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.post('/arrive_at_destination', function(req, res){
    processor.arriveAtDestination(req.body.device_id, req.body.car_id, req.body.destination_node_id, function(err, results){
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

app.post('/video_started', (req, res)=>{
    let obj = {
        device_id: req.body.device_id,
    }
    utils.debuglog("#### VIDEO START ####")
    processor.videoStarted(obj)
    .then((results)=>{
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.post('/video_finished', (req, res)=>{
    let obj = {
        device_id: req.body.device_id,
    }
    utils.debuglog("#### VIDEO START ####")
    processor.videoFinished(obj)
    .then((results)=>{
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.post('/video_status', (req, res)=>{
    let obj = {
        device_id: req.body.device_id,
    }
    utils.debuglog("#### GET VIDEO STATUS ####")
    processor.getVideoStatus(obj)
    .then((results)=>{
        utils.debuglog(results)
        utils.debuglog("#### RETURN GET VIDEO STATUS ####")
        res.status(200).send(results);
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.post('/disconnect_car', function(req, res) {
    let device_id = req.body.device_id
    utils.debuglog( "================disconnect_car======================");
  
    carManager.disconnectCar(req.body, function(err, results) {
        if (err) {
            res.status(500).send();
        } else{
            processor.endSession({device_id: device_id, app_type: "car"}, function(err2, results2){
                if (err2) {
                    utils.debuglog(err2);
                    res.status(500).send();
                } else {
                    res.status(200).send(results2);
                }
            });
        }
    })
});

app.post('/alive', function(req, res){   
    processor.process(req.body, function(err, results){
        if(err) {
            res.status(500).send();
        }else {
            res.status(200).send(results);
        }
    });
});

app.post('/wait_for_station_end_session', function(req, res) {
    processor.waitForStationEndSession(req.body.device_id, req.body.car_id, function(err, results){
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

app.post('/wait_for_station_disconnect', function(req, res) {
    processor.waitForStationDisconnect(req.body.device_id, req.body.car_id, function(err, results){
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(results);
        }
    });
});

//Tester
app.post('/change_station_status', function(req, res) {
    let device_id = req.body.device_id;
    let status = req.body.status;
    stationManager.changeStatus(device_id, status, function(err, results) {
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send();
        }
    });
});

app.post('/change_car_status', function(req, res) {
    let car_id = req.body.car_id;
    let device_id = req.body.device_id;
    let status = req.body.status;
    carManager.changeStatus(car_id, device_id, status, function(err, results) {
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send();
        }
    });
});

app.post('/get_station_status', function(req, res) {
    let device_id = req.body.device_id; 
    stationManager.getCarInfo(device_id, function(err, station){
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(station.status);
        }
    });
});

app.post('/get_car_status', function(req, res) {
    let device_id = req.body.device_id; 
    carManager.getCarInfo(device_id, function(err, car){
        if(err) {
            res.status(500).send();
        } else {
            res.status(200).send(car.status);
        }
    });
});

app.get('/request_map', function(req, res){
    processor.getMap(function(err, map) {
        if(err)  {
            res.status(500).send();
        }else {
            res.status(200).send({success: true, map: map});
        }
    })
});

//New flow V2
////Register Node: for Monitor to save node setting to server
app.post('/save_monitoring_config', checkAuth, (req, res)=>{
    config = req.body
    processor.saveMonitoringConfig(config)
    .then(()=>{
        res.status(200).send({success:true});
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.get('/get_all_node_data', (req, res)=>{
    processor.getAllNodeData()
    .then((results)=>{
        res.status(200).send({success:true, node_data: results});
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.get('/get_config', (req, res)=>{
    processor.getConfig()
    .then((results)=>{
        res.status(200).send({success:true, config: results});
    })
    .catch(err=>{
        res.status(500).send(err);
    })
})

app.get('/get_all', function(req, res){
    processor.getAll(function(err, data) {
        if(err)  {
            res.status(500).send();
        }else {
            res.status(200).send(data);
        }
    })
})

app.get('/fetch_booking', function(req, res){
    processor.fetchBooking(function(err, data) {
        if(err)  {
            res.status(500).send();
        }else {
            res.status(200).send(data);
        }
    })
})

app.post('/clear_car', checkAuth, function(req, res){
    processor.clearCar(req.body, function(err, data) {
        if(err)  {
            res.status(500).send();
        }else {
            res.status(200).send(data);
        }
    })
})

app.post('/clear_car_from_node', checkAuth, function(req, res){
    processor.clearCarFromNode(req.body.car_id, function(err, data) {
        if(err)  {
            res.status(500).send();
        }else {
            res.status(200).send(data);
        }
    })
})

app.get('/clear_all', checkAuth, function(req, res){
    processor.clearAll(function(err, data) {
        if(err)  {
            res.status(500).send();
        }else {
            res.status(200).send(data);
        }
    })
})

database.connect();

var ports = [5350, 5351]

let setport = process.argv[2]?Number(process.argv[2])+0:ports[0]
http.createServer(app).listen(setport, function() {
    console.log('Pixelopolis Server V3.0.0');
    console.log('Http listening on port '+ setport);
});
