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
var Q = require('q');
var utils = require('./utils');
var database = require('./database');
var carManager = require('./carManager');
var stationManager = require('./stationManager');


function Processor() {};

var processor = new Processor();

var mapInfo =   [  
                    {node_id: 0, location: {x: 0, y: 0}},
                    {node_id: 1, location: {x: 0, y: 200}},
                    {node_id: 2, location: {x: 200, y: 200}},
                    {node_id: 3, location: {x: 0, y: 200}}
                ];

var stationPlaceInfo = [
                    {node_id: 1, objects: [ {class: "Stop_sign", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 2, objects: [ {class: "Bicycle", bound_size: {width: 0.3, height: 0.3}} ]}, 
                    {node_id: 3, objects: [ {class: "Traffic_cone", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 4, objects: [ {class: "Traffic_light", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 5, objects: [ {class: "Postbox", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 6, objects: [ {class: "Person", bound_size: {width: 0.3, height: 0.3}} ]}
                   
                ];

var placeInfo = [
                    {node_id: 1, objects: [ {class: "Stop_sign", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 2, objects: [ {class: "Bicycle", bound_size: {width: 0.3, height: 0.3}} ]}, 
                    {node_id: 3, objects: [ {class: "Traffic_cone", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 4, objects: [ {class: "Traffic_light", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 5, objects: [ {class: "Postbox", bound_size: {width: 0.6, height: 0.1}} ]},
                    {node_id: 6, objects: [ {class: "Person", bound_size: {width: 0.3, height: 0.3}} ]}
                ];                    

let carStatus = carManager.carStatus;
let stationStatus = stationManager.stationStatus;

Processor.prototype.process = function(data, fn) {
    let device_info = data.device_info
    let app_type = device_info.app_type;
    let update_time = Date.now() / 1000 | 0;
    if(app_type === "car") {
        let car_alive_data = {
            device_id: device_info.device_id,
            status: data.app_status,
            device_info: device_info,
            update_time: update_time,
            warning: data.warning,
            error: data.error
        }
        database.updateAliveCar(car_alive_data, function(err, results) {
            if(err) {
                fn(err, null);
            } else {
                carManager.getCarInfo(car_alive_data.device_id, function(err, car_info){
                    if (err){
                        fn(err, null);
                    } else {
                        database.updateBookingByQuery({
                            car_device_id: car_alive_data.device_id
                        }, {
                            car_warning_status: car_alive_data.warning, 
                            car_error_status: car_alive_data.error
                        }, undefined, false)
                        fn(null, {success: true});                          
                    }
                });
            }
        });
            
    } 
    else{
        
        let station_alive_data = {
            device_id: device_info.device_id,
            status: data.app_status,
            device_info: device_info,
            update_time: update_time,
            warning: data.warning,
            error: data.error
        }
        database.updateAliveStation(station_alive_data, function(err, results) {
            if(err) {
                fn(err, null);
            } else {
                stationManager.getStationInfo(station_alive_data.device_info.device_id, function(err, station_info){
                    if (err){
                        fn(err, null);
                    } else {                                   
                        database.updateBookingByQuery({
                            station_device_id: station_alive_data.device_id
                        }, {
                            station_warning_status: station_alive_data.warning, 
                            station_error_status: station_alive_data.error
                        }, undefined, false)             
                        fn(null, {success: true});                          
                    }
                });
            }
        });
    }
}


Processor.prototype.checkCarAlive = function(){
    let currentTime = Date.now() / 1000 | 0;
    return new Promise(async (resolve, reject)=>{
        let cars = await database.getAllCar()
        if(cars.length===0) resolve()
        cars.map((val)=>{
            let timediff = currentTime - val.update_time
            utils.debuglog("Car ID: "+val.car_id+", Latest alive "+timediff+" second ago.")
            if(timediff >= 30||!val.update_time) {
                let carObj = {
                    car_id: val.car_id,
                    device_id: val.device_id
                }
                utils.debuglog("Clear car")
                database.clearCarAndStationByCarId(val.car_id)
                resolve()
            }
            else resolve()
        })
    })
}

Processor.prototype.checkStationAlive = function(){
    let currentTime = Date.now() / 1000 | 0;
    return new Promise(async (resolve, reject)=>{
        let stations = await database.getAllStation()
        if(stations.length===0) resolve()
        stations.map((val)=>{
            let timediff = currentTime - val.update_time
            utils.debuglog("Station ID: "+val.station_id+", Latest alive "+timediff+" second ago.")
            if(timediff >= 30||!val.update_time) {
                let stationObj = {
                    station_id: val.station_id,
                    device_id: val.device_id
                }
                utils.debuglog("Clear station")
                database.clearCarAndStationByCarId(val.station_id)
                resolve()
            }
            else resolve()
        })
    })
}

Processor.prototype.bookingCar = function(device_id, station_id, fn) {   
    let booking_data = {
        start_time: new Date().toISOString(),
        station_device_id: device_id,
        station_id: station_id,
        video_status: "NOT_PLAY",
        current_node: 2,
        current_path: 1
    }
   
    let car_id = station_id;

    carManager.getAvailableCarByCarId(car_id, function(err, car) {
        if(err) {
            fn(err, null);
        }else {        
            if(car) { 
                let mergeBookingData = utils.merge_options(booking_data,
                    {
                        car_device_id: car.device_id, 
                        car_id: car.car_id
                    });
                database.queryBookingByStationDeviceId(booking_data.station_device_id, function(err, booking){
                    if(err) {
                        fn(err, null);
                    } else {
                        if(!_.isEmpty(booking)) {
                            fn(null, {success: false});
                        } else {
                            database.addBookingList(mergeBookingData, function(err, results) {
                                if(err) {
                                    fn(err, null);
                                } else {   
                                    var makePromiseChangeCarStatus = function() {
                                        let deferred = Q.defer();
                                        carManager.changeStatus(mergeBookingData.car_id, mergeBookingData.car_device_id, carStatus.WAIT_FOR_PLACE_SELECTION, function(err, results2){
                                            if (err) {
                                                utils.debuglog(new Error(err));
                                                deferred.reject(new Error(err));
                                            } else {
                                                deferred.resolve({success: true});
                                            } 
                                        });   
                                        
                                        return deferred.promise;
                                    }.bind(this);
                                
                                    var makePromiseChangeStationStatus = function() {
                                        let deferred = Q.defer();
                                        stationManager.changeStatus(mergeBookingData.station_device_id, stationStatus.DISPLAY_START_PAGE, function(err, results2){
                                            if (err) {
                                                utils.debuglog(new Error(err));
                                                deferred.reject(err);
                                            } else {
                                                deferred.resolve({success: true});
                                            }                        
                                        }); 
                        
                                        return deferred.promise;
                                    }.bind(this);
        
                                    let ps = [makePromiseChangeCarStatus(), makePromiseChangeStationStatus()];
        
                                    Q.all(ps)
                                    .then(function(results) {
                                        if (results) {
                                            fn(null, {success: true, car_id: car.car_id, car_ip_address: car.ip_address});
                                        }
                                    }, function(err) {
                                        utils.debuglog(err)
                                        fn(err, null);
                                    });                                         
                                }
                            });
                        }
                    }
                });
            } else {
                fn(null, {success: false});
            }                        
        }       
    });
}

Processor.prototype.waitForCarRequest = function(device_id, car_id, fn) {
    database.queryBookingByCarDeviceId(device_id, function(err, results){
        if (err) {
            fn(err, null)
        } else {
            if (_.isEmpty(results)) {
                fn(null, {received: false});
            } else {
                utils.debuglog(results)
                database.findStationByDeviceId(results[0].station_device_id, function(err, station){
                    utils.debuglog(station)
              
                    if(err) {
                        fn(err, null);
                        
                    } else {
                        if (_.isEmpty(station)) {
                            fn(err, null);
                        } else {

                            let stationPlaceInfo = processor.getStationPlaceByNodeId(station[0].station_node_id);
                            if (stationPlaceInfo != false) {
                                fn(null,  { 
                                    received: true, 
                                    station_id: results[0].station_id, 
                                    station_node_id: station[0].station_node_id,
                                    station_place_info: stationPlaceInfo
                                });
                            } else {
                                fn(null, {received: false});
                            }
                        }
                    }
                })
            }
        }
    })
}


Processor.prototype.getMap = function(fn) {
    if (_.isEmpty(mapInfo)) {
        fn(false, null);
    } else {
        fn(null, mapInfo);
    }
}

Processor.prototype.uploadPhoto = function(station_id, file, fn) {
    database.uploadPhotoToBookedList(station_id, file, function(err, results){
        if (err) {
            fn(err, null);
        } else {
            if (results) {
                fn(null, {success: true});
            } else {
                fn(null, {success: false});
            }
        }
    });
}

Processor.prototype.waitForCarToConnection = function(station, fn) {
    let car_id = station.station_id;
    database.findCarByCarId(car_id, function(err, cars) {
        if(err) {
            fn(err, null);
        } else {
            if(_.isEmpty(cars)) {
                fn(null, {success: false});             
            } else {
                let car = cars[0]
                
                if(car.status === carManager.carStatus.CONNECTED) {
                    processor.bookingCar(station.device_id, station.station_id, function(err, results){
                        if(err) {
                            fn(err, null);
                        }else {
                            fn(null, {
                                success: true, 
                                connected: true,
                                car: {
                                    car_id: car.car_id, 
                                    device_id: car.device_id,
                                    ip_address: car.ip_address
                                } 
                            }); 
                        }
                    });
                }
                else {
                    fn(null, {success: false, connected: false});   
                }
            }
         }
    });
}

Processor.prototype.selectStart = function(station, fn) {
    stationManager.changeStatus(station.device_id, stationManager.stationStatus.DISPLAY_PLACE_OPTIONS, function(err, results) {
        if(err) {
            fn(err, null);
        } else {
            fn(null, {success: true});
        }
    });
}

Processor.prototype.waitForStart = function(car, fn){
    let query = {car_device_id: car.device_id};
    database.getBooking(query, function(err, booking_list){
        if(err) {
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, {success: false});
            } else {
                let booking_data = booking_list[0];
                database.findStationByDeviceId(booking_data.station_device_id, function(err, stations){
                    if(err) {
                        fn(err, null);
                    }else {
                        if(_.isEmpty(stations)) {
                            fn(null, {success: false});
                        } else {
                            let station = stations[0];
                            if(station.status === stationStatus.DISPLAY_PLACE_OPTIONS) {
                                fn(null, {success: true});
                            } else {
                                fn(null, {success: false});
                            }
                        }                              
                    }
                });
            }
        }
    });
}

Processor.prototype.selectPlace = function(data, fn) {
    database.updateBookingList(data.station_id, {car_destination_node_id: data.place_node_id, car_destination_path_id: data.place_path_id, is_random: false}, function(err, results){
        if (err) {
            fn(err, null);
        } else {
            if(results) {
                database.queryBookingByStationDeviceId(data.device_id, function(err, book_list) {
                    if(err) {
                        fn(err, null);
                    } else {
                        if(_.isEmpty(book_list)) {
                            fn(null, {success: false});
                        } else {
                            let book_data = book_list[0];
                            carManager.changeStatus(book_data.car_id, book_data.car_device_id, carStatus.ON_ROUTE_TO_NODE, ()=>{})                                
                            stationManager.changeStatus(book_data.station_device_id, stationStatus.WAIT_FOR_CAR_TO_ARRIVE_AT_DESTINATION, ()=>{})
                            fn(null, {success: true});                                
                        }
                    }
                });


            } else { 
                fn(null, {success: false});
            }
        }
    });
}

Processor.prototype.waitForCarArriveStation= function(data, fn) {
    let station_id = data.station_id; 
    let device_id = data.device_id;

    database.queryBookingByStationDeviceId(device_id, function(err, booking_list) {
        let booking = booking_list[0]
        if(err) {
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, {arrived: false});  
            } else {
                database.findCarByDeviceId(booking.car_device_id, function(err, cars) {
                    if(err) {
                        fn(err, null);
                    } else {
                        if (_.isEmpty(cars)) {
                            fn(null, {arrived: false});
                        } else {
                            utils.debuglog(cars[0])
                            if(cars[0].status === carManager.carStatus.ARRIVE_AT_STATION) {
                                fn(null, {arrived: true});

                            } else {
                                fn(null, {arrived: false, car: cars[0]});
                            }
                        }
                    }
                });
            }
        }
    });
    
}


Processor.prototype.waitForCarArriveDestination = function(data, fn) {
    let station_id = data.station_id;
    let device_id = data.device_id; 
    
    database.queryBookingByStationDeviceId(device_id, function(err, booking_list) {
        let booking = booking_list[0]
        if(err) {
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, {arrived: false});  
            } else {
            
                database.findCarByDeviceId(booking.car_device_id, function(err, cars) {
                    if(err) {
                        fn(err, null);
                    } else {
                        if (_.isEmpty(cars)) {
                            fn(null, {arrived: false});  
                        } else {
                            if(cars[0].status === carManager.carStatus.ARRIVE_AT_DESTINATION) {
                                fn(null, {arrived: true});

                            } else {
                                fn(null, {arrived: false, car: cars[0]});
                            }
                        }
                    }
                });
                
            }
        }
    });
    
}

Processor.prototype.arriveAtStation= function(device_id, car_id, destination_node_id, fn) {
    carManager.changeStatus(car_id, device_id, carManager.carStatus.ARRIVE_AT_STATION, function(err, results) {
        if (err) {
           fn(err, null); 
        } else {
            if (_.isEmpty(results)) {
                fn(null, {success: false});
            } else {
                let query = {car_device_id: device_id};
                database.updateBookingByQuery(query, {car_destination_node_id: -1, car_destination_path_id: -1}, function(err, results){
                    if(err) {
                        fn(err, null);
                    } else {
                        fn(null, {success: true});
                    }
                })
            }
        }
    });
}

Processor.prototype.arriveAtDestination = function(device_id, car_id, destination_node_id, fn) {
    carManager.changeStatus(car_id, device_id, carManager.carStatus.ARRIVE_AT_DESTINATION, function(err, results) {
        if (err) {
           fn(err, null); 
        } else {
            if (_.isEmpty(results)) {
                fn(null, {success: false});
            } else {
                let query = {car_device_id: device_id};
                database.updateBookingByQuery(query, {car_destination_node_id: -1, car_destination_path_id: -1, video_status: 'WAIT_FOR_VIDEO_TO_PLAY'}, function(err, results){
                    if(err) {
                        fn(err, null);
                    } else {
                        fn(null, {success: true});
                    }
                })
                
            }
        }
    });
}

Processor.prototype.waitForStationEndSession = function(device_id, car_id, fn) {
    database.queryBookingByCarDeviceId(device_id, function(err, booking_list) {
        if(err) {
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, {success: true});
            } else {
                fn(null, {success: false});
            }
        }
    });
}

Processor.prototype.waitForConnectStation = function(car, fn){
    database.getBooking({car_device_id: car.device_id},function(err, booking_list){
        if(err){
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, {success: false});
            } else {
                fn(null, {success: true});    
            }
        }
    });
}

Processor.prototype.waitForStationDisconnect = function(device_id, car_id, fn) {
    database.queryBookingByCarDeviceId(device_id, function(err, booking_list) {
        if(err) {
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, {success: true});
            } else {
                fn(null, {success: false});
            }
        }
    });
}

Processor.prototype.waitForCarDisconnect = function(device_id, station_id, fn) {
    database.queryBookingByStationDeviceId(device_id, function(err, booking_list) {
        if(err) {
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, {success: true});
            } else {
                fn(null, {success: false});
            }
        }
    });
}
Processor.prototype.waitForPlaceSelection = async function(device_id, car_id, fn) {
    let nodes = await database.getNodeList()
    database.queryBookingByCarDeviceId(device_id, function(err, booking_list) {
        if (err) {
            fn(err, null);
        } else {
            if(_.isEmpty(booking_list)) {
                fn(null, { success: false });
            } else {
                let destination_node_id = booking_list[0].car_destination_node_id;
                let destination_path_id = booking_list[0].car_destination_path_id;
                if (destination_node_id > -1 && destination_path_id > -1) {
                    let nodeData = findArrayOfObject(nodes, 'node_id', destination_node_id)
                    let destination_place_info = nodeData;
                    if (destination_place_info && !booking_list[0].is_random) {
                        fn(null, { success: true, destination_place_info: destination_place_info, destination_path_id: destination_path_id});
                    } else {
                        fn(null, { success: false });
                    }
                } else {
                    fn(null, { success: false });
                }
            }
        }
    })
}

Processor.prototype.endSession = function(end_session, fn) {
    let query = {};

    switch (end_session.app_type) {
        case "car":
            query = { car_device_id: end_session.device_id };
            break;
        case "station":
            query = { station_device_id: end_session.device_id };
            utils.debuglog("query station")
            utils.debuglog(query);
            break;
    }
    let count = 0;
   
    database.getBooking(query, function(err, book_list) {

        if(err) {
            fn(err, null);
        } else {
            
            if(!_.isEmpty(book_list)) {
      
                var makePromiseChangeCarStatus = function() {
                    let deferred = Q.defer();
            
                    carManager.changeStatus(book_list[0].car_id, book_list[0].car_device_id, carStatus.NO_CONNECTION, function(err, results2){
                        if (err) {
                            deferred.reject(new Error(err));
                        } else {
                            deferred.resolve({success: true});
                        } 
                    });   
                    
                    return deferred.promise;
                }.bind(this);
            
                var makePromiseChangeStationStatus = function() {
                    let deferred = Q.defer();
                    stationManager.changeStatus(book_list[0].station_device_id, stationStatus.NO_CONNECTION, function(err, results2){
                        if (err) {
                            // utils.debuglog(new Error(err));
                            deferred.reject(err);
                        } else {
                            deferred.resolve({success: true});
                        }                        
                    }); 

                    return deferred.promise;
                }.bind(this);

                var makePromiseSwapToHistory = function() {
                    utils.debuglog(book_list[0]);
                    let deferred = Q.defer();
                    let history = utils.merge_options(book_list[0], {end_time: new Date().toISOString()});
                    database.addBookingHistory(history, function(err, results) {
                        if (err) {
                            deferred.reject(new Error(err));
                        } else {                           
                            database.removeBookedList(query, function(err2, results2) {
                                if (err2) {
                                    deferred.reject(new Error(err2));
                                } else {
                                    deferred.resolve({success: true});
                                }
                            });
                        }
                    })

                return deferred.promise;

            }.bind(this);

            let ps = [makePromiseChangeCarStatus(), makePromiseChangeStationStatus(), makePromiseSwapToHistory()];

            Q.all(ps)
                .then(function(results) {
                    if (results) {
                        fn(null, {success: true});
                    }
                }, function(err) {
                   
                    fn(err, null);
                });
        } else {
            fn(null, {success: false});
        }
     }
                                
    });
}

Processor.prototype.getPhotoFromBookingList = function(device_id, fn) {
    utils.debuglog("request photo")
    utils.debuglog(device_id)
    database.queryBookingByCarDeviceId(device_id, function(err, results){
        if (err) {
            fn(err, null);
        } else {
            if (_.isEmpty(results)) {
                fn(null, {success: false});
            } else {
                let photo_url = results[0].photo_url;
                
                if(photo_url != "") {
                    fn(null, {success: true, photo_url: '/static/images/'+ photo_url});
                } else {
                    fn(null, {success: false});
                }
            }
        }
    });
}


Processor.prototype.getPlaceByNodeId = function(node_id) {
    for (let place in placeInfo)  {
        if(placeInfo[place].node_id == node_id)  
            return placeInfo[place];
    }    
    return false;
}

Processor.prototype.getStationPlaceByNodeId = function(node_id) {
    for (let station in stationPlaceInfo)  {
        if(stationPlaceInfo[station].node_id == node_id)  
            return stationPlaceInfo[station];
    }    
    return false;
}


/////////////// Visualization : Tung

Processor.prototype.saveMonitoringConfig = (res)=>{
    let nodeData = res.nodeData
    let pathData = res.pathData
    let config = res.config
    let mapConfig = res.mapConfig
    utils.debuglog(config)
    return new Promise(async (resolve,reject)=>{
        try {
            utils.debuglog('Clear Map Config')
            await database.clearMapConfig()

            utils.debuglog('Set Map Config')
            await database.setMapConfig(mapConfig)

            utils.debuglog('Update Node List')
            await database.updateManyNode(nodeData)

            utils.debuglog('Update Path List')
            await database.updateManyPath(pathData)

            utils.debuglog('Clear Config')
            await database.clearConfig()

            utils.debuglog('Set Config')
            await database.setConfig(config)

            resolve()
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.getAll = function(fn){
    utils.debuglog("MONITOR=> request all data")
    database.getAll(function(err, results){
        if (err) {
            fn(err, null);
        } else {
            if (_.isEmpty(results)) {
                fn(null, {success: false});
            } else {
                fn(null, results);
            }
        }
    })
}

Processor.prototype.fetchBooking = function(fn){
    database.fetchBooking(function(err, results){
        if (err) {
            fn(err, null);
        } else {
            if (_.isEmpty(results)) {
                fn(null, {success: false});
            } else {
                fn(null, results);
            }
        }
    })
}

Processor.prototype.getAllNodeData = function(){
    utils.debuglog("request node data")
    return new Promise(async (resolve,reject)=>{
        try {
            let nodes = await database.getNodeList()
            resolve(nodes)
        }
        catch(err){
            reject(err)
        }
    })
}

Processor.prototype.getConfig = function(){
    utils.debuglog("request config")
    return new Promise(async (resolve,reject)=>{
        try {
            let config = await database.getConfig()
            
            for(let i = 0; i < config.length; i++){
                delete config[i]["_id"]
            }
            
            resolve(config)
        }
        catch(err){
            reject(err)
        }
    })
}

Processor.prototype.clearCar = function(data, fn){
    utils.debuglog("clear all data")
    database.clearCar(data, function(err, results){
        if (err) {
            fn(err, null);
        } else {
            if (_.isEmpty(results)) {
                fn(null, {success: false});
            } else {
                fn(null, results);
            }
        }
    })
}

Processor.prototype.clearAll = function(fn){
    utils.debuglog("clear all data")
    database.clearAll(function(err, results){
        if (err) {
            fn(err, null);
        } else {
            if (_.isEmpty(results)) {
                fn(null, {success: false});
            } else {
                fn(null, results);
            }
        }
    })
}

Processor.prototype.requestRouteToDestination = async function(obj) {
    let device_id = obj.device_id,
        destination_node_id =  obj.destination_node_id
        destination_path_id =  obj.destination_path_id
    return new Promise(async (resolve,reject)=>{
        try {    
            if(!isUsable(destination_path_id)&&!isUsable(destination_node_id)) resolve({success: false, server: "LEK CHECKIN"})

            let nodes = await database.getNodeList()
            let paths = await database.getPathList()
            let booking = await database.queryBookingByCarDeviceId(device_id)

            if(!booking) resolve({success: false})

            utils.debuglog(booking.car_id+ " => Node: "+obj.destination_node_id+", Path: "+obj.destination_path_id)

            let nodeQueue = []
            booking.car_destination_node_id = destination_node_id
            booking.car_destination_path_id = destination_path_id

            let startNodeId = booking.current_node
            let startNodeIndex = findArrayOfObjectIndex(nodes, 'node_id', startNodeId)
            let startNodeData = nodes[startNodeIndex]
            let startPathId = booking.current_path
            let startPathIndex = findArrayOfObjectIndex(paths, 'path_id', startPathId)
            let startPathData = paths[startPathIndex]
            
            nodes[startNodeIndex]['previous_path'] = null
            nodeQueue.push({
                node: startNodeData,
                accumulate_distant: 0,
                route: [{node:startNodeData, path: startPathId}]
            })

            let topQueue
            while(1){
                topQueue = nodeQueue.shift() //nodeQueue[0]
                let topQueueNode = topQueue.node
                let topQueueRoute = topQueue.route
                let nextPaths = topQueueNode.next_paths
                // TOPQUEUE
                // compare: topQueueNode.node_id and destination_node_id
                if(topQueueRoute.length > 0){
                    let latestRoute = topQueueRoute[topQueueRoute.length - 1]
                    let latestPath = latestRoute['path']
                    if(latestPath===destination_path_id) {
                        utils.debuglog("BREAKKKK")
                        break;
                    }
                }
                // Start Loop
                // Top Queue: topQueueNode.node_id
                // Next Path: nextPaths
                for(let i = 0; i < nextPaths.length; i++){
                    let nextPathIndex = findArrayOfObjectIndex(paths, 'path_id', nextPaths[i])
                    let nextPathData = paths[nextPathIndex]
                    let nextNodeId = nextPathData.next_nodes
                    let nextNodeIndex = findArrayOfObjectIndex(nodes, 'node_id', nextNodeId)
                    let nextNodeData = nodes[nextNodeIndex]
                    let nextDistant = topQueue.accumulate_distant + nextPathData.distant
                    let previousRoute = topQueue.route[topQueue.route.length - 1]
                    let previousNode = previousRoute.node
                    let previousPath = previousRoute.path
                    
                    let duplicateNodeIndex = nodeQueue.findIndex((o)=>o.node.node_id===nextNodeId)
                    if(duplicateNodeIndex>=0){
                        // Duplicate: nextNodeId
                        let duplicateNodeData = nodeQueue[duplicateNodeIndex]
                        if(duplicateNodeData.accumulate_distant > nextDistant){
                            // Found Shorter Path
                            nodeQueue.splice(duplicateNodeIndex, 1)
                            nodes[nextNodeIndex]['previous_path'] = nextPathData.path_id
                            let newCmd = getCommandFromPathToPath(previousNode.paths, previousPath, nextPathData.path_id)
                            // Go from previousPath to nextPathData.path_id by newCmd
                            let tempQueue = JSON.parse(JSON.stringify(topQueue))
                            tempQueue['route'][tempQueue.route.length-1]['command'] = newCmd
                            let newNodeObj = {
                                node: nextNodeData,
                                accumulate_distant: nextDistant,
                                route: [
                                    ...tempQueue.route, 
                                    {node: nextNodeData, path: nextPathData.path_id, command: newCmd}
                                ]
                            }
                            insertAndSortPriorityQueue(newNodeObj, nodeQueue, 'accumulate_distant')
                        }
                    }
                    else{
                        // No Duplicate: nextNodeId
                        nodes[nextNodeIndex]['previous_path'] = nextPathData.path_id
                        let newCmd = getCommandFromPathToPath(previousNode.paths, previousPath, nextPathData.path_id)
                        // Go from previousPath to nextPathData.path_id by newCmd
                        let tempQueue = JSON.parse(JSON.stringify(topQueue))
                        tempQueue['route'][tempQueue.route.length-1]['command'] = newCmd
                        let newNodeObj = {
                            node: nextNodeData,
                            accumulate_distant: nextDistant,
                            route: [
                                ...tempQueue.route, 
                                {node: nextNodeData, path: nextPathData.path_id}
                            ]
                        }
                        insertAndSortPriorityQueue(newNodeObj, nodeQueue, 'accumulate_distant')
                    }
                }
            }
            let shortest_path = []
            topQueue['route'].map((val, index)=>{
                    shortest_path.push({
                        node_id: val.node.node_id,
                        command: val.command?val.command:"DO_NOTHING",
                        objects: val.node.objects
                    })
            })

            booking.current_route = shortest_path
            booking.is_random = false 
            await database.updateBookingByQuery({car_device_id: device_id}, booking)

            resolve({success: true, route_path: shortest_path})
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.requestRouteToRandomDestination = async function(obj) {
    let device_id = obj.device_id
    return new Promise(async (resolve,reject)=>{
        try {    

            let nodes = await database.getNodeList()
            let paths = await database.getPathList()
            let booking = await database.queryBookingByCarDeviceId(device_id)
            if(!booking) resolve({success: false})
            
            utils.debuglog(booking.car_id+ " => RANDOM PATH")

            let outerPathOnly = true

            let nodeQueue = []

            let startNodeId = booking.current_node
            let startNodeIndex = findArrayOfObjectIndex(nodes, 'node_id', startNodeId)
            let startNodeData = nodes[startNodeIndex]
            let startPathId = booking.current_path
            let startPathIndex = findArrayOfObjectIndex(paths, 'path_id', startPathId)
            let startPathData = paths[startPathIndex]

            //Random Next Destination
            let possiblePaths = startNodeData.next_paths
            let randomPathIndex
            if(outerPathOnly){
                let minPathIndex = 0
                for(let j = 0 ; j < possiblePaths.length; j++){
                    if(possiblePaths[j]<minPathIndex) minPathIndex = possiblePaths[j] 
                }
                randomPathIndex = minPathIndex
            }
            else {
                randomPathIndex = Math.floor(Math.random() * possiblePaths.length);    
            }
            utils.debuglog('Choose '+possiblePaths[randomPathIndex]+'from '+possiblePaths)
            let randomPath = findArrayOfObject(paths, 'path_id', possiblePaths[randomPathIndex])
            let destination_node_id = randomPath.next_nodes
            booking.car_destination_node_id = destination_node_id
            booking.car_destination_path_id = possiblePaths[randomPathIndex]
            
            nodes[startNodeIndex]['previous_path'] = null
            nodeQueue.push({
                node: startNodeData,
                accumulate_distant: 0,
                route: [{node:startNodeData, path: startPathId}]
            })

            let topQueue
            while(1){
                topQueue = nodeQueue.shift()
                let topQueueNode = topQueue.node
                let nextPaths = topQueueNode.next_paths
                if(topQueueNode.node_id===destination_node_id) {
                    utils.debuglog("BREAKKKK")
                    break;
                }
                for(let i = 0; i < nextPaths.length; i++){
                    let nextPathIndex = findArrayOfObjectIndex(paths, 'path_id', nextPaths[i])
                    let nextPathData = paths[nextPathIndex]
                    let nextNodeId = nextPathData.next_nodes
                    let nextNodeIndex = findArrayOfObjectIndex(nodes, 'node_id', nextNodeId)
                    let nextNodeData = nodes[nextNodeIndex]
                    let nextDistant = topQueue.accumulate_distant + nextPathData.distant
                    let previousRoute = topQueue.route[topQueue.route.length - 1]
                    let previousNode = previousRoute.node
                    let previousPath = previousRoute.path

                    let duplicateNodeIndex = findArrayOfObjectIndex(nodeQueue, 'node_id', nextNodeId)
                    if(duplicateNodeIndex){
                        utils.debuglog('Duplicate: '+ nextNodeId)
                        let duplicateNodeData = nodeQueue[duplicateNodeIndex]
                        if(duplicateNodeData.accumulate_distant > nextDistant){
                            utils.debuglog('Found Shorter Path '+ nextNodeId)
                            nodeQueue.splice(duplicateNodeIndex, 1)
                            nodes[nextNodeIndex]['previous_path'] = nextPathData.path_id
                            let newCmd = getCommandFromPathToPath(previousNode.paths, previousPath, nextPathData.path_id)
                            utils.debuglog('Go from '+ previousPath + ' to '+ nextPathData.path_id+' by '+ newCmd)
                            let tempQueue = JSON.parse(JSON.stringify(topQueue))
                            tempQueue['route'][tempQueue.route.length-1]['command'] = newCmd
                            let newNodeObj = {
                                node: nextNodeData,
                                accumulate_distant: nextDistant,
                                route: [
                                    ...tempQueue.route, 
                                    {node: nextNodeData, path: nextPathData.path_id, command: newCmd}
                                ]
                            }
                            insertAndSortPriorityQueue(newNodeObj, nodeQueue, 'accumulate_distant')
                        }
                    }
                    else{
                        utils.debuglog('No Duplicate: '+ nextNodeId)
                        nodes[nextNodeIndex]['previous_path'] = nextPathData.path_id
                        let newCmd = getCommandFromPathToPath(previousNode.paths, previousPath, nextPathData.path_id)
                        utils.debuglog('Go from '+ previousPath + ' to '+ nextPathData.path_id+' by '+ newCmd)
                        let tempQueue = JSON.parse(JSON.stringify(topQueue))
                        tempQueue['route'][tempQueue.route.length-1]['command'] = newCmd
                        let newNodeObj = {
                            node: nextNodeData,
                            accumulate_distant: nextDistant,
                            route: [
                                ...tempQueue.route, 
                                {node: nextNodeData, path: nextPathData.path_id}
                            ]
                        }
                        insertAndSortPriorityQueue(newNodeObj, nodeQueue, 'accumulate_distant')
                    }
                }
            }
            let shortest_path = []
            topQueue['route'].map((val, index)=>{
                    shortest_path.push({
                        node_id: val.node.node_id,
                        command: val.command?val.command:"DO_NOTHING",
                        objects: val.node.objects
                    })
                    utils.debuglog("CMD #"+index+": node "+shortest_path.node_id + " - "+shortest_path.command)
            })
            utils.debuglog(shortest_path)
            
            booking.current_route = shortest_path
            booking.is_random = true 
            await database.updateBookingByQuery({car_device_id: device_id}, booking)
            
            let car_id = booking.car_id
            database.updateCarById(car_id,{server_trigger: ""},()=>{
                resolve({success: true, route_path: shortest_path})
            })

        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.arriveAtNode = async function(obj) {
    let device_id = obj.device_id,
    car_id =  obj.car_id,
    node_id = obj.node_id
    return new Promise(async (resolve,reject)=>{
        try {
            let booking = await database.queryBookingByCarDeviceId(device_id)
            let node = await database.getNodeByNodeId(node_id)
            let configArr = await database.getConfig()
            let config = configArr[0]

            let car_in_node_time = config.car_in_node_time?config.car_in_node_time:20000

            if(!booking||!node) resolve({success: false})

            let path_id = booking.current_path
            let path = await database.getPathByPathId(path_id)

            if(!path) resolve({success: false})

            let car_info = {
                car_id: car_id,
                path_id: path_id,
                path_priority: path.priority,
                timestamp: +new Date,
                type: 'arrive'
            }
            
            let currentQueue = filterLeftOverQueue(node.car_priority_queue, car_in_node_time)
            let newQueue = replaceAndSortPriorityQueue(car_info, 'car_id', currentQueue, 'path_priority', 'timestamp')
            utils.debuglog(newQueue)
            await database.clearCarFromNode(car_id)
            await database.updateNodeByQuery({node_id: node_id}, {car_priority_queue: newQueue})

            resolve({success: true})
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.arriveWrongNode = async function(obj) {
    let device_id = obj.device_id,
    car_id =  obj.car_id,
    node_id = obj.node_id,
    object_class = obj.object_class
    //TODO: Replace with config val
    return new Promise(async (resolve,reject)=>{
        try {    
            //Query Node
            let node = await database.getNodeByNodeId(node_id)
            let configArr = await database.getConfig()
            let config = configArr[0]
            let car_in_node_time = config.car_in_node_time?config.car_in_node_time:20000

            let objects = node.objects
            let object = objects.find((o)=>o.class===object_class)
            let path_id = object.path
            let path = await database.getPathByPathId(path_id)
            utils.debuglog(obj.car_id+"=> I'm on path "+path_id)
            
            //Update Node & Path
            let car_info = {
                car_id: car_id,
                path_id: path_id,
                path_priority: path.priority,
                timestamp: +new Date,
                type: 'wrong node'
            }
            let currentQueue = filterLeftOverQueue(node.car_priority_queue, car_in_node_time)
            let newQueue = replaceAndSortPriorityQueue(car_info, 'car_id' ,currentQueue, 'path_priority', 'timestamp')
            await database.clearCarFromNode(car_id)
            .then(()=>{
                database.updateNodeByQuery({node_id: node_id}, {car_priority_queue: newQueue})
            }).catch(()=>reject())
            
            let newPathQueue = replaceAndSortPriorityQueue(car_id, null, path.cars, null)
            await database.clearCarFromPath(car_id)
            .then(()=>{
                database.updatePathByQuery({path_id: path_id}, {cars: newPathQueue})
            }).catch(()=>reject())

            //Update Booking
            database.updateBookingByQuery({car_device_id: device_id},{
                current_node: node_id,
                current_path: path_id
            },()=>resolve({success: true}))
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.videoStarted = async function(obj) {
    let device_id = obj.device_id
    return new Promise(async (resolve,reject)=>{
        try {    
            let booking = await database.queryBookingByStationDeviceId(device_id)
            if(!booking) resolve({success: false})

            database.updateBookingByQuery({station_device_id: device_id},{
                video_status: "PLAYING"
            },()=>resolve({success: true}))
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.videoFinished = async function(obj) {
    let device_id = obj.device_id
    return new Promise(async (resolve,reject)=>{
        try {    
            let booking = await database.queryBookingByStationDeviceId(device_id)
            if(!booking) resolve({success: false})

            database.updateBookingByQuery({station_device_id: device_id},{
                video_status: "NOT_PLAY"
            },()=>resolve({success: true}))
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.getVideoStatus = async function(obj) {
    let device_id = obj.device_id
    return new Promise(async (resolve,reject)=>{
        try {    
            let booking = await database.queryBookingByCarDeviceId(device_id)
            if(!booking) resolve({success: false})

            let status = booking.video_status
            resolve({success: true, video_status: status})
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.waitForCancelPlace = function(obj, fn) {
    let car = obj; 
    carManager.getCarInfo(car.device_id, function(err, car_info){
        if(err) {
            fn(err, null)
        } else {
            if(car_info) {
                let server_trigger = car_info.server_trigger?car_info.server_trigger:null                                           
                fn(null, {success: true, server_trigger: server_trigger});      
            } else {
                fn(null, {success: false});
            }
        }
    });

}

Processor.prototype.cancelPlace = async function(obj) {
    let station_device_id = obj.device_id
    return new Promise(async (resolve,reject)=>{
        try {
            let booking = await database.queryBookingByStationDeviceId(station_device_id)
            if(!booking) resolve({success: false})
            let bookingUpdateObj = {
                is_random: true
            }
            await database.updateBookingByQuery({station_device_id: station_device_id}, bookingUpdateObj)

            let car_id = booking.car_id
            database.updateCarById(car_id,{server_trigger: "CANCEL_PLACE"},()=>{
                utils.debuglog("### PLACE CANCELED")
                resolve({success: true})
            })

        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.waitForTraffic = async function(obj) {
    let device_id = obj.device_id,
    car_id =  obj.car_id,
    node_id = obj.node_id
    return new Promise(async (resolve,reject)=>{
        try {    
            let defaultSpecialCaseList = [
                {
                     path_id: 10, 
                     path_to_check: [10,2]
                },
                {
                    path_id: 14, 
                    path_to_check: [14, 6]
                }
             ]
            let configArr = await database.getConfig()
            let config = configArr[0]
            let car_in_node_time = config.car_in_node_time?config.car_in_node_time:20000
            let specialCaseList = config.special_case_path?config.special_case_path:defaultSpecialCaseList
            let node = await database.getNodeByNodeId(node_id)

            let can_go = true
            
            if(!node) reject("This node isn't exist.")
            
            let queue = filterLeftOverQueue(node.car_priority_queue, car_in_node_time)
            let queueNumber = queue.findIndex((o)=>o.car_id===car_id)
            let previousPromise, nextPromise
            if(queueNumber<0) {
                processor.arriveAtNode({device_id, car_id, node_id})
                utils.debuglog("This car isn't in node queue.")
                reject("This car isn't in the queue.")
            }
            await database.updateNodeByQuery({node_id: node_id}, {car_priority_queue: queue})

            if(queueNumber===0) {
                utils.debuglog("This car is first in node queue.")
                let pathPriority = queue[0]["path_priority"]
                previousPromise = await new Promise(async (resolve2, reject2)=>{
                    let nodePreviousPath = node.previous_paths
                    for(let i = 0; i < nodePreviousPath.length; i++){
                        let val = nodePreviousPath[i]
                        let path = await database.getPathByPathId(val)
                        if(!path) reject("This path isn't exist.")
                        
                        let comparePathPriority = path.priority
                        utils.debuglog("I'm on path priority "+pathPriority+" compare with "+comparePathPriority)
                        if(comparePathPriority < pathPriority){
                            utils.debuglog(path)
                            let carInPath = path.cars
                            utils.debuglog("Looking for another cars in " + JSON.stringify(carInPath))
                            if(carInPath.length > 0) {
                                utils.debuglog("can't go because case previous path")
                                can_go = false
                                resolve2(false)
                            }
                        }
                    }
                    resolve2(true)
                })
                //TODO: Fetch next path from booking instead of check all next path
                 nextPromise = await new Promise(async (resolve3, reject3)=>{
                     let nodeNextPath = node.next_paths
                     for(let i = 0; i < nodeNextPath.length; i++){
                        let val = nodeNextPath[i]
                        let specialCase = specialCaseList.find((o)=>val===o.path_id)
                        if(specialCase!==undefined){
                            let pathToCheckList = specialCase.path_to_check
                            for(let j = 0; j < pathToCheckList.length; j++){
                                let pathToCheck = pathToCheckList[j]
                                let path = await database.getPathByPathId(pathToCheck)
                                if(!path) reject("This path isn't exist.")
                            
                                utils.debuglog(path)
                                let carInPath = path.cars
                                utils.debuglog("Looking for another cars in " + JSON.stringify(carInPath))
                                if(carInPath.length > 0) {
                                    utils.debuglog("can't go because case next path")
                                    can_go = false
                                    resolve3(false)
                                }
                            }
                        }
                        }   
                    resolve3(true)
                 })
            }
            else resolve({success: true, can_go: false})

            Promise.all([previousPromise, nextPromise]).then((result)=>{
                utils.debuglog(result)
                if(can_go) resolve({success: true, can_go: true})
                else resolve({success: true, can_go: false}) 
            })
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.finishTurnCommand = async function(obj) {
    let device_id = obj.device_id,
    car_id =  obj.car_id,
    node_id = obj.node_id

    return new Promise(async (resolve,reject)=>{
        try {    
            let booking = await database.queryBookingByCarDeviceId(device_id)
            let node = await database.getNodeByNodeId(node_id)

            if(!booking||!node) resolve({success: false})
            
            let currentRoute = booking.current_route
            let passPath = booking.current_path
            let passNodeData = currentRoute[0]

            if(!passNodeData){
                utils.debuglog('NO ROUTE DATA')
                resolve({success: true})
            }
            utils.debuglog(passNodeData)
            let nextPathId = getNextPath(node.paths, passPath, passNodeData.command)
            utils.debuglog(nextPathId)

            if(!nextPathId){
                utils.debuglog('SOMETHING WRONG')
                resolve({success: true})
            }

            let nextPath = await database.getPathByPathId(nextPathId)
            let nextNodeId = nextPath.next_nodes
            let car_info = {
                car_id: car_id,
                path_id: nextPathId,
                path_priority: nextPath.priority,
                timestamp: +new Date,
                type: 'finish turn'
            }
                        
            let newPathQueue = replaceAndSortPriorityQueue(car_id, null, nextPath.cars, null)
            
            //Query Path
            database.clearCarFromPath(car_id)
            .then(()=>{
                database.updatePathByQuery({path_id: nextPathId}, {cars: newPathQueue})
            }).catch(()=>reject(err))

            //Update next node data
            booking.current_route.shift()
            let bookingUpdateObj = {
                current_route: booking.current_route,
                current_node: booking.current_node = nextNodeId,
                current_path: booking.current_path = nextPathId
            }
            await database.updateBookingByQuery({car_device_id: device_id}, bookingUpdateObj)
            
            resolve({success: true})
        } catch(err) {
            reject(err)
        }
    })
}

Processor.prototype.clearCarFromNode = async function(car_id) {
    return new Promise(async (resolve,reject)=>{
        try {    
            await database.clearCarFromNode(car_id)
            resolve({})
        }
        catch(err){
            reject(err)
        }
    })
}

Processor.prototype.clearCarFromPath = async function(car_id) {
    return new Promise(async (resolve,reject)=>{
        try {    
            await database.clearCarFromPath(car_id)
            resolve({})
        }
        catch(err){
            reject(err)
        }
    })
}

function findArrayOfObject(array, name, value){
    let obj = array.find(el=>el[name]===value)
    if(!obj) {
        utils.debuglog('No object found')
        return null
    }
    return obj
}

function findArrayOfObjectIndex(array, name, value){
    let index = array.findIndex(el=>el[name]===value)
    if(index<0) {
        utils.debuglog('No object found')
        return null
    }
    return index
}

function getPathDistant(paths, targetPathId){
    let pathData = paths.find((el)=> paths.id===targetPathId)
    if(!pathData) {
        utils.debuglog('No path found')
        return null
    }
    return pathData.distant
}

function filterLeftOverQueue(queue, timeLimit){
    let currentTime = Date.now() / 1000 | 0
    for(let i = 0; i < queue.length; i++){
        let car = queue[i]
        let timestamp = car.timestamp / 1000
        let timeDiff = currentTime - timestamp
        let timeSecond = timeLimit / 1000
        if(timeDiff > timeSecond) queue.splice(i, 1)
    }
    return queue
}

function insertAndSortPriorityQueue(newObj, queue, sort_factor){
    let isDuplicate = queue.findIndex((element)=>JSON.stringify(element) === JSON.stringify(newObj) )
    if(isDuplicate<0){
        queue.push(newObj)
    }
    queue.sort((a,b) => (a[sort_factor] > b[sort_factor]) ? 1 : ((b[sort_factor] > a[sort_factor]) ? -1 : 0));
    return queue
}

function replaceAndSortPriorityQueue(newObj, replace_field=null ,queue, sort_factor=null, second_sort_factor=null){
    let isDuplicate
    utils.debuglog("REPLACE: " + JSON.stringify(newObj) + " IN "+ JSON.stringify(queue) + ", REPLACE FIELD: " + replace_field + ", SORT FACTOR: " + sort_factor + ", AND " + second_sort_factor)
    for(let i=0; i < queue.length; i++){
        utils.debuglog(replace_field)
        if(replace_field !== null){
            if(queue[i][replace_field]===newObj[replace_field])
                queue.splice(i, 1)
        }
        else{
            utils.debuglog('######PATH REPLACEMENT')
            utils.debuglog(queue[i])
            utils.debuglog(newObj)
            utils.debuglog('######')
            if(queue[i]===newObj)
            queue.splice(i, 1)
        }
    }
    queue.push(newObj)
    if(sort_factor !== null){ 
        if(second_sort_factor!== null)
            queue.sort((a,b) => Number(a[sort_factor]) - Number(b[sort_factor]) || Number(a[second_sort_factor]) - Number(b[second_sort_factor]));
        else
            queue.sort((a,b) => Number(a[sort_factor]) - Number(b[sort_factor]));            
    }
    utils.debuglog(queue)
    return queue
}

function getCommandFromPathToPath(paths, previousPath, nextPath){
    let previousPathIndex = -1,
    nextPathIndex = -1;

    for(let i = 0; i < 4; i++){
        if(nextPath===paths[i]) nextPathIndex = i
        if(previousPath===paths[i]) previousPathIndex = i
    }
    if(nextPathIndex<0||previousPathIndex<0) return "DO_NOTHING"
    let deltaIndex = (nextPathIndex < previousPathIndex)? nextPathIndex + 4 - previousPathIndex: nextPathIndex - previousPathIndex
    switch (deltaIndex)
    {
        case 1: 
            return 'TURN_RIGHT'
        case 2: 
            return 'GO_FORWARD'
        case 3: 
            return 'TURN_LEFT'
        default: 
            return 'DO_NOTHING'
    }
}

function getNextPath(paths, previousPath, cmd){
    let pathIndex = 0;
    for(let i = 0; i < 4; i++){
        if(paths[i]===previousPath){
            pathIndex = i
            break;
        }
    }
    switch (cmd)
	{
	case 'DO_NOTHING': //Lane Keeping
		break;
	case 'GO_FORWARD': //Manually control car to go forward
		pathIndex += 2;
		break;
	case 'TURN_LEFT': //Manually control car to turn left
		pathIndex--;
		break;
	case 'TURN_RIGHT': //Manually control car to turn right
		pathIndex++;
		break;
	default:
		break;
    }
    
    pathIndex = (pathIndex > 3) ? pathIndex - 4 : ((pathIndex < 0) ? pathIndex + 4 : pathIndex);

    return paths[pathIndex]
}

function isUsable(valueToCheck) {
    if (valueToCheck === 0     || // Avoid returning false if the value is 0.
        valueToCheck === ''    || // Avoid returning false if the value is an empty string.
        valueToCheck === false || // Avoid returning false if the value is false.
        valueToCheck)             // Returns true if it isn't null, undefined, or NaN.
    {
        return true;
    } else {
        return false;
    }
}

module.exports = processor;